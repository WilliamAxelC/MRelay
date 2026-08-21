import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, roomStore } from './index';

const TEST_PORT = 3088;

describe('API Endpoints', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('GET /health returns OK and in-memory engine status', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.engine).toBe('in-memory-p2p');
  });

  it('GET /api/rooms returns public rooms', async () => {
    await roomStore.join('APITEST_ROOM', 's1', 'u1', 'Tester', undefined, 'API Test Room');
    const res = await fetch(`http://localhost:${TEST_PORT}/api/rooms`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.rooms)).toBe(true);
    expect(data.rooms.some((r: any) => r.roomId === 'APITEST_ROOM')).toBe(true);
  });

  it('GET /api/search returns results or 400 for empty query', async () => {
    const resEmpty = await fetch(`http://localhost:${TEST_PORT}/api/search`);
    expect(resEmpty.status).toBe(400);

    const resSearch = await fetch(`http://localhost:${TEST_PORT}/api/search?q=lofi`);
    expect(resSearch.status).toBe(200);
    const data = await resSearch.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0]).toHaveProperty('videoId');
    expect(data.results[0]).toHaveProperty('title');
  });
});
