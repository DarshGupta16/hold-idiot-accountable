"use client";

import { useEffect, useState } from "react";
import { Activity, Check } from "lucide-react";

interface HeartbeatResumedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HeartbeatResumedModal({
  isOpen,
  onClose,
}: HeartbeatResumedModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-md p-4 transition-all duration-500 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl rounded-sm max-w-md w-full overflow-hidden transition-all duration-500 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>
        <div className="h-1 w-full bg-emerald-500" />
        
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-sm">
              <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold tracking-[0.2em] text-stone-400 uppercase font-mono">
                System Update // Resumed
              </h2>
              <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                Heartbeat Detected
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-sm font-medium">
              Connectivity has been re-established. The monitoring system is once again receiving telemetry from the host machine.
            </p>
            <div className="p-4 bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-sm">
              <p className="text-xs text-stone-500 dark:text-stone-500 leading-relaxed italic">
                System integrity verification has resumed. No further action is required at this time.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-stone-900 py-4 rounded-sm font-bold font-mono text-xs uppercase tracking-widest transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Continue Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
