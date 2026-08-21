import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { z } from 'zod';
import logger from './logger';
import yts from 'yt-search';
import { RoomStore } from './room-store';
import { RateLimiter } from './rate-limiter';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  RoomMutation,
  StateSync,
  QueueItem,
  PeerInfo
} from './types';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { 
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 32768 // 32KB limit for rich metadata & signaling SDPs
});

export const roomStore = new RoomStore();
const rateLimiter = new RateLimiter();
const mutationRateLimiter = new RateLimiter();

// Bounded In-Memory LRU Cache with automatic capacity eviction & TTL sweeping
export class BoundedLRUCache<K, V> {
  private cache = new Map<K, { timestamp: number; data: V }>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries: number = 500, ttlMs: number = 15 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: K, data: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { timestamp: Date.now(), data });
  }

  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const searchCache = new BoundedLRUCache<string, any>(500, CACHE_TTL_MS);
const metadataCache = new BoundedLRUCache<string, { title: string; duration?: string; author?: string }>(1000, CACHE_TTL_MS);

// Periodic garbage collection sweep for caches and rate limiters
setInterval(() => {
  searchCache.sweep();
  metadataCache.sweep();
  rateLimiter.sweepStale();
  mutationRateLimiter.sweepStale();
}, 5 * 60 * 1000);

const QueueItemSchema = z.object({
  videoId: z.string().min(1).max(20),
  title: z.string().max(300),
  duration: z.string().optional(),
  author: z.string().optional(),
  addedBy: z.object({
    userId: z.string(),
    username: z.string()
  }).optional(),
  upvotes: z.array(z.string()).optional()
});

const RoomMutationSchema = z.object({
  action: z.literal('ROOM_MUTATION'),
  version: z.number(),
  correlationId: z.string().max(100),
  payload: z.object({
    roomId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    type: z.enum([
      'PLAY', 'PAUSE', 'SEEK', 'SKIP', 'BACK', 'QUEUE_REORDER', 'QUEUE_JUMP', 
      'ROOM_RESYNC', 'QUEUE_ADD', 'QUEUE_REMOVE', 'QUEUE_CLEAR', 'QUEUE_SHUFFLE', 
      'QUEUE_BATCH_APPEND', 'QUEUE_UPVOTE', 'SET_PUBLIC', 'SET_REQUEST_ONLY', 
      'APPROVE_REQUEST', 'DENY_REQUEST', 'APPROVE_ALL_REQUESTS', 'DENY_ALL_REQUESTS', 
      'UPDATE_IDENTITY', 'TRANSFER_AUTHORITY', 'CLAIM_HOST', 'QUEUE_PLAYLIST_REQUEST', 
      'SET_TITLE', 'SET_PEER_STATUS', 'SET_CHAT_RATE_LIMIT', 'SET_REPEAT_MODE', 'SET_DJ_AUTOPLAY', 'TRACK_END'
    ]),
    playhead: z.number().min(0).optional(),
    currentTrackId: z.string().max(30).optional(),
    currentTitle: z.string().max(300).optional(),
    currentDuration: z.string().max(50).optional(),
    currentAuthor: z.string().max(200).optional(),
    timestamp: z.number(),
    item: z.union([z.string(), QueueItemSchema]).optional(),
    items: z.array(z.union([z.string(), QueueItemSchema])).optional(),
    index: z.number().optional(),
    newIndex: z.number().optional(),
    isPublic: z.boolean().optional(),
    isRequestOnly: z.boolean().optional(),
    isDjAutoplayEnabled: z.boolean().optional(),
    requestId: z.string().optional(),
    username: z.string().max(50).optional(),
    targetUserId: z.string().optional(),
    playlistId: z.string().optional(),
    title: z.string().max(100).optional(),
    isDetached: z.boolean().optional(),
    chatRateLimit: z.object({ maxTokens: z.number().min(1), intervalMs: z.number().min(1000) }).optional(),
    repeatMode: z.enum(['off', 'track', 'queue']).optional(),
    password: z.string().optional(),
    videoId: z.string().optional()
  })
});

const SendMessageSchema = z.object({
  roomId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  text: z.string().min(1).max(500)
});

/**
 * Resolve YouTube Video Metadata (Title, Channel, Duration)
 */
export const resolveVideoMetadata = async (videoId: string): Promise<{ title: string; duration?: string; author?: string }> => {
  const cached = metadataCache.get(videoId);
  if (cached) {
    return cached;
  }

  try {
    const searchRes = await yts({ videoId });
    if (searchRes) {
      const data = {
        title: searchRes.title || `YouTube Track (${videoId})`,
        duration: searchRes.timestamp || '',
        author: searchRes.author?.name || ''
      };
      metadataCache.set(videoId, data);
      return data;
    }
  } catch (err) {
    logger.debug({ message: 'yt-search metadata lookup fallback to oembed', videoId });
  }

  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      signal: AbortSignal.timeout(6000)
    });
    if (response.ok) {
      const data = await response.json();
      const resolved = {
        title: data.title || `YouTube Track (${videoId})`,
        author: data.author_name || ''
      };
      metadataCache.set(videoId, resolved);
      return resolved;
    }
  } catch (e) {
    // Ignore fallback failure
  }

  return { title: `YouTube Track (${videoId})` };
};

/**
 * DJ Autoplay Engine: Get recommended track based on current song / artist
 */
