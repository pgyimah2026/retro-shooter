"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Menu, MessageSquare, BookOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/tools", label: "Tools", icon: Wrench },
];

export default function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-slate-800 bg-slate-900 px-4 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
          <BarChart2 className="h-5 w-5 text-white" />
        </div>
        <span className="hidden font-semibold text-slate-100 sm:block">AcctTutor</span>
      </div>

      <div className="flex-1" />

      {/* Nav links */}
      <nav className="flex items-center gap-0.5 mr-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                active
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Hamburger — threads sidebar toggle, mobile only */}
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 lg:hidden"
        aria-label="Toggle threads"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}
