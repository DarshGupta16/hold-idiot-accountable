"use client";

import { MissedHeartbeatModal } from "@/components/ui/MissedHeartbeatModal";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SummaryPanel } from "@/components/ui/SummaryPanel";
import { Timeline } from "@/components/ui/Timeline";
import { Navigation } from "@/components/ui/Navigation";
import useSWR from "swr";
import { useMemo, useEffect, useState } from "react";
import { LogRecord } from "@/lib/backend/types";

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const { data, isLoading, mutate } = useSWR("/api/client/status", fetcher, {
    refreshInterval: 5000,
  });

  // ... (existing code for dates/timers/status)

  // Client-side duration ticker
  const startedAt = data?.activeSession?.started_at;
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsed = useMemo(() => {
    if (!startedAt) return "00:00:00";

    const start = new Date(startedAt).getTime();
    const diff = Math.max(0, Math.floor((now - start) / 1000));

    const h = Math.floor(diff / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((diff % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");

    return `${h}:${m}:${s}`;
  }, [now, startedAt]);

  // Derived State
  const status = useMemo(() => {
    if (isLoading) return "IDLE";
    if (data?.activeSession) return "FOCUSING";
    if (data?.summary) return "REFLECTION"; // New state: Idle but showing last session
    return "IDLE";
  }, [data, isLoading]);

  // Map Logs to Timeline Events
  const logs = data?.logs;

  const timelineEvents = useMemo(() => {
    if (!logs) return [];

    return logs.map((log: LogRecord) => {
      // Map Log Type to Timeline Type
      let type: "START" | "END" | "BREACH" | "WARNING" | "INFO" = "INFO";
      if (log.type === "session_start") type = "START";
      if (log.type === "session_end") type = "END";
      if (log.type === "breach") type = "BREACH";
      if (log.type === "warn") type = "WARNING";

      return {
        id: log.id,
        time: new Date(log.created).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        type,
        description: log.message,
      };
    });
  }, [logs]);

  // Heartbeat check (optional visual indicator of "Online")
  // const isOnline = ...

  return (
    <main className="min-h-screen pb-24 transition-colors duration-700">
      <MissedHeartbeatModal logs={data?.logs} onAcknowledge={() => mutate()} />
      <StatusPanel
        status={status === "REFLECTION" ? "IDLE" : status} // StatusPanel doesn't need to know about Reflection
        subject={data?.activeSession?.subject || data?.summary?.subject} // Show subject of last session if reflecting
        duration={elapsed}
      />

      {(status === "FOCUSING" || status === "REFLECTION") && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards">
          <SummaryPanel
            summary={
              status === "FOCUSING"
                ? "Session active. Monitoring for interruptions."
                : data?.summary?.summary_text || "Session closed."
            }
          />
          <Timeline events={timelineEvents} />
        </div>
      )}

      {status === "IDLE" && !isLoading && (
        <div className="flex justify-center items-center h-48 opacity-50 animate-in fade-in duration-1000">
          <p className="text-sm font-mono tracking-widest uppercase text-stone-400">
            System Standby
          </p>
        </div>
      )}

      <Navigation />
    </main>
  );
}
