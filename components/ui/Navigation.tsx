"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Settings } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-md pb-safe z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        <NavLink
          href="/"
          icon={Home}
          label="Observe"
          isActive={pathname === "/"}
        />
        <NavLink
          href="/logs"
          icon={History}
          label="History"
          isActive={pathname === "/logs"}
        />
        <NavLink
          href="/settings"
          icon={Settings}
          label="Settings"
          isActive={pathname === "/settings"}
        />
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  isActive = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 p-2 transition-colors ${
        isActive
          ? "text-stone-900 dark:text-stone-100"
          : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
      }`}
    >
      <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
    </Link>
  );
}