export const getDjRecommendation = async (
  title: string, 
  author?: string, 
  playedIds: string[] = []
): Promise<QueueItem | null> => {
  try {
    const query = author ? `${author} songs` : `${title} music`;
    const searchRes = await yts(query);
    if (searchRes && searchRes.videos && searchRes.videos.length > 0) {
      const candidates = searchRes.videos.filter(v => !playedIds.includes(v.videoId));
      const chosen = candidates.length > 0 ? candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))] : searchRes.videos[0];
      if (chosen) {
        return {
          videoId: chosen.videoId,
          title: chosen.title,
          duration: chosen.timestamp,
          author: chosen.author?.name || author || 'Muser DJ',
          addedBy: { userId: 'muser-dj', username: 'Muser DJ 🤖' },
          upvotes: []
        };
      }
    }
  } catch (err) {
    logger.warn({ message: 'DJ Autoplay recommendation lookup failed', title, author, error: err });
  }
  return null;
};

export const extractPlaylistItems = (html: string): QueueItem[] => {
  let items: QueueItem[] = [];
  const jsonMatch = html.match(/(?:var\s+)?ytInitialData\s*=\s*({.*?});(?:<\/script>)?/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const contents = data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
      if (contents) {
        items = contents
          .filter((i: any) => i.playlistVideoRenderer)
          .map((i: any) => ({
            videoId: i.playlistVideoRenderer.videoId,
            title: i.playlistVideoRenderer.title?.runs?.[0]?.text || 'Unknown Title',
            duration: i.playlistVideoRenderer.lengthText?.simpleText || '',
            author: i.playlistVideoRenderer.shortBylineText?.runs?.[0]?.text || ''
          }));
      }
    } catch (e) {
      logger.warn({ message: '[Playlist] JSON extraction failed, checking regex fallback', error: e });
    }
  }

  if (items.length === 0) {
    const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    const matches = Array.from(html.matchAll(videoIdRegex));
    const videoIds = Array.from(new Set(matches.map(m => m[1])));
    items = videoIds.map(id => ({ videoId: id, title: `YouTube Track (${id})` }));
  }
  return items;
};

// Express REST API
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', engine: 'in-memory-p2p', timestamp: new Date().toISOString() });
});

app.get('/api/rooms', (_req, res) => {
  try {
    const rooms = roomStore.getActivePublicRooms();
    res.json({ rooms });
  } catch (err) {
    logger.error({ message: 'Failed to fetch public rooms', error: err });
    res.status(500).json({ error: 'Failed to fetch public rooms' });
  }
});

app.get('/api/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.trim() === '') return res.status(400).json({ error: 'Missing query parameter q' });

  const queryKey = q.trim().toLowerCase();
  const cached = searchCache.get(queryKey);
  if (cached) {
    return res.json({ results: cached });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    if (apiKey) {
      const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(q)}&key=${apiKey}`, {
        headers: { 'Referer': 'https://muser.cuang.dev/' },
        signal: AbortSignal.timeout(8000)
      });
      
      if (!searchRes.ok) throw new Error(`YouTube Search API Error: ${searchRes.statusText}`);
      const searchData = await searchRes.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        searchCache.set(queryKey, []);
        return res.json({ results: [] });
      }

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`, {
        headers: { 'Referer': 'https://muser.cuang.dev/' },
        signal: AbortSignal.timeout(8000)
      });

      let durations: Record<string, string> = {};
      if (videoRes.ok) {
        const videoData = await videoRes.json();
        for (const item of videoData.items) {
          const match = item.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (match) {
            const h = parseInt(match[1] || '0');
            const m = parseInt(match[2] || '0');
            const s = parseInt(match[3] || '0');
            durations[item.id] = h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
          }
        }
      }

      const videos = searchData.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        duration: durations[item.id.videoId] || '',
        author: item.snippet.channelTitle
      }));

      searchCache.set(queryKey, videos);
      return res.json({ results: videos });
    } else {
      const r = await yts(q);
      const videos = r.videos.slice(0, 12).map(v => ({
        videoId: v.videoId,
        title: v.title,
        duration: v.timestamp,
        author: v.author.name
      }));

      searchCache.set(queryKey, videos);
      return res.json({ results: videos });
    }
  } catch (err) {
    logger.error({ message: 'Search failed', query: q, error: err });
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/playlist', async (req, res) => {
  const rawId = req.query.id as string;
  if (!rawId) return res.status(400).json({ error: 'Missing id parameter' });

  const playlistIdMatch = rawId.trim().match(/^([a-zA-Z0-9_-]+)/);
  const playlistId = playlistIdMatch ? playlistIdMatch[1] : rawId.trim();

  try {
    logger.info({ message: '[Playlist] Unrolling playlist', playlistId });
    const response = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error(`YouTube returned status ${response.status}`);
    const html = await response.text();
    const items = extractPlaylistItems(html);

    if (items.length === 0) {
      return res.status(404).json({ error: 'No videos found in this playlist' });
    }

    res.json({ items });
  } catch (err) {
    logger.error({ message: 'Failed to unroll playlist', error: err, playlistId });
    res.status(500).json({ error: 'Failed to resolve YouTube playlist' });
  }
});

const disconnectTimeouts = new Map<string, { timeout: NodeJS.Timeout; oldSocketId: string; roomId: string }>();

