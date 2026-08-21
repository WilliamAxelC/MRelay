import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

export interface P2PMessage {
  type: 'PLAYHEAD_TICK' | 'MUTATION' | 'CHAT_MESSAGE' | 'PEER_REACTION' | 'PING' | 'PONG';
  payload: any;
  senderId: string;
  timestamp: number;
}

export type P2PStatus = 'connected' | 'connecting' | 'fallback_relay' | 'disconnected';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function useP2P(
  socket: Socket | null,
  roomId: string | null,
  userId: string,
  isHost: boolean,
  onP2PMessage?: (msg: P2PMessage) => void
) {
  const [p2pStatus, setP2PStatus] = useState<P2PStatus>('disconnected');
  const [p2pLatencyMs, setP2pLatencyMs] = useState<number | null>(null);
  const [connectedPeerCount, setConnectedPeerCount] = useState<number>(0);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const iceCandidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updatePeerCount = useCallback(() => {
    let count = 0;
    dataChannelsRef.current.forEach((dc) => {
      if (dc.readyState === 'open') count++;
    });
    setConnectedPeerCount(count);
    if (count > 0) {
      setP2PStatus('connected');
    } else if (socket?.connected) {
      setP2PStatus('fallback_relay');
    } else {
      setP2PStatus('disconnected');
    }
  }, [socket?.connected]);

  const handleDataChannelMessage = useCallback((event: MessageEvent, fromPeerId: string) => {
    try {
      const msg: P2PMessage = JSON.parse(event.data);
      if (msg.type === 'PING') {
        const dc = dataChannelsRef.current.get(fromPeerId);
        if (dc && dc.readyState === 'open') {
          dc.send(JSON.stringify({
            type: 'PONG',
            payload: { clientTimestamp: msg.timestamp },
            senderId: userId,
            timestamp: Date.now()
          }));
        }
        return;
      }

      if (msg.type === 'PONG') {
        if (msg.payload?.clientTimestamp) {
          const rtt = Date.now() - msg.payload.clientTimestamp;
          setP2pLatencyMs(Math.round(rtt));
        }
        return;
      }

      if (onP2PMessage) {
        onP2PMessage(msg);
      }
    } catch (err) {
      console.warn('[P2P] Failed to parse message', err);
    }
  }, [userId, onP2PMessage]);

  const setupDataChannel = useCallback((dc: RTCDataChannel, peerId: string) => {
    dc.onopen = () => {
      dataChannelsRef.current.set(peerId, dc);
      updatePeerCount();
    };

    dc.onclose = () => {
      dataChannelsRef.current.delete(peerId);
      updatePeerCount();
    };

    dc.onerror = (err) => {
      console.warn(`[P2P] DataChannel error with peer: ${peerId}`, err);
    };

    dc.onmessage = (e) => handleDataChannelMessage(e, peerId);
  }, [updatePeerCount, handleDataChannelMessage]);

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      existing.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && roomId) {
        socket.emit('SIGNAL_ICE_CANDIDATE', {
          roomId,
          targetUserId: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel, peerId);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        dataChannelsRef.current.delete(peerId);
        updatePeerCount();
      }
    };

    return pc;
  }, [socket, roomId, setupDataChannel, updatePeerCount]);

  const drainCandidateBuffer = async (peerId: string, pc: RTCPeerConnection) => {
    const buffered = iceCandidateBufferRef.current.get(peerId);
    if (buffered && buffered.length > 0) {
      for (const cand of buffered) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // ignore candidate error
        }
      }
      iceCandidateBufferRef.current.delete(peerId);
    }
  };

  const initiateOffer = useCallback(async (targetPeerId: string) => {
    if (!socket || !roomId) return;
    try {
      setP2PStatus('connecting');
      const pc = createPeerConnection(targetPeerId);
      const dc = pc.createDataChannel('muser-sync', { ordered: true });
      setupDataChannel(dc, targetPeerId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('SIGNAL_OFFER', {
        roomId,
        targetUserId: targetPeerId,
        sdp: offer
      });
    } catch (err) {
      console.warn(`[P2P] Failed to initiate offer to ${targetPeerId}`, err);
      setP2PStatus('fallback_relay');
    }
  }, [socket, roomId, createPeerConnection, setupDataChannel]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handlePeerJoined = (data: { peer: { userId: string } }) => {
      if (data.peer.userId !== userId) {
        if (isHost) {
          initiateOffer(data.peer.userId);
        }
      }
    };

    const handlePeerLeft = (data: { userId: string }) => {
      const dc = dataChannelsRef.current.get(data.userId);
      if (dc) {
        dc.close();
        dataChannelsRef.current.delete(data.userId);
      }
      const pc = peerConnectionsRef.current.get(data.userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.userId);
      }
      iceCandidateBufferRef.current.delete(data.userId);
      updatePeerCount();
    };

    const handleSignalOffer = async (data: { fromUserId: string; sdp: any }) => {
      try {
        setP2PStatus('connecting');
        const pc = createPeerConnection(data.fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await drainCandidateBuffer(data.fromUserId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('SIGNAL_ANSWER', {
          roomId,
          targetUserId: data.fromUserId,
          sdp: answer
        });
      } catch (err) {
        console.warn('[P2P] Failed to handle SIGNAL_OFFER', err);
        setP2PStatus('fallback_relay');
      }
    };

    const handleSignalAnswer = async (data: { fromUserId: string; sdp: any }) => {
      try {
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await drainCandidateBuffer(data.fromUserId, pc);
        }
      } catch (err) {
        console.warn('[P2P] Failed to handle SIGNAL_ANSWER', err);
      }
    };

    const handleSignalCandidate = async (data: { fromUserId: string; candidate: any }) => {
      try {
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (pc && pc.remoteDescription && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else if (data.candidate) {
          const buf = iceCandidateBufferRef.current.get(data.fromUserId) || [];
          buf.push(data.candidate);
          iceCandidateBufferRef.current.set(data.fromUserId, buf);
        }
      } catch (err) {
        console.warn('[P2P] Failed to add ICE candidate', err);
      }
    };

    socket.on('PEER_JOINED', handlePeerJoined);
    socket.on('PEER_LEFT', handlePeerLeft);
    socket.on('SIGNAL_OFFER', handleSignalOffer);
    socket.on('SIGNAL_ANSWER', handleSignalAnswer);
    socket.on('SIGNAL_ICE_CANDIDATE', handleSignalCandidate);

    return () => {
      socket.off('PEER_JOINED', handlePeerJoined);
      socket.off('PEER_LEFT', handlePeerLeft);
      socket.off('SIGNAL_OFFER', handleSignalOffer);
      socket.off('SIGNAL_ANSWER', handleSignalAnswer);
      socket.off('SIGNAL_ICE_CANDIDATE', handleSignalCandidate);
    };
  }, [socket, roomId, userId, isHost, initiateOffer, createPeerConnection, updatePeerCount]);

  useEffect(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    pingIntervalRef.current = setInterval(() => {
      if (dataChannelsRef.current.size > 0) {
        const pingMsg: P2PMessage = {
          type: 'PING',
          payload: null,
          senderId: userId,
          timestamp: Date.now()
        };
        const raw = JSON.stringify(pingMsg);
        dataChannelsRef.current.forEach((dc) => {
          if (dc.readyState === 'open') {
            try {
              dc.send(raw);
            } catch {}
          }
        });
      }
    }, 3000);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [userId]);

  const broadcastP2P = useCallback((type: P2PMessage['type'], payload: any): boolean => {
    let sentToAtLeastOne = false;
    const msg: P2PMessage = {
      type,
      payload,
      senderId: userId,
      timestamp: Date.now()
    };
    const raw = JSON.stringify(msg);

    dataChannelsRef.current.forEach((dc) => {
      if (dc.readyState === 'open') {
        try {
          dc.send(raw);
          sentToAtLeastOne = true;
        } catch (e) {
          console.warn('[P2P] Error sending data channel message', e);
        }
      }
    });

    return sentToAtLeastOne;
  }, [userId]);

  useEffect(() => {
    const dcs = dataChannelsRef.current;
    const pcs = peerConnectionsRef.current;
    const bufs = iceCandidateBufferRef.current;

    return () => {
      dcs.forEach(dc => dc.close());
      dcs.clear();
      pcs.forEach(pc => pc.close());
      pcs.clear();
      bufs.clear();
      setP2PStatus('disconnected');
      setP2pLatencyMs(null);
      setConnectedPeerCount(0);
    };
  }, [roomId]);

  return {
    p2pStatus,
    p2pLatencyMs,
    connectedPeerCount,
    broadcastP2P
  };
}
