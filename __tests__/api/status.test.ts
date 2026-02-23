import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/client/status/route';
import { NextRequest } from 'next/server';
import { verifySession, verifyHomelabKey } from '@/lib/backend/auth';
import { getLocalClient } from '@/lib/backend/convex';
import { api } from '@/convex/_generated/api';

vi.mock('@/lib/backend/auth');
vi.mock('@/lib/backend/convex');
vi.mock('@/lib/backend/config', () => ({
  config: { isProd: true }
}));
vi.mock('@/convex/_generated/api', () => ({
  api: {
    studySessions: { getActive: 'ss:active' },
    variables: { getByKey: 'vars:get' },
    logs: { getBySession: 'logs:get', create: 'logs:create' },
  },
}));

describe('GET /api/client/status', () => {
  const mockLocal = {
    query: vi.fn(),
    mutation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalClient).mockReturnValue(mockLocal as unknown as ReturnType<typeof getLocalClient>);
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(verifySession).mockResolvedValue(false);
    vi.mocked(verifyHomelabKey).mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/client/status');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns data when authorized', async () => {
    vi.mocked(verifySession).mockResolvedValue(true);
    mockLocal.query.mockResolvedValueOnce({ _id: 's1', _creationTime: Date.now(), status: 'active' }); // session
    mockLocal.query.mockResolvedValueOnce({ value: { timestamp: new Date().toISOString() } }); // heartbeat
    mockLocal.query.mockResolvedValueOnce(null); // summary
    mockLocal.query.mockResolvedValueOnce(null); // blocklist
    mockLocal.query.mockResolvedValue([]); // logs

    const req = new NextRequest('http://localhost/api/client/status');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activeSession.id).toBe('s1');
  });

  it('logs missed heartbeat lazily in prod', async () => {
    vi.mocked(verifySession).mockResolvedValue(true);
    const staleTime = new Date(Date.now() - 60000).toISOString(); // 60s ago
    
    mockLocal.query.mockResolvedValueOnce({ _id: 's1', _creationTime: Date.now(), status: 'active' }); // session
    mockLocal.query.mockResolvedValueOnce({ value: { timestamp: staleTime } }); // heartbeat
    mockLocal.query.mockResolvedValueOnce(null); // summary
    mockLocal.query.mockResolvedValueOnce(null); // blocklist
    mockLocal.query.mockResolvedValue([]); // logs (no missed heartbeat yet)
    
    mockLocal.mutation.mockResolvedValue('log123');

    const req = new NextRequest('http://localhost/api/client/status');
    const res = await GET(req);
    const data = await res.json();

    expect(mockLocal.mutation).toHaveBeenCalledWith(api.logs.create, expect.objectContaining({
      type: 'missed_heartbeat'
    }));
    expect(data.logs[0].type).toBe('missed_heartbeat');
  });
});