export const buildActivePeers = (sockets: any[]): PeerInfo[] => {
  const peersMap: Record<string, PeerInfo> = {};
  for (const s of sockets) {
    const uid = s.data.userId || 'unknown';
    peersMap[uid] = {
      socketId: s.id,
      userId: uid,
      username: s.data.username || uid,
      isDetached: s.data.isDetached || false
    };
  }
  return Object.values(peersMap);
};

export const buildStateSyncPayload = (roomId: string, correlationId: string, state: any, peers: PeerInfo[]): StateSync => ({
  event: 'STATE_SYNC',
  version: 1,
  correlationId,
  payload: {
    roomId,
    title: state.title || roomId,
    isPlaying: state.isPlaying || false,
    currentPlayhead: state.currentPlayhead || 0,
    currentTrackId: state.currentTrackId || '',
    currentTitle: state.currentTitle || '',
    currentDuration: state.currentDuration,
    currentAuthor: state.currentAuthor,
    currentTrackAddedBy: state.currentTrackAddedBy,
    updatedAt: state.updatedAt || Date.now(),
    queue: state.queue || [],
    history: state.history || [],
    isPublic: state.isPublic ?? true,
    isRequestOnly: state.isRequestOnly ?? false,
    isDjAutoplayEnabled: state.isDjAutoplayEnabled ?? false,
    pendingRequests: state.pendingRequests || [],
    peers,
    hostUserId: state.hostUserId,
    chatRateLimit: state.chatRateLimit,
    repeatMode: state.repeatMode || 'off'
  }
});

/**
 * Parse YouTube duration string (e.g. "3:45", "1:02:15") to total seconds
 */
export const parseDurationToSeconds = (durationStr?: string): number => {
  if (!durationStr || durationStr.trim() === '') return 0;
  const parts = durationStr.trim().split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
};

/**
 * Authoritative Server-Side Track Advance (Triggered on track completion or background watchdog timeout)
 */
export const triggerTrackEnd = async (roomId: string) => {
  const room = roomStore.getRawRoom(roomId);
  if (!room) return;

  if (room.watchdogTimer) {
    clearTimeout(room.watchdogTimer);
    room.watchdogTimer = undefined;
  }

  let queue = [...room.queue];
  let history = [...room.history];
  let currentTrackId = room.currentTrackId;
  let currentTitle = room.currentTitle;
  let currentDuration = room.currentDuration;
  let currentAuthor = room.currentAuthor;
  let currentTrackAddedBy = room.currentTrackAddedBy;
  let currentPlayhead = 0;
  let isPlaying = true;
  const repeatMode = room.repeatMode;
  const isDjAutoplayEnabled = room.isDjAutoplayEnabled;

  if (repeatMode === 'track') {
    currentPlayhead = 0;
    isPlaying = true;
  } else {
    if (currentTrackId) {
      history.push({
        videoId: currentTrackId,
        title: currentTitle,
        duration: currentDuration,
        author: currentAuthor,
        addedBy: currentTrackAddedBy,
        status: 'played',
        timestamp: Date.now()
      });
      if (history.length > 30) history = history.slice(-30);

      if (repeatMode === 'queue') {
        queue.push({
          videoId: currentTrackId,
          title: currentTitle,
          duration: currentDuration,
          author: currentAuthor,
          addedBy: currentTrackAddedBy,
          upvotes: []
        });
      }
    }

    if (queue.length > 0) {
      const next = queue.shift()!;
      currentTrackId = next.videoId;
      currentTitle = next.title;
      currentDuration = next.duration;
      currentAuthor = next.author;
      currentTrackAddedBy = next.addedBy;
      currentPlayhead = 0;
      isPlaying = true;
    } else if (isDjAutoplayEnabled && (currentTitle || currentAuthor)) {
      const played = [currentTrackId, ...history.map(h => h.videoId)].filter(Boolean);
      const djTrack = await getDjRecommendation(currentTitle, currentAuthor, played);
      if (djTrack) {
        currentTrackId = djTrack.videoId;
        currentTitle = djTrack.title;
        currentDuration = djTrack.duration;
        currentAuthor = djTrack.author;
        currentTrackAddedBy = djTrack.addedBy;
        currentPlayhead = 0;
        isPlaying = true;
      } else {
        currentTrackId = '';
        currentTitle = '';
        currentDuration = undefined;
        currentAuthor = undefined;
        currentTrackAddedBy = undefined;
        currentPlayhead = 0;
        isPlaying = false;
      }
    } else {
      currentTrackId = '';
      currentTitle = '';
      currentDuration = undefined;
      currentAuthor = undefined;
      currentTrackAddedBy = undefined;
      currentPlayhead = 0;
      isPlaying = false;
    }
  }

  const updatedState = {
    isPlaying,
    currentPlayhead,
    currentTrackId,
    currentTitle,
    currentDuration,
    currentAuthor,
    currentTrackAddedBy,
    title: room.title,
    queue,
    history,
    isPublic: room.isPublic,
    isRequestOnly: room.isRequestOnly,
    isDjAutoplayEnabled: room.isDjAutoplayEnabled,
    pendingRequests: room.pendingRequests,
    chatRateLimit: room.chatRateLimit,
    repeatMode: room.repeatMode,
    hostUserId: room.hostUserId,
    updatedAt: Date.now()
  };

  await roomStore.setState(roomId, updatedState);
  armRoomWatchdog(roomId);

  const socketsInRoom = await io.in(roomId).fetchSockets();
  const activePeers = buildActivePeers(socketsInRoom);

  io.to(roomId).emit('STATE_SYNC', buildStateSyncPayload(roomId, `auto-end-${Date.now()}`, updatedState, activePeers));
};

