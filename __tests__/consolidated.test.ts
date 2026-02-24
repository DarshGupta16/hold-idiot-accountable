import { describe, mock, beforeEach } from "bun:test";

// ============================================================================
// 1. GLOBAL MOCKS (Self-contained in this file)
// ============================================================================

const mockLocal = {
  query: mock(() => Promise.resolve(undefined)),
  mutation: mock(() => Promise.resolve("mock-id")),
};
const mockCloud = {
  query: mock(() => Promise.resolve(undefined)),
  mutation: mock(() => Promise.resolve("mock-id")),
};

mock.module("@/lib/backend/convex", () => ({
  getLocalClient: mock(() => mockLocal),
  getCloudClient: mock(() => mockCloud),
}));

const mockAuth = {
  verifySession: mock(() => Promise.resolve(true)),
  verifyHomelabKey: mock(() => Promise.resolve(true)),
};
mock.module("@/lib/backend/auth", () => mockAuth);

const mockSync = {
  replicateToCloud: mock(() => Promise.resolve()),
  replicatedMutation: mock(async (table: string, operation: string, args: any) => {
    if (mockLocal.mutation) {
      const apiModule = (api as any)[table];
      const mutation = apiModule[operation];
      return await mockLocal.mutation(mutation, args);
    }
    return "mocked-replicated";
  }),
  bootstrapFromCloud: mock(() => Promise.resolve()),
  reconcile: mock(() => Promise.resolve()),
};
mock.module("@/lib/backend/sync", () => mockSync);

const mockAI = {
  generateSessionSummary: mock(() => Promise.resolve({ summary_text: "Mocked Summary", status_label: "FOCUSED" })),
};
mock.module("@/lib/backend/ai", () => mockAI);

mock.module("@/lib/backend/config", () => ({
  config: {
    convexUrl: "http://127.0.0.1:3210",
    convexAdminKey: "mock-key",
    isProd: true,
  },
}));

mock.module("groq-sdk", () => ({
  default: class { chat = { completions: { create: mock() } }; }
}));

mock.module("@/convex/_generated/api", () => {
  const apiObj = {
    studySessions: { create: "ss:create", update: "ss:update", getActive: "ss:getActive", count: "ss:count" },
    logs: { create: "logs:create", getBySessionAsc: "logs:getBySessionAsc", count: "logs:count", updateMetadata: "logs:updateMetadata", getBySession: "logs:getBySession" },
    variables: { upsert: "vars:upsert", getByKey: "vars:getByKey", count: "vars:count" },
    sync: { exportAll: "sync:exportAll", importAll: "sync:importAll" },
  };
  return { api: apiObj };
});

import { api } from "@/convex/_generated/api";

// ============================================================================
// 2. IMPORT SUITES
// ============================================================================

import { runInvariantsSuite } from "./backend/invariants.suite";
import { runDerivationSuite } from "./backend/derivation.suite";
import { runStatusApiSuite } from "./api/status.suite";
import { runIngestApiSuite } from "./api/ingest.suite";
import { runAcknowledgeApiSuite } from "./api/acknowledge.suite";

// ============================================================================
// 3. RUN TESTS
// ============================================================================

describe("Consolidated Backend Tests", () => {
  beforeEach(() => {
    mockLocal.query.mockClear();
    mockLocal.mutation.mockClear();
    mockCloud.query.mockClear();
    mockCloud.mutation.mockClear();
    mockAuth.verifySession.mockClear();
    mockAuth.verifyHomelabKey.mockClear();
    mockSync.replicateToCloud.mockClear();
    mockSync.replicatedMutation.mockClear();
    mockAI.generateSessionSummary.mockClear();
    
    // Default success states
    mockAuth.verifySession.mockResolvedValue(true);
    mockAuth.verifyHomelabKey.mockResolvedValue(true);
    mockLocal.query.mockResolvedValue(null);
    mockLocal.mutation.mockResolvedValue("done");
  });

  runInvariantsSuite(mockLocal);
  runDerivationSuite(mockLocal);
  runStatusApiSuite(mockLocal, mockAuth);
  runIngestApiSuite();
  runAcknowledgeApiSuite(mockLocal);
});
