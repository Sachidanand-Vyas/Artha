"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, GraduationCap, LayoutDashboard, LineChart, PieChart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuthGuard } from "@/components/layout/AuthGate";

const BOTTOM_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/advisor", label: "Advisor", icon: Bot },
  { href: "/learn", label: "Learn", icon: GraduationCap },
];

/** Auth pages render standalone (no sidebar/topbar) — same dark/gold theme. */
const STANDALONE_ROUTES = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { ready, token } = useAuthGuard();
  const standalone = STANDALONE_ROUTES.includes(pathname);

  // Auth pages: render as-is while the session resolves.
  if (standalone) {
    return <div className="min-h-screen">{children}</div>;
  }

  // Protected route: wait for hydration/validation before showing anything,
  // so a logged-out visitor never sees the app (and a logged-in one never
  // flashes the login page).
  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-goldsoft">
            <span className="h-3 w-3 animate-pulse rounded-full bg-gold" />
          </span>
          <p className="text-xs text-muted">Loading Artha…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-edge bg-bgsoft shadow-2xl shadow-black/60">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface3 hover:text-ink"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main key={pathname} className="page-enter relative z-10 mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-bgsoft/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {BOTTOM_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors",
                  active ? "text-gold" : "text-muted",
                )}
              >
                <item.icon size={19} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
