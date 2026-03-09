"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Log } from "@/lib/backend/schema";

interface MissedHeartbeatModalProps {
  logs: Log[];
  onAcknowledge: () => void; // Callback to refresh data
  missedCount: number;
}

export function MissedHeartbeatModal({
  logs,
  onAcknowledge,
  missedCount,
}: MissedHeartbeatModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    if (!logs) return;
    // Check for any unacknowledged missed heartbeat logs
    const hasMissed = logs.some(
      (log) =>
        log.type === "missed_heartbeat" && log.metadata?.acknowledged !== true,
    );
    // Only show if we have at least 3 missed heartbeats
    setIsOpen(hasMissed && missedCount >= 3);
  }, [logs, missedCount]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await fetch("/api/client/acknowledge", { method: "POST" });
      onAcknowledge();
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to acknowledge", error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-md p-4 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl rounded-sm max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="h-1 w-full bg-red-500" />
        
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-sm">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold tracking-[0.2em] text-stone-400 uppercase font-mono">
                System Alert // Integrity
              </h2>
              <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                Missed Heartbeat Detected
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-sm font-medium">
              Heartbeats have not been detected for the past 1.5 minutes. Something might be wrong with the monitoring script or system connectivity.
            </p>
            <div className="p-4 bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-sm">
              <p className="text-xs text-stone-500 dark:text-stone-500 leading-relaxed italic">
                You will be informed when heartbeats start being detected again. System integrity cannot be verified for this interval.
              </p>
            </div>
          </div>

          <button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="w-full flex items-center justify-center gap-3 bg-stone-900 dark:bg-stone-50 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 py-4 rounded-sm font-bold font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isAcknowledging ? (
              "Synchronizing..."
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Acknowledge Log</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
