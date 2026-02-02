import { getAuthenticatedPocketBase } from "./pocketbase";
import { SessionStatus, StudySessionRecord } from "./types";

export async function getActiveSession(): Promise<StudySessionRecord | null> {
  const pb = await getAuthenticatedPocketBase();
  try {
    const record = await pb
      .collection("study_sessions")
      .getFirstListItem(`status = "${SessionStatus.ACTIVE}"`);
    return record as unknown as StudySessionRecord;
  } catch (e: any) {
    if (e.status === 404) {
      return null;
    }
    throw e;
  }
}

export async function ensureNoActiveSession() {
  const active = await getActiveSession();
  if (active) {
    throw new Error("Invariant Violation: An active session already exists.");
  }
}

export async function ensureActiveSession(): Promise<StudySessionRecord> {
  const active = await getActiveSession();
  if (!active) {
    throw new Error("Invariant Violation: No active session found.");
  }
  return active;
}
