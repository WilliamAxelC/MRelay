import logger from './logger';
import { QueueItem, HistoryItem, PendingRequest, PeerInfo } from './types';

export interface RoomRecord {
  roomId: string;
  title: string;
  password?: string;
  hostUserId: string;
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
  isPublic: boolean;
  isRequestOnly: boolean;
  isDjAutoplayEnabled?: boolean;
  isMasterAudioOnly?: boolean;
  pendingRequests: PendingRequest[];
  chatRateLimit?: { maxTokens: number; intervalMs: number };
  repeatMode: 'off' | 'track' | 'queue';
  joinOrder: { userId: string; joinedAt: number }[];
  decayTimer?: NodeJS.Timeout;
  watchdogTimer?: NodeJS.Timeout;
}

export class RoomStore {
  private rooms: Map<string, RoomRecord> = new Map();
  private readonly EMPTY_ROOM_DECAY_MS = 10 * 60 * 1000; // 10 minutes decay when room is empty

  /**
   * Join a room. Creates the room if it doesn't exist.
   * Throws 'INVALID_PASSWORD' if room has a password and password doesn't match.
   */
  async join(
    roomId: string, 
    socketId: string, 
    userId: string, 
    username: string, 
    password?: string, 
    title?: string
  ): Promise<{ hostId: string; isNewRoom: boolean }> {
    let room = this.rooms.get(roomId);
    const now = Date.now();

    if (!room) {
      // Create new room in memory
      room = {
        roomId,
        title: title || roomId,
        password: password && password.trim() !== '' ? password.trim() : undefined,
        hostUserId: userId,
        isPlaying: false,
        currentPlayhead: 0,
        currentTrackId: '',
        currentTitle: '',
        updatedAt: now,
        queue: [],
        history: [],
        isPublic: true,
        isRequestOnly: false,
        isDjAutoplayEnabled: false,
        pendingRequests: [],
        repeatMode: 'off',
        joinOrder: [{ userId, joinedAt: now }]
      };
      this.rooms.set(roomId, room);
      logger.info({ message: '[RoomStore] Created new room', roomId, hostUserId: userId });
      return { hostId: userId, isNewRoom: true };
    }

    // Cancel decay timer if active
    if (room.decayTimer) {
      clearTimeout(room.decayTimer);
      room.decayTimer = undefined;
    }

    // Password validation
    if (room.password && room.password !== password) {
      throw new Error('INVALID_PASSWORD');
    }

    // Add user to join order if not present
    const existingIndex = room.joinOrder.findIndex(j => j.userId === userId);
    if (existingIndex === -1) {
      room.joinOrder.push({ userId, joinedAt: now });
    }

    // If host is empty or invalid, assign current user
    if (!room.hostUserId || room.hostUserId === '') {
      room.hostUserId = userId;
    }

    return { hostId: room.hostUserId, isNewRoom: false };
  }

  /**
   * Leave a room. Migrates host to the next user in joinOrder or schedules room decay.
   */
  async leave(roomId: string, userId: string): Promise<{ newHostId: string | null; roomDeleted: boolean }> {
    const room = this.rooms.get(roomId);
    if (!room) return { newHostId: null, roomDeleted: true };

    // Remove user from joinOrder
    room.joinOrder = room.joinOrder.filter(j => j.userId !== userId);

    if (room.joinOrder.length === 0) {
      // Room is empty, start decay timer
      if (room.decayTimer) clearTimeout(room.decayTimer);
      room.decayTimer = setTimeout(() => {
        this.rooms.delete(roomId);
        logger.info({ message: '[RoomStore] Decayed and reclaimed empty room', roomId });
      }, this.EMPTY_ROOM_DECAY_MS);

      return { newHostId: null, roomDeleted: false };
    }

    // If leaving user was host, elect next earliest joined user
    let newHostId = room.hostUserId;
    if (room.hostUserId === userId) {
      newHostId = room.joinOrder[0].userId;
      room.hostUserId = newHostId;
      room.updatedAt = Date.now();
      logger.info({ message: '[RoomStore] Host migrated on leave', roomId, newHostId });
    }

    return { newHostId, roomDeleted: false };
  }

  /**
   * Set or transfer host authority
   */
  async setHost(roomId: string, userId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.hostUserId = userId;
    room.updatedAt = Date.now();
    return true;
  }

  /**
   * Verify password to claim host
   */
  async claimHost(roomId: string, userId: string, password?: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.password && room.password !== password) return false;
    room.hostUserId = userId;
    room.updatedAt = Date.now();
    return true;
  }

  /**
   * Get full state of a room
   */
  getState(roomId: string): RoomRecord | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return { ...room };
  }

  /**
   * Get raw room reference for timers
   */
  getRawRoom(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Update mutable room state
   */
  async setState(roomId: string, partial: Partial<RoomRecord>): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    Object.assign(room, partial);
    room.updatedAt = Date.now();
  }

  /**
   * Toggle track upvote for collaborative queue
   */
  upvoteTrack(roomId: string, videoId: string, userId: string): { success: boolean; queue: QueueItem[] } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, queue: [] };

    const item = room.queue.find(q => q.videoId === videoId);
    if (!item) return { success: false, queue: room.queue };

    const upvotes = new Set(item.upvotes || []);
    if (upvotes.has(userId)) {
      upvotes.delete(userId);
    } else {
      upvotes.add(userId);
    }
    item.upvotes = Array.from(upvotes);

    // Sort queue by upvotes descending, preserving relative order for equal upvotes
    room.queue.sort((a, b) => {
      const votesA = (a.upvotes || []).length;
      const votesB = (b.upvotes || []).length;
      return votesB - votesA;
    });

    room.updatedAt = Date.now();
    return { success: true, queue: room.queue };
  }

  /**
   * Get all active public rooms
   */
  getActivePublicRooms(): { roomId: string; title: string; userCount: number; currentTitle?: string; currentTrackId?: string; updatedAt: number }[] {
    const results = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.isPublic && room.joinOrder.length > 0) {
        results.push({
          roomId,
          title: room.title || roomId,
          userCount: room.joinOrder.length,
          currentTitle: room.currentTitle || undefined,
          currentTrackId: room.currentTrackId || undefined,
          updatedAt: room.updatedAt
        });
      }
    }
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Directly delete a room (e.g. host closes room)
   */
  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room?.decayTimer) clearTimeout(room.decayTimer);
    if (room?.watchdogTimer) clearTimeout(room.watchdogTimer);
    this.rooms.delete(roomId);
  }

  /**
   * Reset store (used in test suites)
   */
  clearAll(): void {
    for (const room of this.rooms.values()) {
      if (room.decayTimer) clearTimeout(room.decayTimer);
      if (room.watchdogTimer) clearTimeout(room.watchdogTimer);
    }
    this.rooms.clear();
  }
}
