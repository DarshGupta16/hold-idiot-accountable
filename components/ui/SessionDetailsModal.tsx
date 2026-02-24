"use client";

import { X, ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { StudySession, TimelineEvent, TimelineEventType } from "@/lib/backend/schema";
import { cn } from "@/lib/utils";
import React, { useState } from "react";

interface SessionDetailsModalProps {
  session: StudySession;
  onClose: () => void;
}

export function SessionDetailsModal({
  session,
  onClose,
}: SessionDetailsModalProps) {
  // Format dates
  const startDate = new Date(session.started_at);
  const dateStr = startDate.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl rounded-sm max-w-md w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div className={cn(
          "h-1 w-full",
          session.status === "aborted" ? "bg-red-500" : (session.status === "active" ? "bg-emerald-500" : "bg-stone-400 dark:bg-stone-700")
        )} />

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-stone-100 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-50 tracking-tight font-[family-name:var(--font-montserrat)]">
              {session.subject}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">Archive // {dateStr}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
          <SessionMetadata session={session} />

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

          <TimelineSection events={session.timeline || []} />

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

function SessionMetadata({ session }: { session: StudySession }) {
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

  return (
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
  );
}

function TimelineSection({ events }: { events: TimelineEvent[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length === 0) return null;

  return (
    <div className="border-t border-stone-100 dark:border-stone-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
      >
        <span className="text-xs uppercase tracking-wider font-medium">
          Timeline ({events.length} events)
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
        <div className="px-5 pb-5 pl-8 relative border-l border-stone-200 dark:border-stone-700 ml-5 space-y-4">
          {events.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  return (
    <div className="relative">
      {/* Node */}
      <div
        className={cn(
          "absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border bg-white dark:bg-stone-950",
          event.type === "START" && "border-stone-400 bg-stone-400",
          event.type === "END" && "border-stone-400",
          event.type === "WARNING" &&
            "border-amber-500/50 bg-amber-500/20 rounded-sm",
          event.type === "BREACH" &&
            "border-red-500/50 bg-red-500/20 rounded-sm",
          event.type === "INFO" && "border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 w-1.5 h-1.5",
        )}
      />

      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] text-stone-400 shrink-0 font-bold uppercase">
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
            "text-sm tracking-tight",
            event.type === "WARNING" &&
              "text-amber-700 dark:text-amber-400 font-medium",
            event.type === "BREACH" &&
              "text-red-700 dark:text-red-400 font-medium",
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
  );
}
