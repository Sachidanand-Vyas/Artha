"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Newspaper,
  PieChart,
  Search,
  Settings,
  Star,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";

const NAV = [
  {
    section: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
      { href: "/markets", label: "Markets", icon: LineChart, match: (p: string) => p.startsWith("/markets") },
      { href: "/research/RELIANCE", label: "Research", icon: Search, match: (p: string) => p.startsWith("/research") },
      { href: "/news", label: "News", icon: Newspaper, match: (p: string) => p.startsWith("/news") },
    ],
  },
  {
    section: "Portfolio",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: PieChart, match: (p: string) => p.startsWith("/portfolio") },
      { href: "/watchlist", label: "Watchlist", icon: Star, match: (p: string) => p.startsWith("/watchlist") },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/advisor", label: "AI Advisor", icon: Bot, match: (p: string) => p.startsWith("/advisor") },
      { href: "/learn", label: "Learn", icon: GraduationCap, match: (p: string) => p.startsWith("/learn") },
      { href: "/tools", label: "Tools", icon: Wrench, match: (p: string) => p.startsWith("/tools") },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 hide-scrollbar">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="section-label px-3 pb-2">{group.section}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150",
                      active
                        ? "bg-goldsoft text-gold"
                        : "text-secondary hover:bg-surface3 hover:text-ink",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold" />
                    )}
                    <item.icon
                      size={17}
                      className={cn(
                        "transition-colors",
                        active ? "text-gold" : "text-muted group-hover:text-secondary",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-edge p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="chip !border-gold/25 !bg-goldsoft text-[10px] text-gold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
            </span>
            Latest data
          </span>
          <span className="text-[10px] text-muted">v0.1</span>
        </div>
        <p className="text-[10.5px] leading-relaxed text-muted">
          Market data: Yahoo Finance via FastAPI (latest available, may be delayed). Educational — not financial
          advice.
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-edge bg-bgsoft/80 backdrop-blur-xl lg:block">
      <SidebarContent />
    </aside>
  );
}
