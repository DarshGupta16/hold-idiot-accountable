"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";

interface MissedHeartbeatModalProps {
  logs: any[];
  onAcknowledge: () => void; // Callback to refresh data
}

export function MissedHeartbeatModal({
  logs,
  onAcknowledge,
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
    setIsOpen(hasMissed);
  }, [logs]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-stone-900 border border-red-200 dark:border-red-900 shadow-2xl rounded-lg max-w-md w-full p-6 space-y-6 animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-4 text-red-600 dark:text-red-500">
          <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-full">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Missed heartbeat(s) detected!
          </h2>
        </div>

        <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
          The server did not receive an expected ping for a 2 minute time
          window. This could mean that Darsh has modified or disabled the script
          responsible, allowing him to cheat.
        </p>

        <button
          onClick={handleAcknowledge}
          disabled={isAcknowledging}
          className="w-full flex items-center justify-center gap-2 bg-stone-900 dark:bg-stone-50 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 py-3 rounded-md font-semibold transition-all disabled:opacity-50"
        >
          {isAcknowledging ? (
            "Acknowledging..."
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>Ok</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
