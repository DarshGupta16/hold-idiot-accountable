"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Check } from "lucide-react";
import { Log } from "@/lib/backend/schema";

interface BlocklistTamperModalProps {
  logs: Log[];
  onAcknowledge: () => void;
}

export function BlocklistTamperModal({
  logs,
  onAcknowledge,
}: BlocklistTamperModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [tamperLogs, setTamperLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (!logs) return;
    
    // Check for any unacknowledged breach logs (blocklist tamper)
    const unacknowledgedBreaches = logs.filter(
      (log) =>
        log.type === "breach" && log.metadata?.acknowledged !== true
    );
    
    setTamperLogs(unacknowledgedBreaches);
    setIsOpen(unacknowledgedBreaches.length > 0);
  }, [logs]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      // Use the same acknowledge endpoint
      // It should ideally accept a log ID, but let's see how api/client/acknowledge is implemented
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

  const lastBreach = tamperLogs[0];
  const removedSites = (lastBreach?.metadata?.removed_sites as string[]) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-stone-900 border border-red-200 dark:border-red-900 shadow-2xl rounded-lg max-w-md w-full p-6 space-y-6 animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-4 text-red-600 dark:text-red-500">
          <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-full">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Blocklist Tamper Detected!
          </h2>
        </div>

        <div className="space-y-3">
          <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-sm">
            The server detected that some sites were removed from the blocklist during an active session. This is a violation of the "Zero Trust" policy.
          </p>
          
          {removedSites.length > 0 && (
            <div className="bg-stone-50 dark:bg-stone-950 p-3 rounded border border-stone-200 dark:border-stone-800">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">
                Removed Sites
              </p>
              <ul className="space-y-1">
                {removedSites.map((site, i) => (
                  <li key={i} className="text-xs font-mono text-red-700 dark:text-red-400">
                    • {site}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

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
              <span>I acknowledge this breach</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
