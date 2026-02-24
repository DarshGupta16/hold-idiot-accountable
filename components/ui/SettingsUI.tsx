"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";

export function ThemeButton({
  currentTheme,
  value,
  icon: Icon,
  label,
  onClick,
}: {
  currentTheme?: string;
  value: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  const isActive = currentTheme === value;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center py-4 rounded-sm border transition-all duration-200",
        isActive
          ? "border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          : "border-stone-200 dark:border-stone-800 text-stone-400 hover:border-stone-300 dark:hover:border-stone-700 hover:text-stone-600 dark:hover:text-stone-300",
      )}
    >
      <Icon className="w-5 h-5 mb-2" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export function ToggleRow({
  label,
  defaultChecked,
}: {
  label: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = React.useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-sm text-stone-600 dark:text-stone-300">
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={setChecked} />
    </div>
  );
}
