"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { cn } from "@/lib/utils";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900">
      <TopNav onMenuClick={() => setSidebarOpen((o) => !o)} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* ── Mobile backdrop ── */}
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-20 bg-black/60 transition-opacity duration-300 lg:hidden",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />

        {/* ── Sidebar (drawer on mobile, static on desktop) ── */}
        <aside
          className={cn(
            // Base — always a fixed drawer on mobile
            "fixed bottom-0 left-0 top-14 z-30 w-72 transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            // Desktop override — back in normal flow, always visible
            "lg:relative lg:top-0 lg:block lg:w-64 lg:shrink-0 lg:translate-x-0"
          )}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
