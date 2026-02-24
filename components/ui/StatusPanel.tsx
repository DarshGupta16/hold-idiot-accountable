"use client";

import { cn } from "@/lib/utils";
import { Activity, Clock, ShieldAlert } from "lucide-react";

interface StatusPanelProps {
  status: "FOCUSING" | "IDLE" | "BREACH" | "BREAK";
  subject?: string;
  duration?: string;
  progressPercent?: number;
  startTime?: string;
  endTime?: string;
  isOvertime?: boolean;
  isReflection?: boolean;
}

export function StatusPanel({
  status,
  subject,
  duration = "00:00",
  progressPercent = 100,
  startTime,
  endTime,
  isOvertime = false,
  isReflection = false,
}: StatusPanelProps) {
  const isFocusing = status === "FOCUSING";
  const isBreach = status === "BREACH";
  const isBreak = status === "BREAK";

  // Muted, sophisticated colors
  const statusColors = {
    FOCUSING: "text-stone-900 dark:text-stone-50",
    BREAK: "text-stone-500 dark:text-stone-400",
    IDLE: "text-stone-400 dark:text-stone-600",
    BREACH: "text-red-600 dark:text-red-500",
    REFLECTION: "text-stone-600 dark:text-stone-300",
  };

  const currentStatus = isReflection ? "REFLECTION" : status;

  return (
    <div className="relative w-full overflow-hidden transition-all duration-700">
      {/* Background decoration - subtle grid or noise */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />

      <div className="relative flex flex-col items-center justify-center pt-20 pb-12 px-6 space-y-8 max-w-md mx-auto">
        {/* System Identifier */}
        <div className="flex items-center gap-3 px-3 py-1 bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-full animate-in fade-in zoom-in duration-1000">
          <Activity className={cn(
            "w-3 h-3 transition-colors",
            (isFocusing || isBreak) ? "text-emerald-500 animate-pulse" : "text-stone-400"
          )} />
          <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.2em] font-mono">
            System.Active // {isReflection ? "LOG_POST" : status}
          </span>
        </div>

        {/* Main Status Display */}
        <div className="text-center space-y-4 w-full">
          <div className="relative inline-block">
            <h1
              className={cn(
                "text-5xl sm:text-6xl font-bold tracking-tight font-[family-name:var(--font-montserrat)] transition-colors duration-700",
                statusColors[currentStatus as keyof typeof statusColors]
              )}
            >
              {isReflection ? "COMPLETED" : (status === "BREAK" ? "RESTING" : status)}
            </h1>
            {isOvertime && (
              <div className="absolute -top-4 -right-8 animate-bounce">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
            )}
          </div>
          
          {subject && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                Current Objective
              </span>
              <p className="text-xl text-stone-700 dark:text-stone-300 font-medium tracking-tight">
                {subject}
              </p>
            </div>
          )}
        </div>

        {/* Technical Data Section */}
        <div className="w-full max-w-sm grid grid-cols-1 gap-6 pt-4 border-t border-stone-200 dark:border-stone-800/60">
          {/* Timer with larger mono font */}
          <div className="flex flex-col items-center space-y-2">
            <div
              className={cn(
                "font-mono text-4xl tracking-tighter tabular-nums transition-colors duration-500",
                isOvertime ? "text-red-500" : "text-stone-800 dark:text-stone-200",
              )}
            >
              {duration}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold font-mono">
              <Clock className="w-3 h-3" />
              {isOvertime ? "Overtime detected" : "Time remaining"}
            </div>
          </div>

          {/* Progress Bar - Minimalist implementation */}
          {(isFocusing || isBreak) && (
            <div className="space-y-4">
              <div className="relative h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                {/* Tick marks */}
                <div className="absolute inset-0 flex justify-between px-0.5 opacity-20">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="w-[1px] h-full bg-stone-400" />
                  ))}
                </div>
                {/* Progress fill */}
                <div
                  className={cn(
                    "absolute top-0 left-0 h-full transition-[width] duration-1000 ease-linear rounded-full",
                    isOvertime
                      ? "bg-red-500"
                      : (isBreak ? "bg-stone-400 dark:bg-stone-600" : "bg-stone-900 dark:bg-stone-50"),
                  )}
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>

              {/* Progress Footer */}
              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-stone-400 font-bold font-mono">Start</span>
                  <span className="text-xs text-stone-600 dark:text-stone-400 font-mono">{startTime}</span>
                </div>
                
                <div className="text-center">
                  <span className="text-[14px] font-bold text-stone-800 dark:text-stone-200 font-mono">
                    {Math.round(progressPercent)}%
                  </span>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-stone-400 font-bold font-mono">Target</span>
                  <span className="text-xs text-stone-600 dark:text-stone-400 font-mono">{endTime}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
