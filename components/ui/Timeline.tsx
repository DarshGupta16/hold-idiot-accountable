"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";

interface TimelineEvent {
  id: string;
  time: string;
  type: "START" | "END" | "BREACH" | "WARNING" | "INFO";
  description: string;
}

interface TimelineProps {
  events?: TimelineEvent[];
}

export function Timeline({ events = [] }: TimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { density } = usePreferences();

  // If no events, hide? or show empty state?
  // Design principles: "Calm". If empty, maybe just don't show the list part or show "Session started..." placeholder
  if (events.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto px-6 py-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors text-sm font-medium mx-auto"
      >
        <span>
          {isExpanded ? "Hide Session Timeline" : "Show Session Timeline"}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isExpanded ? "rotate-180" : "",
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300 ease-linear",
          isExpanded ? "max-h-96" : "max-h-0",
        )}
      >
        <div
          className={cn(
            "pt-6 relative pl-4 border-l border-stone-200 dark:border-stone-800 ml-2",
            density === "compact" ? "space-y-3" : "space-y-6",
          )}
        >
          {events.map((event) => (
            <div key={event.id} className="relative group">
              {/* Node Icon */}
              <div
                className={cn(
                  "absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 bg-stone-50 dark:bg-stone-900 z-10",
                  event.type === "START" && "border-stone-400",
                  event.type === "WARNING" &&
                    "border-amber-500/50 bg-amber-500/10",
                  event.type === "BREACH" && "border-red-500/50 bg-red-500/10",
                  event.type === "INFO" &&
                    "border-stone-300 w-2 h-2 -left-[19px] top-1.5",
                )}
              />

              <div className="flex items-baseline gap-4">
                <span className="font-mono text-xs text-stone-400 shrink-0">
                  {event.time}
                </span>
                <span
                  className={cn(
                    "text-sm font-[family-name:var(--font-montserrat)]",
                    event.type === "WARNING" &&
                      "text-amber-700 dark:text-amber-500",
                    event.type === "BREACH" && "text-red-700 dark:text-red-500",
                    event.type === "INFO" && "text-stone-500",
                  )}
                >
                  {event.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
