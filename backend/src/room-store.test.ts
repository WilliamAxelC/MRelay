import { describe, it, expect, beforeEach } from 'vitest';
import { RoomStore } from './room-store';

describe('RoomStore', () => {
  let store: RoomStore;

  beforeEach(() => {
    store = new RoomStore();
  });

  it('creates a new room and assigns first joiner as host', async () => {
    const { hostId, isNewRoom } = await store.join('ROOM1', 'socket-1', 'user-1', 'Alice', undefined, 'Alice Room');
    expect(isNewRoom).toBe(true);
    expect(hostId).toBe('user-1');

    const state = store.getState('ROOM1');
    expect(state).not.toBeNull();
    expect(state?.hostUserId).toBe('user-1');
    expect(state?.title).toBe('Alice Room');
    expect(state?.joinOrder).toHaveLength(1);
  });

  it('preserves host when second peer joins', async () => {
    await store.join('ROOM1', 'socket-1', 'user-1', 'Alice');
    const { hostId, isNewRoom } = await store.join('ROOM1', 'socket-2', 'user-2', 'Bob');

    expect(isNewRoom).toBe(false);
    expect(hostId).toBe('user-1');

    const state = store.getState('ROOM1');
    expect(state?.joinOrder).toHaveLength(2);
  });

  it('enforces room password if set', async () => {
    await store.join('ROOM_SECURE', 'socket-1', 'user-1', 'Alice', 'secret123');

    // Joining with wrong password throws error
    await expect(
      store.join('ROOM_SECURE', 'socket-2', 'user-2', 'Bob', 'wrongpassword')
    ).rejects.toThrow('INVALID_PASSWORD');

    // Joining with correct password succeeds
    const result = await store.join('ROOM_SECURE', 'socket-2', 'user-2', 'Bob', 'secret123');
    expect(result.hostId).toBe('user-1');
  });

  it('migrates host to next user when host leaves', async () => {
    await store.join('ROOM1', 'socket-1', 'user-1', 'Alice');
    await store.join('ROOM1', 'socket-2', 'user-2', 'Bob');
    await store.join('ROOM1', 'socket-3', 'user-3', 'Charlie');

    const { newHostId, roomDeleted } = await store.leave('ROOM1', 'user-1');
    expect(roomDeleted).toBe(false);
    expect(newHostId).toBe('user-2');

    const state = store.getState('ROOM1');
    expect(state?.hostUserId).toBe('user-2');
    expect(state?.joinOrder.map(j => j.userId)).toEqual(['user-2', 'user-3']);
  });

  it('handles track upvoting and automatic queue re-sorting', async () => {
    await store.join('ROOM1', 'socket-1', 'user-1', 'Alice');
    await store.setState('ROOM1', {
      queue: [
        { videoId: 'vid1', title: 'Track 1', upvotes: [] },
        { videoId: 'vid2', title: 'Track 2', upvotes: [] },
        { videoId: 'vid3', title: 'Track 3', upvotes: [] }
      ]
    });

    // User 2 upvotes vid3
    const res1 = store.upvoteTrack('ROOM1', 'vid3', 'user-2');
    expect(res1.success).toBe(true);
    // vid3 should move to the top of the queue with 1 upvote
    expect(res1.queue[0].videoId).toBe('vid3');
    expect(res1.queue[0].upvotes).toContain('user-2');

    // User 1 also upvotes vid3
    const res2 = store.upvoteTrack('ROOM1', 'vid3', 'user-1');
    expect(res2.queue[0].videoId).toBe('vid3');
    expect(res2.queue[0].upvotes).toHaveLength(2);

    // User 2 toggles upvote off for vid3
    const res3 = store.upvoteTrack('ROOM1', 'vid3', 'user-2');
    expect(res3.queue[0].upvotes).toEqual(['user-1']);
  });

  it('manages DJ Autoplay radio and repeat modes', async () => {
    await store.join('ROOM1', 'socket-1', 'user-1', 'Alice');
    
    // Toggle DJ autoplay
    await store.setState('ROOM1', { isDjAutoplayEnabled: true, repeatMode: 'track' });
    let state = store.getState('ROOM1');
    expect(state?.isDjAutoplayEnabled).toBe(true);
    expect(state?.repeatMode).toBe('track');

    // Cycle repeat mode to queue
    await store.setState('ROOM1', { repeatMode: 'queue' });
    state = store.getState('ROOM1');
    expect(state?.repeatMode).toBe('queue');
  });

  it('lists active public rooms with user counts', async () => {
    await store.join('PUBLIC1', 's1', 'u1', 'Alice', undefined, 'Chill Vibes');
    await store.join('PUBLIC1', 's2', 'u2', 'Bob');
    await store.join('PUBLIC2', 's3', 'u3', 'Charlie', undefined, 'Rock Classics');

    const publicRooms = store.getActivePublicRooms();
    expect(publicRooms).toHaveLength(2);
    expect(publicRooms.find(r => r.roomId === 'PUBLIC1')?.userCount).toBe(2);
    expect(publicRooms.find(r => r.roomId === 'PUBLIC2')?.userCount).toBe(1);
  });
});
