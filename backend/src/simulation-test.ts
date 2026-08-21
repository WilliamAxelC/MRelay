process.env.NODE_ENV = 'test';

import { io } from 'socket.io-client';
import { httpServer } from './index';

const PORT = 3055;

function createClient(userId: string, username: string, roomId: string): Promise<any> {
  return new Promise((resolve) => {
    const socket = io(`http://localhost:${PORT}`, {
      query: { correlationId: `sim-${userId}`, roomId, userId, username }
    });

    socket.on('connect', () => {
      resolve(socket);
    });
  });
}

async function runSimulation() {
  console.log('--- Starting Multi-Client P2P & Sync Simulation ---');
  
  // Start server on dedicated test port
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => resolve());
  });

  const roomId = 'SIMROOM_' + Date.now();

  try {
    // 1. Host joins
    console.log('[Step 1] Host joins room...');
    const host = await createClient('user-host', 'HostAlex', roomId);
    
    let hostStateSyncReceived = false;
    host.on('STATE_SYNC', (data: any) => {
      hostStateSyncReceived = true;
      console.log(`[Host] Received STATE_SYNC. Track: ${data.payload.currentTrackId || '(none)'}, Host: ${data.payload.hostUserId}`);
    });

    let peerReceivedSignalOffer = false;
    let peerJoinedEventReceived = false;
    let hostReceivedSignalAnswer = false;

    // Connect Peer
    console.log('[Step 2] Mobile Peer joins room...');
    const peerSocket = io(`http://localhost:${PORT}`, {
      query: { correlationId: `sim-user-mobile`, roomId, userId: 'user-mobile', username: 'PhoneUser' }
    });

    // Attach peer listener before connect resolves
    peerSocket.on('SIGNAL_OFFER', (data: any) => {
      peerReceivedSignalOffer = true;
      console.log(`[Mobile Peer] Received WebRTC SIGNAL_OFFER from ${data.fromUserId}`);
      // Peer sends WebRTC answer to Host
      peerSocket.emit('SIGNAL_ANSWER', {
        roomId,
        targetUserId: data.fromUserId,
        sdp: { type: 'answer', sdp: 'v=0\r\no=mock-mobile ...' }
      });
    });

    let queueUpdateReceived = false;
    peerSocket.on('STATE_SYNC', (data: any) => {
      if (data.payload.currentTrackId === 'dQw4w9WgXcQ') {
        queueUpdateReceived = true;
        console.log(`[Mobile Peer] Verified current track synced to: ${data.payload.currentTitle}`);
      }
    });

    host.on('SIGNAL_ANSWER', (data: any) => {
      hostReceivedSignalAnswer = true;
      console.log(`[Host] Received WebRTC SIGNAL_ANSWER from ${data.fromUserId}. P2P DataChannel established!`);
    });

    host.on('PEER_JOINED', (data: any) => {
      peerJoinedEventReceived = true;
      console.log(`[Host] Detected PEER_JOINED for WebRTC setup: ${data.peer.username} (${data.peer.userId})`);
      // Host sends WebRTC offer to Peer
      host.emit('SIGNAL_OFFER', {
        roomId,
        targetUserId: data.peer.userId,
        sdp: { type: 'offer', sdp: 'v=0\r\no=mock-host ...' }
      });
    });

    await new Promise<void>((resolve) => {
      peerSocket.on('connect', () => resolve());
    });
    await new Promise(r => setTimeout(r, 400));

    // 3. Mobile Peer adds track to queue
    console.log('[Step 3] Mobile Peer adds track to queue...');
    peerSocket.emit('ROOM_MUTATION', {
      action: 'ROOM_MUTATION',
      version: 1,
      correlationId: 'sim-add-1',
      payload: {
        roomId,
        type: 'QUEUE_ADD',
        timestamp: Date.now(),
        item: {
          videoId: 'dQw4w9WgXcQ',
          title: 'Rick Astley - Never Gonna Give You Up',
          duration: '3:33',
          author: 'RickAstleyVEVO'
        }
      }
    });

    await new Promise(r => setTimeout(r, 400));

    // 4. Host adds second track and tests Spotify Jam upvoting
    console.log('[Step 4] Add second track and test Spotify Jam upvoting...');
    host.emit('ROOM_MUTATION', {
      action: 'ROOM_MUTATION',
      version: 1,
      correlationId: 'sim-add-2',
      payload: {
        roomId,
        type: 'QUEUE_ADD',
        timestamp: Date.now(),
        item: {
          videoId: 'kJQP7kiw5Fk',
          title: 'Luis Fonsi - Despacito',
          duration: '4:42',
          author: 'LuisFonsiVEVO'
        }
      }
    });

    await new Promise(r => setTimeout(r, 400));

    // Mobile upvotes track 2
    peerSocket.emit('ROOM_MUTATION', {
      action: 'ROOM_MUTATION',
      version: 1,
      correlationId: 'sim-upvote-1',
      payload: {
        roomId,
        type: 'QUEUE_UPVOTE',
        videoId: 'kJQP7kiw5Fk',
        timestamp: Date.now()
      }
    });

    await new Promise(r => setTimeout(r, 400));

    // Clean disconnect
    host.disconnect();
    peerSocket.disconnect();
    httpServer.close();

    console.log('\n--- Simulation Results ---');
    console.log(`✓ Host Initial State Sync: ${hostStateSyncReceived}`);
    console.log(`✓ Peer Joined Event: ${peerJoinedEventReceived}`);
    console.log(`✓ WebRTC Signal Offer Relay: ${peerReceivedSignalOffer}`);
    console.log(`✓ WebRTC Signal Answer Relay: ${hostReceivedSignalAnswer}`);
    console.log(`✓ Collaborative Queue Mutation Sync: ${queueUpdateReceived}`);

    if (hostStateSyncReceived && peerJoinedEventReceived && peerReceivedSignalOffer && hostReceivedSignalAnswer && queueUpdateReceived) {
      console.log('\n🎉 ALL MULTI-CLIENT SIMULATION CHECKS PASSED!\n');
      process.exit(0);
    } else {
      console.error('\n❌ SIMULATION VERIFICATION FAILED');
      process.exit(1);
    }
  } catch (err) {
    console.error('Simulation error:', err);
    httpServer.close();
    process.exit(1);
  }
}

runSimulation();
