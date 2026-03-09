"use client";

import { useEffect, useState } from "react";
import { Info, Check, ArrowRight, Zap } from "lucide-react";
import { AppUpdate } from "@/lib/backend/variables";

interface UpdateModalProps {
  update: AppUpdate | null;
  onAcknowledge: () => void;
}

export function UpdateModal({
  update,
  onAcknowledge,
}: UpdateModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    if (!update) return;
    // Show modal if update is new and not seen
    setIsOpen(update.isNew && !update.seen);
  }, [update]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      const res = await fetch("/api/client/acknowledge-update", { method: "POST" });
      if (res.ok) {
        onAcknowledge();
        setIsOpen(false);
      } else {
        console.error("Failed to acknowledge update");
      }
    } catch (error) {
      console.error("Failed to acknowledge update", error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (!isOpen || !update) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/60 backdrop-blur-xl p-4 animate-in fade-in duration-700">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-none max-w-lg w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        {/* Progress Bar / Aesthetic Accent */}
        <div className="h-[2px] w-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div className="h-full bg-stone-900 dark:bg-stone-50 animate-progress origin-left" />
        </div>
        
        <div className="p-10 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-stone-900 dark:bg-stone-50 rounded-none transform rotate-45 group hover:rotate-90 transition-transform duration-500">
                <Zap className="w-4 h-4 text-white dark:text-stone-900 transform -rotate-45" />
              </div>
              <h2 className="text-[10px] font-bold tracking-[0.3em] text-stone-500 uppercase font-mono">
                System Update // v0.1.X
              </h2>
            </div>
            <div className="px-2 py-0.5 border border-stone-200 dark:border-stone-800 text-[9px] font-mono text-stone-400 uppercase tracking-tighter">
              Awaiting Acknowledgement
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 font-sans leading-tight">
              A new iteration <br /> 
              <span className="text-stone-400 dark:text-stone-600 italic">has been deployed.</span>
            </h3>
            
            <div className="relative">
              <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-stone-100 dark:bg-stone-800" />
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-base font-serif pl-2">
                {update.message}
              </p>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-950/50 border-l-2 border-stone-900 dark:border-stone-50">
              <div className="flex gap-3">
                <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-stone-500 dark:text-stone-500 leading-relaxed font-mono uppercase tracking-wide">
                  Accountability protocol: By acknowledging, you confirm receipt of this update and its implications on your workflow.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="group relative w-full flex items-center justify-between bg-stone-900 dark:bg-stone-50 text-white dark:text-stone-900 hover:bg-black dark:hover:bg-white py-5 px-8 rounded-none transition-all duration-300 disabled:opacity-50 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-3 font-bold font-mono text-xs uppercase tracking-[0.2em]">
              {isAcknowledging ? (
                "Processing Integrity Check..."
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Acknowledge Protocol</span>
                </>
              )}
            </span>
            {!isAcknowledging && (
              <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 relative z-10" />
            )}
            
            {/* Hover Slide Effect */}
            <div className="absolute inset-0 bg-stone-800 dark:bg-stone-200 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          </button>
        </div>
        
        {/* Footer Aesthetic */}
        <div className="px-10 py-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-1 h-1 bg-stone-200 dark:bg-stone-800" />
            ))}
          </div>
          <span className="text-[9px] font-mono text-stone-300 dark:text-stone-700 tracking-[0.5em] uppercase">
            HIA // Internal
          </span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress 2s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
      `}</style>
    </div>
  );
}
