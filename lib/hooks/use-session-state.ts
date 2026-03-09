import { useMemo, useEffect, useState, useRef } from "react";
import useSWR, { preload } from "swr";
import { Log } from "@/lib/backend/schema";
import { fetcher } from "@/lib/utils";

export type SessionStatus = "IDLE" | "FOCUSING" | "BREAK" | "REFLECTION";

export function useSessionState() {
  const { data, isLoading, mutate } = useSWR("/api/client/status", fetcher, {
    refreshInterval: 3000,
  });

  // Client-side duration ticker
  const startedAt = data?.activeSession?.started_at || data?.activeBreak?.started_at;
  const plannedDuration = data?.activeSession?.planned_duration_sec || data?.activeBreak?.duration_sec || 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  // Heartbeat tracking
  const [showResumedModal, setShowResumedModal] = useState(false);
  const prevWasMissingRef = useRef(false);
  
  const missedHeartbeatInfo = useMemo(() => {
    if (!data?.lastHeartbeat || !data?.logs) return null;
    
    const unacknowledgedLogs = data.logs.filter(
      (l: Log) => l.type === "missed_heartbeat" && l.metadata?.acknowledged !== true
    );
    
    if (unacknowledgedLogs.length === 0) {
      if (prevWasMissingRef.current) {
        setShowResumedModal(true);
        prevWasMissingRef.current = false;
      }
      return null;
    }

    // Sort by creation time to get the latest
    const latestMissed = [...unacknowledgedLogs].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )[0];
    
    const gapMinutes = (latestMissed.metadata?.gap_minutes as number) || 0;
    const count = Math.ceil((gapMinutes * 60) / 33);
    
    if (count >= 1) {
      prevWasMissingRef.current = true;
    }

    return {
      count,
      gapMinutes,
      lastSeen: latestMissed.metadata?.last_seen as string,
    };
  }, [data?.lastHeartbeat, data?.logs]);

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

    const progressPercent = (elapsedSeconds / plannedDuration) * 100;

    const displaySeconds = isOvertime ? overtimeSeconds : remainingSeconds;
    const h = Math.floor(displaySeconds / 3600);
    const m = Math.floor((displaySeconds % 3600) / 60);
    const s = displaySeconds % 60;

    const hStr = h > 0 ? `${h}:` : "";
    const mStr = m.toString().padStart(2, "0");
    const sStr = s.toString().padStart(2, "0");
    const display = isOvertime ? `+ ${hStr}${mStr}:${sStr}` : `${hStr}${mStr}:${sStr}`;

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

  // Status derivation
  const status = useMemo((): SessionStatus => {
    if (isLoading) return "IDLE";
    if (data?.activeSession) return "FOCUSING";
    if (data?.activeBreak) return "BREAK";
    if (data?.summary) return "REFLECTION";
    return "IDLE";
  }, [data, isLoading]);

  // Prefetch history on status changes
  useEffect(() => {
    preload("/api/client/history", fetcher);
  }, [status]);

  // Automatic transition for breaks
  useEffect(() => {
    if (status === "BREAK" && timerData.isOvertime) {
      console.log("[useSessionState] Break timer expired. Refreshing...");
      mutate();
    }
  }, [status, timerData.isOvertime, mutate]);

  // Map Logs to Timeline Events
  const timelineEvents = useMemo(() => {
    if (!data?.logs) return [];

    return data.logs.map((log: Log) => {
      let type: "START" | "END" | "BREACH" | "WARNING" | "INFO" = "INFO";
      if (log.type === "session_start") type = "START";
      if (log.type === "session_end") type = "END";
      if (log.type === "break_start") type = "START";
      if (log.type === "break_end") type = "END";
      if (log.type === "break_skip") type = "END";
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
  }, [data?.logs]);

  return {
    status,
    timerData,
    missedHeartbeatInfo,
    showResumedModal,
    setShowResumedModal,
    timelineEvents,
    data,
    isLoading,
    mutate
  };
}
