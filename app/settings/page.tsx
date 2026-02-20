"use client";

import { useTheme } from "next-themes";
import { usePreferences } from "@/components/preferences-provider";
import { Navigation } from "@/components/ui/Navigation";
import {
  Sun,
  Moon,
  Laptop,
  Shield,
  MoveVertical,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";
import * as React from "react";

export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const { density, setDensity } = usePreferences();
  const [isOnline, setIsOnline] = React.useState(() =>
    typeof window !== "undefined" ? navigator.onLine : true
  );

  React.useEffect(() => {
    const setTrue = () => setIsOnline(true);
    const setFalse = () => setIsOnline(false);
    window.addEventListener("online", setTrue);
    window.addEventListener("offline", setFalse);
    return () => {
      window.removeEventListener("online", setTrue);
      window.removeEventListener("offline", setFalse);
    };
  }, []);

  return (
    <main className="min-h-screen pb-24 bg-stone-50 dark:bg-stone-900">
      <div className="max-w-md mx-auto px-6 py-12">
        {/* Header and Appearance/Density sections... same as before... */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50 font-[family-name:var(--font-montserrat)]">
            Settings
          </h1>
          <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mt-1">
            Preferences & Status
          </p>
        </header>

        <div className="space-y-8">
          {/* Appearance Section */}
          <section>
            <h2 className="text-sm font-semibold text-stone-400 mb-4 font-[family-name:var(--font-montserrat)]">
              Appearance
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <ThemeButton
                currentTheme={theme}
                value="light"
                icon={Sun}
                label="Light"
                onClick={() => setTheme("light")}
              />
              <ThemeButton
                currentTheme={theme}
                value="dark"
                icon={Moon}
                label="Dark"
                onClick={() => setTheme("dark")}
              />
              <ThemeButton
                currentTheme={theme}
                value="system"
                icon={Laptop}
                label="System"
                onClick={() => setTheme("system")}
              />
            </div>
          </section>

          {/* Density Section */}
          <section>
            <h2 className="text-sm font-semibold text-stone-400 mb-4 font-[family-name:var(--font-montserrat)]">
              Timeline Density
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <ThemeButton
                currentTheme={density}
                value="cozy"
                icon={LayoutGrid}
                label="Cozy"
                onClick={() => setDensity("cozy")}
              />
              <ThemeButton
                currentTheme={density}
                value="compact"
                icon={MoveVertical}
                label="Compact"
                onClick={() => setDensity("compact")}
              />
            </div>
          </section>

          {/* Notification Thresholds */}
          <section>
            <h2 className="text-sm font-semibold text-stone-400 mb-4 font-[family-name:var(--font-montserrat)]">
              Notification Thresholds
            </h2>
            <div className="bg-white dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded-sm divide-y divide-stone-100 dark:divide-stone-800">
              <ToggleRow
                label="Notify me only on Breaches"
                defaultChecked={true}
              />
              <ToggleRow label="Notify on Session End" defaultChecked={false} />
            </div>
          </section>

          {/* Connection Status */}
          <section>
            <h2 className="text-sm font-semibold text-stone-400 mb-4 font-[family-name:var(--font-montserrat)]">
              Connection
            </h2>
            <div className="bg-white dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield
                  className={cn(
                    "w-5 h-5",
                    isOnline ? "text-stone-400" : "text-red-500",
                  )}
                />
                <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  {isOnline ? "Secure Status" : "Connection Lost"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isOnline ? "bg-emerald-500" : "bg-red-500",
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isOnline
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {isOnline ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Navigation />
    </main>
  );
}

function ThemeButton({
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

function ToggleRow({
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
