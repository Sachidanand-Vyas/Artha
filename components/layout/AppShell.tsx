"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, GraduationCap, LayoutDashboard, LineChart, PieChart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const BOTTOM_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/advisor", label: "Advisor", icon: Bot },
  { href: "/learn", label: "Learn", icon: GraduationCap },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

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
