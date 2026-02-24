"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectivityAlert() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Wait a bit before hiding to show "Connected" or just fade out
      setTimeout(() => setShouldShow(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShouldShow(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) {
      setShouldShow(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div 
      className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out",
        shouldShow ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0 pointer-events-none"
      )}
    >
      <div className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md transition-colors duration-500",
        isOnline 
          ? "bg-emerald-50/90 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400"
          : "bg-stone-900/90 border-stone-800 text-stone-100 dark:bg-stone-100/90 dark:border-stone-200 dark:text-stone-900"
      )}>
        {isOnline ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Connection Restored</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">System Offline // Reconnecting</span>
          </>
        )}
      </div>
    </div>
  );
}
