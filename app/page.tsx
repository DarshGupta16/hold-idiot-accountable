"use client";

import { MissedHeartbeatModal } from "@/components/ui/MissedHeartbeatModal";
import { BlocklistTamperModal } from "@/components/ui/BlocklistTamperModal";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SummaryPanel } from "@/components/ui/SummaryPanel";
import { BlocklistPanel } from "@/components/ui/BlocklistPanel";
import { Timeline } from "@/components/ui/Timeline";
import { Navigation } from "@/components/ui/Navigation";
import useSWR from "swr";
import { useMemo, useEffect, useState } from "react";
import { Log } from "@/lib/backend/schema";

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const { data, isLoading, mutate } = useSWR("/api/client/status", fetcher, {
    refreshInterval: 5000,
  });

  // Client-side duration ticker
  const startedAt = data?.activeSession?.started_at;
  const plannedDuration = data?.activeSession?.planned_duration_sec || 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  // Countdown timer logic
  const timerData = useMemo(() => {
    if (!startedAt || !plannedDuration) {
      return {
        display: "00:00",
        progressPercent: 100,
        isOvertime: false,
        startTime: "",
        endTime: "",
      };
    }

    const start = new Date(startedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - start) / 1000));
    const remainingSeconds = Math.max(0, plannedDuration - elapsedSeconds);
    const isOvertime = elapsedSeconds > plannedDuration;
    const overtimeSeconds = isOvertime ? elapsedSeconds - plannedDuration : 0;

    // Progress: 0% at start, 100% when time is up, >100% in overtime
    const progressPercent = (elapsedSeconds / plannedDuration) * 100;

    // Format display: countdown or overtime
    const displaySeconds = isOvertime ? overtimeSeconds : remainingSeconds;
    const m = Math.floor(displaySeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (displaySeconds % 60).toString().padStart(2, "0");
    const display = isOvertime ? `+ ${m}:${s}` : `${m}:${s}`;

    // Format start/end times
    const startDate = new Date(start);
    const endDate = new Date(start + plannedDuration * 1000);
    const timeFormat: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    };
    const startTime = startDate.toLocaleTimeString("en-IN", timeFormat);
    const endTime = endDate.toLocaleTimeString("en-IN", timeFormat);

    return { display, progressPercent, isOvertime, startTime, endTime };
  }, [now, startedAt, plannedDuration]);

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

    return logs.map((log: Log) => {
      // Map Log Type to Timeline Type
      let type: "START" | "END" | "BREACH" | "WARNING" | "INFO" = "INFO";
      if (log.type === "session_start") type = "START";
      if (log.type === "session_end") type = "END";
      if (log.type === "breach") type = "BREACH";
      if (log.type === "warn") type = "WARNING";

      return {
        id: log.id,
        time: log.created_at ? new Date(log.created_at).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        }) : "—",
        type,
        description: log.message,
      };
    });
  }, [logs]);

  return (
    <main className="min-h-screen pb-24 transition-colors duration-700">
      <MissedHeartbeatModal logs={data?.logs} onAcknowledge={() => mutate()} />
      <BlocklistTamperModal logs={data?.logs} onAcknowledge={() => mutate()} />
      <StatusPanel
        status={status === "REFLECTION" ? "IDLE" : status}
        subject={data?.activeSession?.subject || data?.summary?.subject}
        duration={timerData.display}
        progressPercent={timerData.progressPercent}
        startTime={timerData.startTime}
        endTime={timerData.endTime}
        isOvertime={timerData.isOvertime}
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
          <BlocklistPanel sites={data?.blocklist} />
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
