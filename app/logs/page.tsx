"use client";

import { Navigation } from "@/components/ui/Navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import useSWR from "swr";
import { useMemo } from "react";

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SessionRecord {
  id: string;
  created: string; // "YYYY-MM-DD HH:MM:SS.mmmZ"
  started_at: string;
  ended_at?: string;
  subject: string;
  status: "active" | "completed" | "aborted";
  planned_duration_sec: number;
}

export default function LogsPage() {
  const { data, isLoading } = useSWR("/api/client/history", fetcher);

  // Group by Date
  const groupedLogs = useMemo(() => {
    if (!data?.items) return {};

    const groups: Record<string, any[]> = {};

    data.items.forEach((session: SessionRecord) => {
      if (!session.started_at) return;

      const dateObj = new Date(session.started_at);
      // Format Date: "Today", "Yesterday", or "Jan 28"
      const now = new Date();
      const isToday = dateObj.toDateString() === now.toDateString();

      let dateLabel = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (isToday) dateLabel = "Today";
      else if (
        new Date(
          new Date().setDate(new Date().getDate() - 1),
        ).toDateString() === dateObj.toDateString()
      ) {
        dateLabel = "Yesterday";
      }

      if (!groups[dateLabel]) groups[dateLabel] = [];

      // Calculate Duration
      let durationStr = "--";
      if (session.ended_at) {
        const start = new Date(session.started_at).getTime();
        const end = new Date(session.ended_at).getTime();
        const diffMin = Math.floor((end - start) / 1000 / 60);
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      } else {
        durationStr = "Active";
      }

      // Time Range
      const startTime = dateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTime = session.ended_at
        ? new Date(session.ended_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Now";

      groups[dateLabel].push({
        id: session.id,
        timeRange: `${startTime} - ${endTime}`,
        duration: durationStr,
        subject: session.subject,
        status: session.status.toUpperCase(), // COMPLETED / ABORTED / ACTIVE
      });
    });

    return groups;
  }, [data]);

  return (
    <main className="min-h-screen pb-24 bg-stone-50 dark:bg-stone-900">
      <div className="max-w-md mx-auto px-6 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 font-[family-name:var(--font-montserrat)]">
            Session Log
          </h1>
          <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mt-1">
            Recent Activity
          </p>
        </header>

        {isLoading && (
          <div className="text-stone-400 text-sm font-mono animate-pulse">
            Loading history...
          </div>
        )}

        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([date, logs]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-stone-400 mb-4 sticky top-0 bg-stone-50 dark:bg-stone-900 py-2 z-10 font-[family-name:var(--font-montserrat)]">
                {date}
              </h2>
              <div className="space-y-px bg-stone-200 dark:bg-stone-800 border border-stone-200 dark:border-stone-800 rounded-sm overflow-hidden">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 bg-white dark:bg-stone-900/50 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-mono text-xs text-stone-400">
                          {log.timeRange}
                        </span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                          {log.duration}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate font-[family-name:var(--font-montserrat)]">
                        {log.subject}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      {log.status === "COMPLETED" && (
                        <CheckCircle2 className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                      )}
                      {log.status === "ABORTED" && (
                        <XCircle className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                      )}
                      {/* Active or Breached? DB status is 'active', 'completed', 'aborted'. Breach is a log event type. 
                          For History, we mostly care about completion status. */}
                      {log.status === "ACTIVE" && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!isLoading && Object.keys(groupedLogs).length === 0 && (
            <p className="text-stone-400 text-sm italic">No history found.</p>
          )}
        </div>
      </div>
      <Navigation />
    </main>
  );
}
