import { getLocalClient } from "@/lib/backend/convex";
import { api } from "@/convex/_generated/api";
import { StudySession } from "@/lib/backend/schema";

export async function getActiveSession(): Promise<StudySession | null> {
  const convex = getLocalClient();
  const session = await convex.query(api.studySessions.getActive);
  return session as StudySession | null;
}

export async function ensureNoActiveSession() {
  const active = await getActiveSession();
  if (active) {
    throw new Error("Invariant Violation: An active session already exists.");
  }
}

export async function ensureActiveSession(): Promise<StudySession> {
  const active = await getActiveSession();
  if (!active) {
    throw new Error("Invariant Violation: No active session found.");
  }
  return active;
}

export async function ensureNoActiveBreak() {
  const convex = getLocalClient();
  const breakVar = await convex.query(api.variables.getByKey, { key: "break" });
  if (breakVar) {
    throw new Error("Invariant Violation: A break is already active.");
  }
}
