"use client";

import { MissedHeartbeatModal } from "@/components/ui/MissedHeartbeatModal";
import { UpdateModal } from "@/components/ui/UpdateModal";
import { HeartbeatResumedModal } from "@/components/ui/HeartbeatResumedModal";
import { BlocklistTamperModal } from "@/components/ui/BlocklistTamperModal";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { SummaryPanel } from "@/components/ui/SummaryPanel";
import { BlocklistPanel } from "@/components/ui/BlocklistPanel";
import { Timeline } from "@/components/ui/Timeline";
import { Navigation } from "@/components/ui/Navigation";
import { useSessionState } from "@/lib/hooks/use-session-state";

export default function Home() {
  const {
    status,
    timerData,
    missedHeartbeatInfo,
    showResumedModal,
    setShowResumedModal,
    timelineEvents,
    data,
    isLoading,
    mutate
  } = useSessionState();

  return (
    <main className="min-h-screen pb-24 transition-colors duration-700">
      <MissedHeartbeatModal 
        logs={data?.logs} 
        onAcknowledge={() => mutate()} 
        missedCount={missedHeartbeatInfo?.count || 0}
      />
      <HeartbeatResumedModal 
        isOpen={showResumedModal} 
        onClose={() => setShowResumedModal(false)} 
      />
      <UpdateModal update={data?.systemUpdate} onAcknowledge={() => mutate()} />
      <BlocklistTamperModal logs={data?.logs} onAcknowledge={() => mutate()} />
      <StatusPanel
        status={status === "REFLECTION" ? "IDLE" : status}
        isReflection={status === "REFLECTION"}
        subject={data?.activeSession?.subject || data?.activeBreak?.next_session?.subject || data?.summary?.subject}
        duration={timerData.display}
        progressPercent={timerData.progressPercent}
        startTime={timerData.startTime}
        endTime={timerData.endTime}
        isOvertime={timerData.isOvertime}
      />

      {(status === "FOCUSING" || status === "REFLECTION" || status === "BREAK") && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards">
          <SummaryPanel
            summary={
              status === "FOCUSING"
                ? (missedHeartbeatInfo 
                    ? `ALERT: ${missedHeartbeatInfo.count} heartbeats missed. Last seen ${missedHeartbeatInfo.gapMinutes.toFixed(1)}m ago. This could mean Darsh is cheating.`
                    : (data?.summary?.session_id === "break-system" ? data?.summary?.summary_text : "Session active. Monitoring for interruptions."))
                : status === "BREAK"
                ? `On break. Preparing for ${data?.activeBreak?.next_session?.subject}.`
                : data?.summary?.summary_text || "Session closed."
            }
          />
          <BlocklistPanel sites={data?.blocklist} />
          <Timeline events={timelineEvents} />
        </div>
      )}

      {status === "IDLE" && !isLoading && !data?.summary && (
        <div className="flex justify-center items-center h-48 opacity-50 animate-in fade-in duration-1000">
          <p className="text-sm font-mono tracking-widest uppercase text-stone-400">
            System Standby
          </p>
        </div>
      )}

      <Navigation />
    </main>
  );
}
