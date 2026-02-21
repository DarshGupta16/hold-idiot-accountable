import { getLocalClient } from "./convex";
import { api } from "../../convex/_generated/api";
import { StudySession } from "./schema";

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
