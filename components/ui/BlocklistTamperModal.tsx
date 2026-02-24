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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-md p-4 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl rounded-sm max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="h-1 w-full bg-red-500" />
        
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-sm">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold tracking-[0.2em] text-stone-400 uppercase font-mono">
                System Alert // Breach
              </h2>
              <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                Blocklist Tamper Detected
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-sm font-medium">
              The system detected unauthorized modification of the active blocklist during a protected session. 
            </p>
            
            {removedSites.length > 0 && (
              <div className="bg-stone-50 dark:bg-stone-950 p-4 border border-stone-100 dark:border-stone-800 rounded-sm">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 font-mono">
                  Compromised Assets
                </p>
                <ul className="space-y-2">
                  {removedSites.map((site, i) => (
                    <li key={i} className="text-xs font-mono text-red-700 dark:text-red-400 flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {site}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="w-full flex items-center justify-center gap-3 bg-stone-900 dark:bg-stone-50 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 py-4 rounded-sm font-bold font-mono text-xs uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isAcknowledging ? (
              "Updating Records..."
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Acknowledge Breach</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
