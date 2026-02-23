import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/client/history/route';
import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/backend/auth';
import { getLocalClient } from '@/lib/backend/convex';

vi.mock('@/lib/backend/auth');
vi.mock('@/lib/backend/convex');
vi.mock('@/convex/_generated/api', () => ({
  api: {
    studySessions: { list: 'ss:list' },
  },
}));

describe('GET /api/client/history', () => {
  const mockLocal = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalClient).mockReturnValue(mockLocal as unknown as ReturnType<typeof getLocalClient>);
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(verifySession).mockResolvedValue(false);
    const req = new NextRequest('http://localhost/api/client/history');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns paginated history when authorized', async () => {
    vi.mocked(verifySession).mockResolvedValue(true);
    mockLocal.query.mockResolvedValue({
      page: [{ _id: 's1', _creationTime: Date.now(), subject: 'Test' }],
      isDone: true,
      continueCursor: 'next',
    });

    const req = new NextRequest('http://localhost/api/client/history?perPage=10');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items[0].subject).toBe('Test');
    expect(data.isDone).toBe(true);
  });
});
