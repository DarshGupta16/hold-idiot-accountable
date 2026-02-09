"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

interface BlocklistPanelProps {
  sites: string[];
}

export function BlocklistPanel({ sites }: BlocklistPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sites || sites.length === 0) return null;

  const displayLimit = 2;
  const hasMore = sites.length > displayLimit;
  const visibleSites = isExpanded ? sites : sites.slice(0, displayLimit);

  return (
    <div className="w-full max-w-md mx-auto px-6">
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm p-6 rounded-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            Active Blocklist
          </h2>
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter hover:text-stone-600 dark:hover:text-stone-200 transition-colors flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  Show Less <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Show {sites.length - displayLimit} more <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {visibleSites.map((site, index) => (
            <div
              key={index}
              className="text-stone-600 dark:text-stone-400 font-mono text-xs py-1 px-2 bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 rounded-sm truncate"
              title={site}
            >
              {site}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