/**
 * Arm or disarm authoritative background watchdog timer for the active track
 */
export const armRoomWatchdog = (roomId: string) => {
  const room = roomStore.getRawRoom(roomId);
  if (!room) return;

  if (room.watchdogTimer) {
    clearTimeout(room.watchdogTimer);
    room.watchdogTimer = undefined;
  }

  if (!room.isPlaying || !room.currentTrackId || !room.currentDuration) return;

  const totalSec = parseDurationToSeconds(room.currentDuration);
  if (totalSec > 0) {
    const elapsed = (Date.now() - room.updatedAt) / 1000;
    const currentPlayhead = room.currentPlayhead + elapsed;
    const remainingSec = Math.max(1, totalSec - currentPlayhead);

    // 2.5 second buffer for network transit and browser buffering
    const timeoutMs = Math.round((remainingSec + 2.5) * 1000);
    room.watchdogTimer = setTimeout(async () => {
      logger.info({ message: '[Watchdog] Auto-advancing track on duration completion', roomId, trackId: room.currentTrackId });
      await triggerTrackEnd(roomId);
    }, timeoutMs);
  }
};

io.on('connection', async (socket) => {
  const correlation_id = socket.handshake.query.correlationId as string || 'initial';
  const roomId = (socket.handshake.query.roomId as string)?.toUpperCase();
  const userId = socket.handshake.query.userId as string || `user-${socket.id}`;
  let username = socket.handshake.query.username as string || `Guest_${socket.id.substring(0, 4)}`;
  const password = socket.handshake.query.password as string;
  const roomTitle = socket.handshake.query.title as string;

  if (!roomId) {
    socket.disconnect();
    return;
  }

  // Evict stale sockets for the same user
  const existingSockets = await io.in(roomId).fetchSockets();
  for (const existing of existingSockets) {
    if (existing.data.userId === userId && existing.id !== socket.id) {
      logger.info({ message: '[System] Evicting stale socket for user', userId, stale_socket: existing.id, new_socket: socket.id });
      existing.disconnect(true);
    }
  }

  // Suffix duplicate usernames
  let baseName = username.replace(/\s\(\d+\)$/, '');
  let suffix = 1;
  while (existingSockets.some(s => s.data.username === username && s.data.userId !== userId)) {
    username = `${baseName} (${suffix})`;
    suffix++;
  }

  socket.data.roomId = roomId;
  socket.data.userId = userId;
  socket.data.username = username;
  socket.join(roomId);

  const broadcastRosterUpdate = async (rId: string) => {
    const sockets = await io.in(rId).fetchSockets();
    const peers = buildActivePeers(sockets);
    io.to(rId).emit('ROSTER_UPDATE', { peers });
  };

  const broadcastHostChange = async (rId: string, hId: string) => {
    const sockets = await io.in(rId).fetchSockets();
    const hostSocket = sockets.find(s => s.data.userId === hId);
    const hostName = hostSocket?.data.username || hId;
    io.to(rId).emit('HOST_CHANGED', { hostId: hId, hostName });
  };

  let isReconnect = false;
  if (disconnectTimeouts.has(userId)) {
    const entry = disconnectTimeouts.get(userId)!;
    clearTimeout(entry.timeout);
    disconnectTimeouts.delete(userId);
    isReconnect = true;
    logger.info({ message: '[System] Mobile/Device Graceful Reconnect', userId, socketId: socket.id });
  }

  try {
    const { hostId, isNewRoom } = await roomStore.join(roomId, socket.id, userId, username, password, roomTitle);

    if (!isReconnect) {
      io.to(roomId).emit('ROOM_MESSAGE', {
        id: `sys-${Date.now()}`,
        userId: 'system',
        username: 'System',
        text: `${username} joined the session`,
        timestamp: Date.now()
      });
      // Notify other peers for WebRTC P2P initiation
      socket.to(roomId).emit('PEER_JOINED', {
        peer: { socketId: socket.id, userId, username, isDetached: false }
      });
    }

    const state = roomStore.getState(roomId);
    if (state) {
      const sockets = await io.in(roomId).fetchSockets();
      const peers = buildActivePeers(sockets);
      socket.emit('STATE_SYNC', buildStateSyncPayload(roomId, correlation_id, state, peers));
      await broadcastRosterUpdate(roomId);
      await broadcastHostChange(roomId, hostId);
    }
  } catch (err: any) {
    if (err.message === 'INVALID_PASSWORD') {
      socket.emit('ERROR', { message: 'Incorrect room password. Access denied.' });
    } else {
      logger.error({ message: 'Error joining room', error: err, roomId, userId });
      socket.emit('ERROR', { message: 'Failed to join room' });
    }
    socket.disconnect();
    return;
  }

  // --- WebRTC Peer-to-Peer Signaling Handlers ---
  socket.on('SIGNAL_OFFER', async (data) => {
    const sockets = await io.in(data.roomId).fetchSockets();
    const targetSocket = sockets.find(s => s.data.userId === data.targetUserId);
    if (targetSocket) {
      targetSocket.emit('SIGNAL_OFFER', {
        fromUserId: socket.data.userId,
        fromSocketId: socket.id,
        sdp: data.sdp
      });
    }
  });

  socket.on('SIGNAL_ANSWER', async (data) => {
    const sockets = await io.in(data.roomId).fetchSockets();
    const targetSocket = sockets.find(s => s.data.userId === data.targetUserId);
    if (targetSocket) {
      targetSocket.emit('SIGNAL_ANSWER', {
        fromUserId: socket.data.userId,
        fromSocketId: socket.id,
        sdp: data.sdp
      });
    }
  });

  socket.on('SIGNAL_ICE_CANDIDATE', async (data) => {
    const sockets = await io.in(data.roomId).fetchSockets();
    const targetSocket = sockets.find(s => s.data.userId === data.targetUserId);
    if (targetSocket) {
      targetSocket.emit('SIGNAL_ICE_CANDIDATE', {
        fromUserId: socket.data.userId,
        fromSocketId: socket.id,
        candidate: data.candidate
      });
    }
  });

  socket.on('SIGNAL_PEER_READY', (data) => {
    socket.to(data.roomId).emit('PEER_JOINED', {
      peer: {
        socketId: socket.id,
        userId: socket.data.userId,
        username: socket.data.username,
        isDetached: socket.data.isDetached
      }
    });
  });

  // --- Room Mutation Handler ---
  socket.on('ROOM_MUTATION', async (data) => {
    const parsed = RoomMutationSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn({ message: 'Invalid ROOM_MUTATION payload', error: parsed.error, data });
      return;
    }

    const mutation = parsed.data as RoomMutation;
    const rId = mutation.payload.roomId;

    const rateCheck = mutationRateLimiter.consume(socket.id, 25, 1000);
    if (!rateCheck.allowed) {
      socket.emit('ERROR', { message: 'Too many actions. Please slow down.' });
      return;
    }

    let state = roomStore.getState(rId);
    if (!state) {
      socket.emit('ERROR', { message: 'Room not found.' });
      return;
    }

    // Host authority check
    const hostOnlyActions = [
      'PLAY', 'PAUSE', 'SEEK', 'SKIP', 'BACK', 'QUEUE_REORDER', 
      'QUEUE_JUMP', 'QUEUE_CLEAR', 'QUEUE_SHUFFLE', 'SET_REPEAT_MODE', 'TRACK_END'
    ];
    if (hostOnlyActions.includes(mutation.payload.type) && state.hostUserId !== socket.data.userId) {
      socket.emit('ERROR', { message: `Permission Denied: Only host can perform ${mutation.payload.type}` });
      return;
    }

    // Calculate live virtual playhead progression based on elapsed real-time
    const computedVirtualPlayhead = state.isPlaying
      ? state.currentPlayhead + (Date.now() - state.updatedAt) / 1000
      : state.currentPlayhead;

    let isPlaying = state.isPlaying;
    let currentPlayhead = mutation.payload.playhead ?? computedVirtualPlayhead;
    let currentTrackId = mutation.payload.currentTrackId ?? state.currentTrackId;
    let currentTitle = mutation.payload.currentTitle ?? state.currentTitle;
    let currentDuration = mutation.payload.currentDuration ?? state.currentDuration;
    let currentAuthor = mutation.payload.currentAuthor ?? state.currentAuthor;
    let currentTrackAddedBy = state.currentTrackAddedBy;
    let title = mutation.payload.title ?? state.title;
    let queue = [...state.queue];
    let history = [...state.history];
    let isPublic = state.isPublic;
    let isRequestOnly = state.isRequestOnly;
    let isDjAutoplayEnabled = state.isDjAutoplayEnabled;
    let pendingRequests = [...state.pendingRequests];
    let chatRateLimit = state.chatRateLimit;
    let repeatMode = state.repeatMode;

    switch (mutation.payload.type) {
      case 'PLAY':
        isPlaying = true;
        break;
      case 'PAUSE':
        isPlaying = false;
        break;
      case 'SEEK':
        currentPlayhead = mutation.payload.playhead ?? currentPlayhead;
        break;
      case 'SET_PUBLIC':
        if (mutation.payload.isPublic !== undefined) isPublic = mutation.payload.isPublic;
        break;
      case 'SET_REQUEST_ONLY':
        if (mutation.payload.isRequestOnly !== undefined) isRequestOnly = mutation.payload.isRequestOnly;
        break;
      case 'SET_DJ_AUTOPLAY':
        if (mutation.payload.isDjAutoplayEnabled !== undefined) isDjAutoplayEnabled = mutation.payload.isDjAutoplayEnabled;
        break;
      case 'SET_TITLE':
        if (mutation.payload.title) title = mutation.payload.title;
        break;
      case 'SET_CHAT_RATE_LIMIT':
        if (mutation.payload.chatRateLimit) chatRateLimit = mutation.payload.chatRateLimit;
        break;
      case 'SET_REPEAT_MODE':
        if (mutation.payload.repeatMode) repeatMode = mutation.payload.repeatMode;
        break;
      case 'SET_PEER_STATUS':
        if (mutation.payload.isDetached !== undefined) {
          socket.data.isDetached = mutation.payload.isDetached;
          await broadcastRosterUpdate(rId);
          return;
        }
        break;
      case 'QUEUE_SHUFFLE':
        for (let i = queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        break;
      case 'QUEUE_CLEAR':
        queue = [];
        break;
      case 'QUEUE_REMOVE':
        if (mutation.payload.index !== undefined && mutation.payload.index >= 0) {
          queue.splice(mutation.payload.index, 1);
        }
        break;
      case 'QUEUE_REORDER':
        if (mutation.payload.index !== undefined && mutation.payload.newIndex !== undefined) {
          const [moved] = queue.splice(mutation.payload.index, 1);
          if (moved) queue.splice(mutation.payload.newIndex, 0, moved);
        }
        break;
      case 'QUEUE_UPVOTE':
        if (mutation.payload.videoId) {
          const upvoteRes = roomStore.upvoteTrack(rId, mutation.payload.videoId, socket.data.userId);
          if (upvoteRes.success) queue = upvoteRes.queue;
        }
        break;
      case 'QUEUE_ADD':
        if (mutation.payload.item) {
          let itemObj: QueueItem;
          if (typeof mutation.payload.item === 'string') {
            const meta = await resolveVideoMetadata(mutation.payload.item);
            itemObj = {
              videoId: mutation.payload.item,
              title: meta.title,
              duration: meta.duration,
              author: meta.author,
              addedBy: { userId: socket.data.userId, username: socket.data.username },
              upvotes: []
            };
          } else {
            itemObj = {
              ...mutation.payload.item,
              addedBy: mutation.payload.item.addedBy || { userId: socket.data.userId, username: socket.data.username },
              upvotes: mutation.payload.item.upvotes || []
            };
          }

          if (isRequestOnly && socket.data.userId !== state.hostUserId) {
            pendingRequests.push({
              id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              trackId: itemObj.videoId,
              title: itemObj.title,
              duration: itemObj.duration,
              author: itemObj.author,
              username: socket.data.username,
              userId: socket.data.userId
            });
            socket.emit('ERROR', { message: 'Track submitted for host approval.' });
          } else {
            if (!currentTrackId || currentTrackId === '') {
              currentTrackId = itemObj.videoId;
              currentTitle = itemObj.title;
              currentDuration = itemObj.duration;
              currentAuthor = itemObj.author;
              currentTrackAddedBy = itemObj.addedBy;
              currentPlayhead = 0;
              isPlaying = true;
            } else {
              if (mutation.payload.index !== undefined && mutation.payload.index >= 0) {
                queue.splice(mutation.payload.index, 0, itemObj);
              } else {
                queue.push(itemObj);
              }
            }
          }
        }
        break;
      case 'QUEUE_BATCH_APPEND':
        if (mutation.payload.items && mutation.payload.items.length > 0) {
          const normalized: QueueItem[] = mutation.payload.items.map(i => {
            if (typeof i === 'string') {
              return {
                videoId: i,
                title: `YouTube Track (${i})`,
                addedBy: { userId: socket.data.userId, username: socket.data.username },
                upvotes: []
              };
            }
            return {
              ...i,
              addedBy: i.addedBy || { userId: socket.data.userId, username: socket.data.username },
              upvotes: i.upvotes || []
            };
          });

          if (isRequestOnly && socket.data.userId !== state.hostUserId) {
            normalized.forEach(item => {
              pendingRequests.push({
                id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                trackId: item.videoId,
                title: item.title,
                duration: item.duration,
                author: item.author,
                username: socket.data.username,
                userId: socket.data.userId
              });
            });
            socket.emit('ERROR', { message: 'Playlist submitted for host approval.' });
          } else {
            if (!currentTrackId || currentTrackId === '') {
              const [first, ...rest] = normalized;
              currentTrackId = first.videoId;
              currentTitle = first.title;
              currentDuration = first.duration;
              currentAuthor = first.author;
              currentTrackAddedBy = first.addedBy;
              currentPlayhead = 0;
              isPlaying = true;
              queue = queue.concat(rest);
            } else {
              queue = queue.concat(normalized);
            }
          }
        }
        break;
      case 'QUEUE_PLAYLIST_REQUEST':
        if (mutation.payload.playlistId) {
          try {
            const resp = await fetch(`https://www.youtube.com/playlist?list=${mutation.payload.playlistId}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
              }
            });
            if (resp.ok) {
              const html = await resp.text();
              const items = extractPlaylistItems(html).map(i => ({
                ...i,
                addedBy: { userId: socket.data.userId, username: socket.data.username },
                upvotes: []
              }));

              if (items.length > 0) {
                if (isRequestOnly && socket.data.userId !== state.hostUserId) {
                  items.forEach(i => {
                    pendingRequests.push({
                      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      trackId: i.videoId,
                      title: i.title,
                      duration: i.duration,
                      author: i.author,
                      username: socket.data.username,
                      userId: socket.data.userId
                    });
                  });
                  socket.emit('ERROR', { message: 'Playlist submitted for host approval.' });
                } else {
                  if (!currentTrackId || currentTrackId === '') {
                    const [first, ...rest] = items;
                    currentTrackId = first.videoId;
                    currentTitle = first.title;
                    currentDuration = first.duration;
                    currentAuthor = first.author;
                    currentTrackAddedBy = first.addedBy;
                    currentPlayhead = 0;
                    isPlaying = true;
                    queue = queue.concat(rest);
                  } else {
                    queue = queue.concat(items);
                  }
                }
              }
            }
          } catch (e) {
            logger.error({ message: 'Playlist unroll failed', error: e });
          }
        }
        break;
      case 'APPROVE_REQUEST':
        if (socket.data.userId === state.hostUserId && mutation.payload.requestId) {
          const reqIdx = pendingRequests.findIndex(r => r.id === mutation.payload.requestId);
          if (reqIdx !== -1) {
            const [req] = pendingRequests.splice(reqIdx, 1);
            const itemObj: QueueItem = {
              videoId: req.trackId,
              title: req.title,
              duration: req.duration,
              author: req.author,
              addedBy: { userId: req.userId, username: req.username },
              upvotes: []
            };
            if (!currentTrackId || currentTrackId === '') {
              currentTrackId = itemObj.videoId;
              currentTitle = itemObj.title;
              currentDuration = itemObj.duration;
              currentAuthor = itemObj.author;
              currentTrackAddedBy = itemObj.addedBy;
              currentPlayhead = 0;
              isPlaying = true;
            } else {
              queue.push(itemObj);
            }
          }
        }
        break;
      case 'DENY_REQUEST':
        if (socket.data.userId === state.hostUserId && mutation.payload.requestId) {
          pendingRequests = pendingRequests.filter(r => r.id !== mutation.payload.requestId);
        }
        break;
      case 'APPROVE_ALL_REQUESTS':
        if (socket.data.userId === state.hostUserId && pendingRequests.length > 0) {
          const batch = pendingRequests.map(req => ({
            videoId: req.trackId,
            title: req.title,
            duration: req.duration,
            author: req.author,
            addedBy: { userId: req.userId, username: req.username },
            upvotes: []
          }));
          pendingRequests = [];
          if (!currentTrackId || currentTrackId === '') {
            const [first, ...rest] = batch;
            currentTrackId = first.videoId;
            currentTitle = first.title;
            currentDuration = first.duration;
            currentAuthor = first.author;
            currentTrackAddedBy = first.addedBy;
            currentPlayhead = 0;
            isPlaying = true;
            queue = queue.concat(rest);
          } else {
            queue = queue.concat(batch);
          }
        }
        break;
      case 'DENY_ALL_REQUESTS':
        if (socket.data.userId === state.hostUserId) {
          pendingRequests = [];
        }
        break;
      case 'TRANSFER_AUTHORITY':
        if (socket.data.userId === state.hostUserId && mutation.payload.targetUserId) {
          const targetId = mutation.payload.targetUserId;
          const sockets = await io.in(rId).fetchSockets();
          const targetSock = sockets.find(s => s.id === targetId || s.data.userId === targetId);
          if (targetSock) {
            await roomStore.setHost(rId, targetSock.data.userId);
            state.hostUserId = targetSock.data.userId;
            await broadcastHostChange(rId, targetSock.data.userId);
          }
        }
        break;
      case 'CLAIM_HOST':
        const claimed = await roomStore.claimHost(rId, socket.data.userId, mutation.payload.password);
        if (claimed) {
          state.hostUserId = socket.data.userId;
          await broadcastHostChange(rId, socket.data.userId);
        } else {
          socket.emit('ERROR', { message: 'Invalid room password to claim host.' });
          return;
        }
        break;
      case 'SKIP':
      case 'TRACK_END':
        const isEnded = mutation.payload.type === 'TRACK_END';
        if (repeatMode === 'track' && isEnded) {
          currentPlayhead = 0;
          isPlaying = true;
        } else {
          if (currentTrackId) {
            history.push({
              videoId: currentTrackId,
              title: currentTitle,
              duration: currentDuration,
              author: currentAuthor,
              addedBy: currentTrackAddedBy,
              status: 'played',
              timestamp: Date.now()
            });
            if (history.length > 30) history = history.slice(-30);

            if (repeatMode === 'queue') {
              queue.push({
                videoId: currentTrackId,
                title: currentTitle,
                duration: currentDuration,
                author: currentAuthor,
                addedBy: currentTrackAddedBy,
                upvotes: []
              });
            }
          }

          if (queue.length > 0) {
            const next = queue.shift()!;
            currentTrackId = next.videoId;
            currentTitle = next.title;
            currentDuration = next.duration;
            currentAuthor = next.author;
            currentTrackAddedBy = next.addedBy;
            currentPlayhead = 0;
            isPlaying = true;
          } else if (isDjAutoplayEnabled && (currentTitle || currentAuthor)) {
            const played = [currentTrackId, ...history.map(h => h.videoId)].filter(Boolean);
            const djTrack = await getDjRecommendation(currentTitle, currentAuthor, played);
            if (djTrack) {
              currentTrackId = djTrack.videoId;
              currentTitle = djTrack.title;
              currentDuration = djTrack.duration;
              currentAuthor = djTrack.author;
              currentTrackAddedBy = djTrack.addedBy;
              currentPlayhead = 0;
              isPlaying = true;
            } else {
              currentTrackId = '';
              currentTitle = '';
              currentDuration = undefined;
              currentAuthor = undefined;
              currentTrackAddedBy = undefined;
              currentPlayhead = 0;
              isPlaying = false;
            }
          } else {
            currentTrackId = '';
            currentTitle = '';
            currentDuration = undefined;
            currentAuthor = undefined;
            currentTrackAddedBy = undefined;
            currentPlayhead = 0;
            isPlaying = false;
          }
        }
        break;
      case 'QUEUE_JUMP':
        if (mutation.payload.index !== undefined && mutation.payload.index >= 0 && mutation.payload.index < queue.length) {
          if (currentTrackId) {
            history.push({
              videoId: currentTrackId,
              title: currentTitle,
              duration: currentDuration,
              author: currentAuthor,
              addedBy: currentTrackAddedBy,
              status: 'skipped',
              timestamp: Date.now()
            });
          }
          const preceding = queue.splice(0, mutation.payload.index + 1);
          const target = preceding.pop()!;
          preceding.forEach(i => {
            history.push({
              videoId: i.videoId,
              title: i.title,
              duration: i.duration,
              author: i.author,
              addedBy: i.addedBy,
              status: 'skipped',
              timestamp: Date.now()
            });
          });

          currentTrackId = target.videoId;
          currentTitle = target.title;
          currentDuration = target.duration;
          currentAuthor = target.author;
          currentTrackAddedBy = target.addedBy;
          currentPlayhead = 0;
          isPlaying = true;

          if (history.length > 30) history = history.slice(-30);
        }
        break;
      case 'BACK':
        if (history.length > 0) {
          if (currentTrackId) {
            queue.unshift({
              videoId: currentTrackId,
              title: currentTitle,
              duration: currentDuration,
              author: currentAuthor,
              addedBy: currentTrackAddedBy,
              upvotes: []
            });
          }
          const prev = history.pop()!;
          currentTrackId = prev.videoId;
          currentTitle = prev.title;
          currentDuration = prev.duration;
          currentAuthor = prev.author;
          currentTrackAddedBy = prev.addedBy;
          currentPlayhead = 0;
          isPlaying = true;
        }
        break;
    }

    const updatedState = {
      isPlaying,
      currentPlayhead,
      currentTrackId,
      currentTitle,
      currentDuration,
      currentAuthor,
      currentTrackAddedBy,
      title,
      queue,
      history,
      isPublic,
      isRequestOnly,
      isDjAutoplayEnabled,
      pendingRequests,
      chatRateLimit,
      repeatMode,
      hostUserId: state.hostUserId,
      updatedAt: Date.now()
    };

    await roomStore.setState(rId, updatedState);
    armRoomWatchdog(rId);

    const socketsInRoom = await io.in(rId).fetchSockets();
    const activePeers = buildActivePeers(socketsInRoom);

    io.to(rId).emit('STATE_SYNC', buildStateSyncPayload(rId, mutation.correlationId, updatedState, activePeers));
  });

  socket.on('SEND_MESSAGE', async (data) => {
    const result = SendMessageSchema.safeParse(data);
    if (!result.success) return;

    const payload = result.data;
    const state = roomStore.getState(payload.roomId);

    const rateCheck = rateLimiter.consume(socket.id, state?.chatRateLimit?.maxTokens, state?.chatRateLimit?.intervalMs);
    if (!rateCheck.allowed) {
      socket.emit('CHAT_RATE_LIMIT_ERROR', { 
        message: `Chat rate limit exceeded. Timed out for ${Math.ceil(rateCheck.remainingMs / 1000)}s.`,
        remainingMs: rateCheck.remainingMs
      });
      return;
    }

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      userId: socket.data.userId,
      username: socket.data.username,
      text: payload.text,
      timestamp: Date.now()
    };

    io.to(payload.roomId).emit('ROOM_MESSAGE', message);
  });

  socket.on('disconnect', async (reason) => {
    const rId = socket.data.roomId;
    const uId = socket.data.userId;
    rateLimiter.cleanup(socket.id);
    mutationRateLimiter.cleanup(socket.id);

    if (rId && uId) {
      // 15-second grace period for mobile reconnection / screen wake
      const timeout = setTimeout(async () => {
        disconnectTimeouts.delete(uId);
        try {
          const state = roomStore.getState(rId);
          if (!state) return;

          const isHost = state.hostUserId === uId;
          const { newHostId, roomDeleted } = await roomStore.leave(rId, uId);

          if (!roomDeleted) {
            io.to(rId).emit('ROOM_MESSAGE', {
              id: `sys-${Date.now()}`,
              userId: 'system',
              username: 'System',
              text: `${socket.data.username} left the session`,
              timestamp: Date.now()
            });

            io.to(rId).emit('PEER_LEFT', { userId: uId });
            await broadcastRosterUpdate(rId);

            if (isHost && newHostId) {
              await broadcastHostChange(rId, newHostId);
              const sockets = await io.in(rId).fetchSockets();
              const peers = buildActivePeers(sockets);
              const freshState = roomStore.getState(rId);
              if (freshState) {
                io.to(rId).emit('STATE_SYNC', buildStateSyncPayload(rId, 'host-migration', freshState, peers));
              }
            }
          }
        } catch (err) {
          logger.error({ message: 'Error handling disconnect', error: err, socketId: socket.id });
        }
      }, 15000);

      disconnectTimeouts.set(uId, { timeout, oldSocketId: socket.id, roomId: rId });
    }
  });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    logger.info({ message: `🚀 Muser P2P Sync Server listening on port ${PORT} (Zero-Redis)` });
  });
}

export { app, httpServer, io };
