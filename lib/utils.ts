import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a duration in seconds to a human-readable string.
 * Examples:
 * - 7200 -> "2hr"
 * - 8100 -> "2hr 15min"
 * - 8103 -> "2hr 15min 3s"
 * - 900 -> "15min"
 * - 5 -> "5s"
 * - 905 -> "15min 5s"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}hr`);
  if (m > 0) parts.push(`${m}min`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(" ");
}

/**
 * Parses a PocketBase date string to a Date object.
 * PocketBase uses "YYYY-MM-DD HH:mm:ss.sssZ" format (space separator),
 * but JavaScript Date expects ISO format with 'T' separator.
 */
export function parsePocketBaseDate(dateString: string | undefined): Date {
  if (!dateString) return new Date(NaN); // Returns Invalid Date
  // Replace space with 'T' for ISO compatibility
  const normalized = dateString.replace(" ", "T");
  return new Date(normalized);
}
