"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Command, Menu, Search } from "lucide-react";
import { cn, formatFullDate, istMarketOpen } from "@/lib/utils";
import { stockService } from "@/lib/services/stockService";
import { marketService } from "@/lib/services/marketService";
import { useAsync } from "@/lib/hooks/useAsync";
import { useAppStore } from "@/lib/store/useAppStore";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/markets": "Markets",
  "/research": "Research",
  "/portfolio": "Portfolio",
  "/watchlist": "Watchlist",
  "/advisor": "AI Advisor",
  "/learn": "Learn",
  "/tools": "Tools",
  "/news": "News",
  "/settings": "Settings",
};

function MarketStatus() {
  const open = istMarketOpen();
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold md:inline-flex",
        open
          ? "border-pos/30 bg-possoft text-pos"
          : "border-edge bg-surface2/70 text-secondary",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          open ? "animate-pulse bg-pos" : "bg-muted",
        )}
      />
      {open ? "Markets open" : "Markets closed"}
    </span>
  );
}

function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const watchlist = useAppStore((s) => s.watchlist);
  // Same services every other page uses — search prices always match Research.
  const { data: stocks } = useAsync(() => stockService.getStocks(), []);
  const { data: indices } = useAsync(() => marketService.getIndices(), []);

  const results = useMemo(() => {
    if (!q.trim()) return { stocks: [], indices: [] };
    const needle = q.trim().toLowerCase();
    return {
      stocks: (stocks ?? [])
        .filter(
          (s) =>
            s.symbol.toLowerCase().includes(needle) ||
            s.name.toLowerCase().includes(needle),
        )
        .slice(0, 6),
      indices: (indices ?? []).filter((i) => i.symbol.toLowerCase().includes(needle)).slice(0, 3),
    };
  }, [q, stocks, indices]);

  const go = (path: string) => {
    router.push(path);
    setFocused(false);
    setQ("");
    onNavigate?.();
  };

  return (
    <div className="relative w-full max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search stocks, indices…"
        className="input !py-2 !pl-9 !pr-14 text-[13px]"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-edge bg-surface3 px-1.5 py-0.5 text-[10px] font-medium text-muted sm:flex">
        <Command size={9} />K
      </kbd>

      {focused && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-edgestrong bg-surface3 shadow-2xl shadow-black/60">
          {results.stocks.length === 0 && results.indices.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted">
              No matches for “{q}”
            </div>
          )}
          {results.stocks.length > 0 && (
            <div className="px-1.5 py-1.5">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Stocks
              </div>
              {results.stocks.map((s) => (
                <button
                  key={s.symbol}
                  onMouseDown={() => go(`/research/${s.symbol}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-surface2"
                >
                  <span>
                    <span className="font-semibold text-ink">{s.symbol}</span>
                    <span className="ml-2 text-xs text-muted">{s.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {watchlist.includes(s.symbol) && (
                      <span className="text-[10px] text-gold">★</span>
                    )}
                    <span className="text-xs tnum text-secondary">
                      {s.currency === "INR" ? "₹" : "$"}
                      {s.price.toFixed(2)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.indices.length > 0 && (
            <div className="border-t border-edge px-1.5 py-1.5">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Indices
              </div>
              {results.indices.map((i) => (
                <button
                  key={i.symbol}
                  onMouseDown={() => go("/markets")}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface2"
                >
                  <span className="font-semibold text-ink">{i.symbol}</span>
                  <span className={cn("text-xs tnum", i.change >= 0 ? "text-pos" : "text-neg")}>
                    {i.change >= 0 ? "+" : ""}
                    {i.changePct.toFixed(2)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: "📈", title: "NVDA moved -2.23% today", meta: "Price alert · 2h ago", tone: "text-neg" },
    { icon: "📰", title: "3 new AI summaries in News", meta: "News · 4h ago", tone: "text-info" },
    { icon: "🎯", title: "Goal check: Emergency Fund is 70% funded", meta: "Goal · 1d ago", tone: "text-gold" },
    { icon: "📄", title: "Your monthly portfolio report is ready", meta: "Report · 3d ago", tone: "text-secondary" },
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-surface2/60 text-secondary transition-colors hover:border-edgestrong hover:text-ink"
        aria-label="Notifications"
      >
        <Bell size={16} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-edgestrong bg-surface3 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              <span className="text-[11px] text-muted">Sample alerts</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.map((n, i) => (
                <button
                  key={i}
                  className="flex w-full items-start gap-3 border-b border-edge/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface2"
                >
                  <span className={cn("mt-0.5 text-base", n.tone)}>{n.icon}</span>
                  <span>
                    <span className="block text-[13px] font-medium leading-snug text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{n.meta}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Artha";

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-bg/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={onMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-surface2/60 text-secondary lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={16} />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold text-ink">{title}</h2>
          <p className="hidden truncate text-[11px] text-muted sm:block">{formatFullDate()}</p>
        </div>

        <div className="hidden md:block">
          <SearchBox />
        </div>
        <MarketStatus />
        <div className="hidden md:block">
          <Notifications />
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-goldbright to-gold text-[13px] font-bold text-[#171207] ring-2 ring-gold/20 transition-transform hover:scale-105"
          aria-label="Profile"
        >
          S
        </button>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox onNavigate={onMenu} />
      </div>
    </header>
  );
}
