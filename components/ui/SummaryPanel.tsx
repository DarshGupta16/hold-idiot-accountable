import { cn } from "@/lib/utils";

interface SummaryPanelProps {
  summary: string;
}

export function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <div className="w-full max-w-md mx-auto px-6">
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm p-6 rounded-sm">
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">
          Session Insight
        </h2>
        <p className="text-stone-700 dark:text-stone-300 font-[family-name:var(--font-lora)] leading-relaxed text-sm sm:text-base">
          {summary}
        </p>
      </div>
    </div>
  );
}
