import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHeartbeat, processSessionStart, processSessionStop, processBlocklistEvent } from '@/lib/backend/derivation';
import { getLocalClient } from '@/lib/backend/convex';
import { replicateToCloud } from '@/lib/backend/sync';
import { ensureActiveSession, ensureNoActiveSession, getActiveSession } from '@/lib/backend/invariants';
import { api } from '@/convex/_generated/api';

vi.mock('@/lib/backend/convex');
vi.mock('@/lib/backend/sync');
vi.mock('@/lib/backend/invariants');
vi.mock('@/lib/backend/ai', () => ({
  generateSessionSummary: vi.fn().mockResolvedValue({ summary_text: 'Test summary' }),
}));
vi.mock('@/convex/_generated/api', () => ({
  api: {
    studySessions: { create: 'ss:create', update: 'ss:update' },
    logs: { create: 'logs:create', getBySessionAsc: 'logs:getBySessionAsc' },
    variables: { upsert: 'vars:upsert' },
  },
}));

describe('derivation', () => {
  const mockLocal = {
    query: vi.fn(),
    mutation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getLocalClient as any).mockReturnValue(mockLocal);
  });

  describe('processHeartbeat', () => {
    it('updates lastHeartbeatAt and replicates', async () => {
      const payload = { timestamp: '2026-02-20T10:00:00Z', machine_id: 'mac1' };
      await processHeartbeat(payload);
      
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.variables.upsert, expect.objectContaining({
        key: 'lastHeartbeatAt',
        value: expect.objectContaining({ machine: 'mac1' })
      }));
      expect(replicateToCloud).toHaveBeenCalledWith('variables', 'upsert', expect.any(Object));
    });
  });

  describe('processSessionStart', () => {
    it('creates session, stores blocklist, creates log, and replicates', async () => {
      (ensureNoActiveSession as any).mockResolvedValue(undefined);
      mockLocal.mutation.mockResolvedValue('session123');
      
      const payload = {
        planned_duration_sec: 3600,
        subject: 'Testing',
        blocklist: ['site1.com'],
      };
      
      await processSessionStart(payload);
      
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.studySessions.create, expect.objectContaining({
        subject: 'Testing',
        planned_duration_sec: 3600,
      }));
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.variables.upsert, expect.objectContaining({
        key: 'blocklist',
        value: ['site1.com'],
      }));
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.logs.create, expect.objectContaining({
        type: 'session_start',
        session: 'session123',
      }));
      expect(replicateToCloud).toHaveBeenCalledTimes(3);
    });
  });

  describe('processSessionStop', () => {
    it('derives completed status if time elapsed', async () => {
      const startTime = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago
      const session = {
        _id: 's1',
        started_at: startTime,
        planned_duration_sec: 3600,
        subject: 'Math',
      };
      (ensureActiveSession as any).mockResolvedValue(session);
      mockLocal.query.mockResolvedValue([]); // logs for timeline
      
      await processSessionStop({ reason: 'finished' });
      
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.studySessions.update, expect.objectContaining({
        id: 's1',
        updates: expect.objectContaining({ status: 'completed' })
      }));
    });

    it('derives aborted status if stopped early', async () => {
      const startTime = new Date(Date.now() - 600 * 1000).toISOString(); // 10 mins ago
      const session = {
        _id: 's1',
        started_at: startTime,
        planned_duration_sec: 3600, // 1 hour planned
        subject: 'Math',
      };
      (ensureActiveSession as any).mockResolvedValue(session);
      mockLocal.query.mockResolvedValue([]);
      
      await processSessionStop({ reason: 'giving up' });
      
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.studySessions.update, expect.objectContaining({
        id: 's1',
        updates: expect.objectContaining({ status: 'aborted' })
      }));
    });
  });

  describe('processBlocklistEvent', () => {
    it('creates breach log when violation occurs', async () => {
      (getActiveSession as any).mockResolvedValue({ _id: 's1' });
      const payload = {
        type: 'violation' as any,
        removed_sites: ['evil.com'],
        timestamp: '...',
      };
      
      await processBlocklistEvent(payload);
      
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.logs.create, expect.objectContaining({
        type: 'breach',
        message: expect.stringContaining('Removed: evil.com'),
        session: 's1',
      }));
    });
  });
});
