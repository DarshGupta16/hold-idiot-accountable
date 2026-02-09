"use client";

import { cn } from "@/lib/utils";

interface StatusPanelProps {
  status: "FOCUSING" | "IDLE" | "BREACH";
  subject?: string;
  duration?: string;
  progressPercent?: number;
  startTime?: string;
  endTime?: string;
  isOvertime?: boolean;
}

export function StatusPanel({
  status,
  subject,
  duration = "00:00",
  progressPercent = 100,
  startTime,
  endTime,
  isOvertime = false,
}: StatusPanelProps) {
  const isFocusing = status === "FOCUSING";
  const isBreach = status === "BREACH";

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-6 relative w-full h-[40vh]">
      {/* Heartbeat indicator */}
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

      {/* Timer display */}
      <div
        className={cn(
          "font-mono text-lg tracking-widest",
          isOvertime ? "text-red-600 dark:text-red-400" : "text-stone-400",
        )}
      >
        {duration}
      </div>

      {/* Progress bar - only shown when focusing */}
      {isFocusing && (
        <div className="w-full max-w-xs px-6 space-y-2">
          {/* Progress bar track */}
          <div className="w-full h-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-1000 ease-linear",
                isOvertime
                  ? "bg-red-500/60 dark:bg-red-500/50"
                  : "bg-stone-500 dark:bg-stone-400",
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Time metadata */}
          {startTime && endTime && (
            <div className="flex justify-between text-xs text-stone-400 font-mono tracking-wide">
              <span>{startTime}</span>
              <span>{endTime}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
