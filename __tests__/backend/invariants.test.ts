import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveSession, ensureNoActiveSession, ensureActiveSession } from '@/lib/backend/invariants';
import { getLocalClient } from '@/lib/backend/convex';

vi.mock('@/lib/backend/convex');
vi.mock('@/convex/_generated/api', () => ({
  api: {
    studySessions: { getActive: 'studySessions:getActive' },
  },
}));

describe('invariants', () => {
  const mockLocal = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalClient).mockReturnValue(mockLocal as unknown as ReturnType<typeof getLocalClient>);
  });

  it('getActiveSession() returns session from convex', async () => {
    mockLocal.query.mockResolvedValue({ _id: '123', status: 'active' });
    const session = await getActiveSession();
    expect(session).toEqual({ _id: '123', status: 'active' });
  });

  it('ensureNoActiveSession() throws when session exists', async () => {
    mockLocal.query.mockResolvedValue({ _id: '123' });
    await expect(ensureNoActiveSession()).rejects.toThrow('Invariant Violation');
  });

  it('ensureNoActiveSession() passes when no session exists', async () => {
    mockLocal.query.mockResolvedValue(null);
    await expect(ensureNoActiveSession()).resolves.not.toThrow();
  });

  it('ensureActiveSession() throws when no session exists', async () => {
    mockLocal.query.mockResolvedValue(null);
    await expect(ensureActiveSession()).rejects.toThrow('Invariant Violation');
  });

  it('ensureActiveSession() returns session when it exists', async () => {
    mockLocal.query.mockResolvedValue({ _id: '123' });
    const session = await ensureActiveSession();
    expect(session).toEqual({ _id: '123' });
  });
});
