import { Socket } from 'socket.io';

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

export interface RoomMutation {
  action: 'ROOM_MUTATION';
  version: number;
  correlationId: string;
  payload: {
    roomId: string;
    type: 
      | 'PLAY' 
      | 'PAUSE' 
      | 'SEEK' 
      | 'SKIP' 
      | 'BACK' 
      | 'QUEUE_REORDER' 
      | 'QUEUE_JUMP' 
      | 'ROOM_RESYNC' 
      | 'QUEUE_ADD' 
      | 'QUEUE_REMOVE' 
      | 'QUEUE_CLEAR' 
      | 'QUEUE_SHUFFLE' 
      | 'QUEUE_BATCH_APPEND' 
      | 'QUEUE_UPVOTE'
      | 'SET_PUBLIC' 
      | 'SET_REQUEST_ONLY' 
      | 'SET_DJ_AUTOPLAY'
      | 'APPROVE_REQUEST' 
      | 'DENY_REQUEST' 
      | 'APPROVE_ALL_REQUESTS' 
      | 'DENY_ALL_REQUESTS' 
      | 'UPDATE_IDENTITY' 
      | 'TRANSFER_AUTHORITY' 
      | 'CLAIM_HOST'
      | 'QUEUE_PLAYLIST_REQUEST' 
      | 'SET_TITLE' 
      | 'SET_PEER_STATUS' 
      | 'SET_CHAT_RATE_LIMIT' 
      | 'SET_REPEAT_MODE' 
      | 'TRACK_END';
    playhead?: number;
    currentTrackId?: string;
    currentTitle?: string;
    currentDuration?: string;
    currentAuthor?: string;
    timestamp: number;
    item?: string | QueueItem;
    items?: (string | QueueItem)[];
    index?: number;
    newIndex?: number;
    isPublic?: boolean;
    isRequestOnly?: boolean;
    isDjAutoplayEnabled?: boolean;
    requestId?: string;
    username?: string;
    targetUserId?: string;
    playlistId?: string;
    title?: string;
    isDetached?: boolean;
    chatRateLimit?: { maxTokens: number; intervalMs: number };
    repeatMode?: 'off' | 'track' | 'queue';
    password?: string;
    videoId?: string;
  };
}

export interface StateSync {
  event: 'STATE_SYNC';
  version: number;
  correlationId: string;
  payload: {
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
    pendingRequests?: PendingRequest[];
    peers?: PeerInfo[];
    hostUserId?: string;
    chatRateLimit?: { maxTokens: number; intervalMs: number };
    repeatMode?: 'off' | 'track' | 'queue';
  };
}

export interface ClientToServerEvents {
  ROOM_MUTATION: (data: RoomMutation) => void;
  SEND_MESSAGE: (data: { roomId: string; text: string }) => void;
  // WebRTC P2P Signaling
  SIGNAL_OFFER: (data: { roomId: string; targetUserId: string; sdp: any }) => void;
  SIGNAL_ANSWER: (data: { roomId: string; targetUserId: string; sdp: any }) => void;
  SIGNAL_ICE_CANDIDATE: (data: { roomId: string; targetUserId: string; candidate: any }) => void;
  SIGNAL_PEER_READY: (data: { roomId: string; userId: string }) => void;
}

export interface ServerToClientEvents {
  STATE_SYNC: (data: StateSync) => void;
  HOST_CHANGED: (data: { hostId: string; hostName?: string }) => void;
  ERROR: (data: { message: string }) => void;
  CHAT_RATE_LIMIT_ERROR: (data: { message: string; remainingMs: number }) => void;
  ROOM_MESSAGE: (data: ChatMessage) => void;
  ROSTER_UPDATE: (data: { peers: PeerInfo[] }) => void;
  ROOM_CLOSED: (data: { message: string }) => void;
  // WebRTC P2P Signaling Relay
  SIGNAL_OFFER: (data: { fromUserId: string; fromSocketId: string; sdp: any }) => void;
  SIGNAL_ANSWER: (data: { fromUserId: string; fromSocketId: string; sdp: any }) => void;
  SIGNAL_ICE_CANDIDATE: (data: { fromUserId: string; fromSocketId: string; candidate: any }) => void;
  PEER_JOINED: (data: { peer: PeerInfo }) => void;
  PEER_LEFT: (data: { userId: string }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  username: string;
  roomId: string;
  isDetached?: boolean;
}
