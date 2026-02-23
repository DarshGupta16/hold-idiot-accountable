import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/client/acknowledge/route';
import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/backend/auth';
import { getLocalClient } from '@/lib/backend/convex';
import { api } from '@/convex/_generated/api';
import { replicateToCloud } from '@/lib/backend/sync';

vi.mock('@/lib/backend/auth');
vi.mock('@/lib/backend/convex');
vi.mock('@/lib/backend/sync');
vi.mock('@/convex/_generated/api', () => ({
  api: {
    logs: { getUnacknowledgedAlerts: 'logs:unack', updateMetadata: 'logs:update' },
  },
}));

describe('POST /api/client/acknowledge', () => {
  const mockLocal = {
    query: vi.fn(),
    mutation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalClient).mockReturnValue(mockLocal as unknown as ReturnType<typeof getLocalClient>);
  });

  it('updates unacknowledged logs', async () => {
    vi.mocked(verifySession).mockResolvedValue(true);
    mockLocal.query.mockResolvedValue([
      { _id: 'l1', metadata: { foo: 'bar' } },
    ]);

    const req = new NextRequest('http://localhost/api/client/acknowledge', { method: 'POST' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(1);
    expect(mockLocal.mutation).toHaveBeenCalledWith(api.logs.updateMetadata, expect.objectContaining({
      id: 'l1',
      metadata: expect.objectContaining({ acknowledged: true })
    }));
    expect(replicateToCloud).toHaveBeenCalled();
  });
});
