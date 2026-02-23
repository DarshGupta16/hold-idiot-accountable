import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapFromCloud, replicateToCloud, reconcile } from '@/lib/backend/sync';
import { getLocalClient, getCloudClient } from '@/lib/backend/convex';
import { api } from '@/convex/_generated/api';

vi.mock('@/lib/backend/convex');
vi.mock('@/convex/_generated/api', () => ({
  api: {
    studySessions: { count: 'studySessions:count', create: 'studySessions:create' },
    logs: { count: 'logs:count', create: 'logs:create' },
    variables: { count: 'variables:count', upsert: 'variables:upsert' },
    sync: {
      exportAll: 'sync:exportAll',
      importAll: 'sync:importAll',
      computeHash: 'sync:computeHash',
      clearAll: 'sync:clearAll',
    },
  },
}));

describe('sync', () => {
  const mockLocal = {
    query: vi.fn(),
    mutation: vi.fn(),
  };
  const mockCloud = {
    query: vi.fn(),
    mutation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocalClient).mockReturnValue(mockLocal as unknown as ReturnType<typeof getLocalClient>);
    vi.mocked(getCloudClient).mockReturnValue(mockCloud as unknown as ReturnType<typeof getCloudClient>);
  });

  describe('bootstrapFromCloud', () => {
    it('bootstraps when local is empty', async () => {
      mockLocal.query.mockResolvedValue(0); // sessionCount, logCount, varCount
      mockCloud.query.mockResolvedValue({
        sessions: [{ id: 1 }],
        logs: [{ id: 2 }],
        variables: [{ id: 3 }],
      });

      await bootstrapFromCloud();

      expect(mockCloud.query).toHaveBeenCalledWith(api.sync.exportAll);
      expect(mockLocal.mutation).toHaveBeenCalledWith(api.sync.importAll, expect.any(Object));
    });

    it('does not bootstrap when local has data', async () => {
      mockLocal.query.mockResolvedValueOnce(1); // sessionCount = 1

      await bootstrapFromCloud();

      expect(mockCloud.query).not.toHaveBeenCalled();
      expect(mockLocal.mutation).not.toHaveBeenCalled();
    });

    it('no-ops when cloud client is missing', async () => {
      vi.mocked(getCloudClient).mockReturnValue(null);
      await bootstrapFromCloud();
      expect(mockLocal.query).not.toHaveBeenCalled();
    });
  });

  describe('replicateToCloud', () => {
    it('calls mutation on cloud client', async () => {
      await replicateToCloud('logs', 'create', { foo: 'bar' });
      expect(mockCloud.mutation).toHaveBeenCalledWith(api.logs.create, { foo: 'bar' });
    });

    it('no-ops when cloud client is missing', async () => {
      vi.mocked(getCloudClient).mockReturnValue(null);
      await replicateToCloud('logs', 'create', { foo: 'bar' });
      expect(mockCloud.mutation).not.toHaveBeenCalled();
    });
  });

  describe('reconcile', () => {
    it('does nothing when hashes match', async () => {
      mockLocal.query.mockResolvedValue('hash1');
      mockCloud.query.mockResolvedValue('hash1');

      await reconcile();

      expect(mockCloud.mutation).not.toHaveBeenCalled();
    });

    it('overwrites cloud when hashes differ', async () => {
      mockLocal.query.mockResolvedValueOnce('hash-local');
      mockCloud.query.mockResolvedValueOnce('hash-cloud');
      mockLocal.query.mockResolvedValueOnce({ sessions: [], logs: [], variables: [] }); // exportAll

      await reconcile();

      expect(mockCloud.mutation).toHaveBeenCalledWith(api.sync.clearAll);
      expect(mockCloud.mutation).toHaveBeenCalledWith(api.sync.importAll, expect.any(Object));
    });
  });
});
