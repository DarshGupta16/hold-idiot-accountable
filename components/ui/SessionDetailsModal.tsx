"use client";

import { useState } from "react";
import { X, ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { StudySession, TimelineEvent } from "@/lib/backend/schema";
import { cn } from "@/lib/utils";

interface SessionDetailsModalProps {
  session: StudySession;
  onClose: () => void;
}

export function SessionDetailsModal({
  session,
  onClose,
}: SessionDetailsModalProps) {
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

  // Format dates
  const startDate = new Date(session.started_at);
  const endDate = session.ended_at ? new Date(session.ended_at) : null;

  const startTime = startDate.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = endDate
    ? endDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const dateStr = startDate.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Calculate actual duration
  let actualDuration = "—";
  if (endDate) {
    const diffSec = Math.floor(
      (endDate.getTime() - startDate.getTime()) / 1000,
    );
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    actualDuration = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Format planned duration
  const plannedH = Math.floor(session.planned_duration_sec / 3600);
  const plannedM = Math.floor((session.planned_duration_sec % 3600) / 60);
  const plannedDuration =
    plannedH > 0 ? `${plannedH}h ${plannedM}m` : `${plannedM}m`;

  // Timeline data
  const timeline: TimelineEvent[] = session.timeline || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl rounded-lg max-w-md w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-100 dark:border-stone-800">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50 font-[family-name:var(--font-montserrat)]">
              {session.subject}
            </h2>
            <p className="text-xs text-stone-400 font-mono mt-1">{dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Metadata Grid */}
          <div className="p-5 grid grid-cols-2 gap-4">
            {/* Time Range */}
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">
                Time
              </p>
              <p className="text-sm font-mono text-stone-700 dark:text-stone-200">
                {startTime} — {endTime}
              </p>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">
                Status
              </p>
              <div className="flex items-center gap-1.5">
                {session.status === "completed" && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-400" />
                    <span className="text-sm text-stone-700 dark:text-stone-200">
                      Completed
                    </span>
                  </>
                )}
                {session.status === "aborted" && (
                  <>
                    <XCircle className="w-4 h-4 text-stone-400" />
                    <span className="text-sm text-stone-700 dark:text-stone-200">
                      Aborted
                    </span>
                  </>
                )}
                {session.status === "active" && (
                  <>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm text-stone-700 dark:text-stone-200">
                      Active
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Duration */}
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">
                Duration
              </p>
              <p className="text-sm font-mono text-stone-700 dark:text-stone-200">
                {actualDuration}
              </p>
            </div>

            {/* Planned */}
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">
                Planned
              </p>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-400" />
                <span className="text-sm font-mono text-stone-700 dark:text-stone-200">
                  {plannedDuration}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          {session.summary && (
            <div className="px-5 pb-5">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
                Summary
              </p>
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                {session.summary}
              </p>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                className="w-full flex items-center justify-between px-5 py-4 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              >
                <span className="text-xs uppercase tracking-wider font-medium">
                  Timeline ({timeline.length} events)
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    isTimelineExpanded ? "rotate-180" : "",
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-[max-height] duration-300 ease-linear",
                  isTimelineExpanded ? "max-h-96" : "max-h-0",
                )}
              >
                <div className="px-5 pb-5 pl-8 relative border-l border-stone-200 dark:border-stone-700 ml-5 space-y-4">
                  {timeline.map((event) => (
                    <div key={event.id} className="relative">
                      {/* Node */}
                      <div
                        className={cn(
                          "absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-stone-900",
                          event.type === "START" && "border-stone-400",
                          event.type === "END" && "border-stone-400",
                          event.type === "WARNING" &&
                            "border-amber-500/60 bg-amber-50 dark:bg-amber-950/30",
                          event.type === "BREACH" &&
                            "border-red-500/60 bg-red-50 dark:bg-red-950/30",
                          event.type === "INFO" && "border-stone-300 w-2 h-2",
                        )}
                      />

                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-xs text-stone-400 shrink-0">
                          {(() => {
                            const d = new Date(event.time);
                            return isNaN(d.getTime())
                              ? event.time
                              : d.toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                          })()}
                        </span>
                        <span
                          className={cn(
                            "text-sm",
                            event.type === "WARNING" &&
                              "text-amber-700 dark:text-amber-500",
                            event.type === "BREACH" &&
                              "text-red-700 dark:text-red-500",
                            (event.type === "INFO" ||
                              event.type === "START" ||
                              event.type === "END") &&
                              "text-stone-600 dark:text-stone-400",
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
          )}

          {/* End note if exists */}
          {session.end_note && (
            <div className="px-5 pb-5 pt-2 border-t border-stone-100 dark:border-stone-800">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
                Note
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400 italic">
                {session.end_note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
