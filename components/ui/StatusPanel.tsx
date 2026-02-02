"use client";

import { cn } from "@/lib/utils";

interface StatusPanelProps {
  status: "FOCUSING" | "IDLE" | "BREACH";
  subject?: string;
  duration?: string;
}

export function StatusPanel({
  status,
  subject,
  duration = "00:00:00",
}: StatusPanelProps) {
  const isFocusing = status === "FOCUSING";
  const isBreach = status === "BREACH";

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-6 relative w-full h-[40vh]">
      {/* Heartbeat Logic */}
      <div className="absolute top-8 right-8 flex items-center gap-2">
        <div
          className={cn(
            "w-2 h-2 rounded-full transition-colors duration-500",
            isFocusing ? "bg-emerald-500 animate-pulse" : "bg-stone-400",
          )}
        />
      </div>

      <div className="text-center space-y-2">
        <h1
          className={cn(
            "text-6xl sm:text-7xl font-bold tracking-wide font-[family-name:var(--font-montserrat)]",
            isFocusing && "text-stone-900 dark:text-stone-50",
            status === "IDLE" && "text-stone-400 dark:text-stone-600",
            isBreach && "text-red-800/80 dark:text-red-400/80",
          )}
        >
          {status}
        </h1>
        {subject && (
          <p className="text-xl text-stone-500 font-medium tracking-wide">
            {subject}
          </p>
        )}
      </div>

      <div className="font-mono text-stone-400 text-lg tracking-widest">
        {duration}
      </div>
    </div>
  );
}
