import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/client/ai/summary/route';
import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/backend/auth';
import { getLocalClient } from '@/lib/backend/convex';
import { api } from '@/convex/_generated/api';
import { generateSessionSummary } from '@/lib/backend/ai';

vi.mock('@/lib/backend/auth');
vi.mock('@/lib/backend/convex');
vi.mock('@/lib/backend/ai');
vi.mock('@/lib/backend/sync');
vi.mock('@/convex/_generated/api', () => ({
  api: {
    studySessions: { list: 'ss:list' },
    logs: { getBySessionAsc: 'logs:get' },
    variables: { upsert: 'vars:upsert' },
  },
}));

describe('POST /api/client/ai/summary', () => {
  const mockLocal = {
    query: vi.fn(),
    mutation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalClient).mockReturnValue(mockLocal as unknown as ReturnType<typeof getLocalClient>);
  });

  it('generates summary for latest session', async () => {
    vi.mocked(verifySession).mockResolvedValue(true);
    mockLocal.query.mockResolvedValueOnce({ page: [{ _id: 's1', started_at: new Date().toISOString() }] }); // list
    mockLocal.query.mockResolvedValueOnce([]); // logs
    vi.mocked(generateSessionSummary).mockResolvedValue({ summary_text: 'Done!', status_label: 'FOCUSED' });

    const req = new NextRequest('http://localhost/api/client/ai/summary', { method: 'POST' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary.summary_text).toBe('Done!');
    expect(mockLocal.mutation).toHaveBeenCalledWith(api.variables.upsert, expect.objectContaining({
      key: 'summary'
    }));
  });
});
