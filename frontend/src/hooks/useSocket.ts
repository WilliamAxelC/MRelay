import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useP2P } from './useP2P';
import type { P2PMessage } from './useP2P';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface QueueItem {
  videoId: string;
  title: string;
  duration?: string;
  author?: string;
  addedBy?: {
    userId: string;
    username: string;
  };
  upvotes?: string[];
}

export interface HistoryItem extends QueueItem {
  status: 'played' | 'skipped';
  timestamp: number;
}

export interface PendingRequest {
  id: string;
  trackId: string;
  title: string;
  duration?: string;
  author?: string;
  username: string;
  userId: string;
}

export interface PeerInfo {
  socketId: string;
  userId: string;
  username: string;
  isDetached?: boolean;
}

export interface RoomState {
  roomId: string;
  title: string;
  isPlaying: boolean;
  currentPlayhead: number;
  currentTrackId: string;
  currentTitle: string;
  currentDuration?: string;
  currentAuthor?: string;
  currentTrackAddedBy?: { userId: string; username: string };
  updatedAt: number;
  queue: QueueItem[];
  history: HistoryItem[];
  isPublic?: boolean;
  isRequestOnly?: boolean;
  isDjAutoplayEnabled?: boolean;
  isMasterAudioOnly?: boolean;
  pendingRequests?: PendingRequest[];
  peers?: PeerInfo[];
  hostUserId?: string;
  chatRateLimit?: { maxTokens: number; intervalMs: number };
  repeatMode?: 'off' | 'track' | 'queue';
}

export function useSocket(
  roomId: string | null,
  userId: string,
  username: string,
  password?: string,
  title?: string,
  isUnsynced: boolean = false,
  onRoomClosed?: (message: string) => void,
  onPlayheadTick?: (playhead: number) => void,
  onPeerReaction?: (emoji: string) => void
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<{ message: string; remainingMs: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const isUnsyncedRef = useRef(isUnsynced);
  const isHost = userId === hostId;

  useEffect(() => {
    isUnsyncedRef.current = isUnsynced;
  }, [isUnsynced]);

  const handleP2PMessage = useCallback((msg: P2PMessage) => {
    if (isUnsyncedRef.current) return;

    if (msg.type === 'PLAYHEAD_TICK' && !isHost) {
      if (onPlayheadTick && typeof msg.payload?.playhead === 'number') {
        onPlayheadTick(msg.payload.playhead);
      }
    } else if (msg.type === 'CHAT_MESSAGE') {
      const chatMsg = msg.payload as ChatMessage;
      setMessages((prev) => {
        if (prev.some(m => m.id === chatMsg.id)) return prev;
        return [...prev, chatMsg];
      });
    } else if (msg.type === 'PEER_REACTION') {
      if (onPeerReaction && typeof msg.payload?.emoji === 'string') {
        onPeerReaction(msg.payload.emoji);
      }
    }
  }, [isHost, onPlayheadTick, onPeerReaction]);

  const { p2pStatus, p2pLatencyMs, connectedPeerCount, broadcastP2P } = useP2P(
    socket,
    roomId,
    userId,
    isHost,
    handleP2PMessage
  );

  useEffect(() => {
    if (!roomId) return;

    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      query: { 
        roomId, 
        userId, 
        username, 
        password: password || '', 
        title: title || '', 
        correlationId: `ui-${userId}-${Date.now()}` 
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('STATE_SYNC', (data: any) => {
      if (isUnsyncedRef.current) return;
      setRoomState(data.payload);
      if (data.payload.hostUserId) {
        setHostId(data.payload.hostUserId);
      }
    });

    newSocket.on('ROSTER_UPDATE', (data: any) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        return { ...prev, peers: data.peers };
      });
    });

    newSocket.on('HOST_CHANGED', (data: any) => {
      setHostId(data.hostId);
      setRoomState((prev) => prev ? { ...prev, hostUserId: data.hostId } : null);
    });

    newSocket.on('ROOM_MESSAGE', (message: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    newSocket.on('ROOM_CLOSED', (data: any) => {
      if (onRoomClosed) onRoomClosed(data.message);
    });

    newSocket.on('ERROR', (data: any) => {
      setErrorMessage(data.message);
      setTimeout(() => setErrorMessage(null), 4000);
    });

    newSocket.on('CHAT_RATE_LIMIT_ERROR', (data: any) => {
      setChatError({ message: data.message, remainingMs: data.remainingMs });
      setTimeout(() => setChatError(null), data.remainingMs);
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setRoomState(null);
      setHostId(null);
      setMessages([]);
    };
  }, [roomId, userId, username, password, title, onRoomClosed]);

  const emitMutation = useCallback((type: string, payload: any = {}) => {
    if (!socket || !roomId) return;

    const mutationData = {
      action: 'ROOM_MUTATION' as const,
      version: 1,
      correlationId: `ui-${Date.now()}`,
      payload: {
        roomId,
        type,
        timestamp: Date.now(),
        ...payload
      }
    };

    socket.emit('ROOM_MUTATION', mutationData as any);
  }, [socket, roomId]);

  const sendMessage = useCallback((text: string) => {
    if (!socket || !roomId) return;
    socket.emit('SEND_MESSAGE', { roomId, text });
  }, [socket, roomId]);

  const broadcastPlayheadTick = useCallback((playhead: number) => {
    if (isHost && isConnected) {
      broadcastP2P('PLAYHEAD_TICK', { playhead });
    }
  }, [isHost, isConnected, broadcastP2P]);

  const lastReactionTimeRef = useRef<number>(0);
  const broadcastReaction = useCallback((emoji: string) => {
    const now = Date.now();
    if (now - lastReactionTimeRef.current >= 90) {
      lastReactionTimeRef.current = now;
      broadcastP2P('PEER_REACTION', { emoji });
    }
  }, [broadcastP2P]);

  return {
    isConnected,
    roomState,
    hostId,
    isHost,
    emitMutation,
    messages,
    sendMessage,
    chatError,
    errorMessage,
    p2pStatus,
    p2pLatencyMs,
    connectedPeerCount,
    broadcastPlayheadTick,
    broadcastReaction
  };
}
