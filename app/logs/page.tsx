"use client";

import { Navigation } from "@/components/ui/Navigation";
import { SessionDetailsModal } from "@/components/ui/SessionDetailsModal";
import { CheckCircle2, XCircle } from "lucide-react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { StudySession } from "@/lib/backend/schema";
import { fetcher } from "@/lib/utils";

export default function LogsPage() {
  const { data, isLoading } = useSWR("/api/client/history", fetcher, {
    revalidateIfStale: false, // Use cache first if it exists
    dedupingInterval: 60000,   // Don't refetch for 1 minute if we just prefetched
  });
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(
    null,
  );

  // Group by Date
  const groupedLogs = useMemo(() => {
    if (!data?.items) return {};

    const groups: Record<string, StudySession[]> = {};

    data.items.forEach((session: StudySession) => {
      if (!session.started_at) return;

      const dateObj = new Date(session.started_at);
      // Format Date: "Today", "Yesterday", or "Jan 28"
      const now = new Date();
      
      const isToday = dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) === 
                      now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

      let dateLabel = dateObj.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
      });
      
      if (isToday) {
        dateLabel = "Today";
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) === 
                            yesterday.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
        if (isYesterday) dateLabel = "Yesterday";
      }

      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(session);
    });

    return groups;
  }, [data]);

  // Helper to format duration
  const formatSessionDuration = (session: StudySession) => {
    if (!session.ended_at) return "Active";

    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    const diffMin = Math.floor((end - start) / 1000 / 60);
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Helper to format time range
  const formatTimeRange = (session: StudySession) => {
    const startTime = new Date(session.started_at).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTime = session.ended_at
      ? new Date(session.ended_at).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Now";
    return `${startTime} - ${endTime}`;
  };

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

        {!data && (
          <div className="text-stone-400 text-sm font-mono animate-pulse">
            Loading history...
          </div>
        )}

        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([date, sessions]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-stone-400 mb-4 sticky top-0 bg-stone-50 dark:bg-stone-900 py-2 z-10 font-[family-name:var(--font-montserrat)]">
                {date}
              </h2>
              <div className="space-y-px bg-stone-200 dark:bg-stone-800 border border-stone-200 dark:border-stone-800 rounded-sm overflow-hidden">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-stone-900/50 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-mono text-xs text-stone-400">
                          {formatTimeRange(session)}
                        </span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                          {formatSessionDuration(session)}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate font-[family-name:var(--font-montserrat)]">
                        {session.subject}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      {session.status === "completed" && (
                        <CheckCircle2 className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                      )}
                      {session.status === "aborted" && (
                        <XCircle className="w-5 h-5 text-stone-300 dark:text-stone-600" />
                      )}
                      {session.status === "active" && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {data && Object.keys(groupedLogs).length === 0 && (
            <p className="text-stone-400 text-sm italic">No history found.</p>
          )}
        </div>
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}

      <Navigation />
    </main>
  );
}
