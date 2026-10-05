"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import type { Quote, Stock, StockSearchResult } from "@/lib/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatClock, usePoll } from "@/lib/hooks/usePoll";
import { stockService } from "@/lib/services/stockService";
import { cn, currencyOf, marketCapLabel, num2 } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { RiskBadge, TrendBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, PageHeader, SkeletonRows } from "@/components/ui/States";
import { ProgressBar } from "@/components/ui/Progress";

type SortKey = "symbol" | "price" | "changePct" | "marketCap" | "pe" | "risk";
const RISK_ORDER: Record<string, number> = { Low: 0, Moderate: 1, High: 2 };

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown size={12} className="opacity-40" />;
  return dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

function Th({
  label,
  k,
  className,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k?: SortKey;
  className?: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted",
        k && "cursor-pointer select-none transition-colors hover:text-ink",
        className,
      )}
      onClick={k ? () => onSort(k) : undefined}
    >
      {k ? (
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon active={sortKey === k} dir={sortDir} />
        </span>
      ) : (
        label
      )}
    </th>
  );
}

function AddAssetMenu({
  universe,
  watchlist,
  onAdd,
}: {
  universe: Stock[];
  watchlist: string[];
  onAdd: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced dynamic search — any listed company, fetched on demand.
  // State updates happen inside the timer callback, never synchronously in
  // the effect body.
  useEffect(() => {
    const term = q.trim();
    let alive = true;
    const timer = setTimeout(() => {
      if (!term) {
        setHits([]);
        setSearched(false);
        setSearchError(null);
        return;
      }
      stockService
        .searchStocks(term, 8)
        .then((r) => {
          if (!alive) return;
          setHits(r);
          setSearchError(null);
        })
        .catch((e: unknown) => {
          if (alive) setSearchError(e instanceof Error ? e.message : "Search failed.");
        })
        .finally(() => {
          if (alive) setSearched(true);
        });
    }, term ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  type Option = { symbol: string; name: string; sub: string };
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: Option[] = [];
    const seen = new Set<string>();
    const add = (symbol: string, name: string, sub: string) => {
      if (watchlist.includes(symbol) || seen.has(symbol)) return;
      seen.add(symbol);
      out.push({ symbol, name, sub });
    };
    for (const s of universe) {
      if (!needle || s.symbol.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)) {
        add(s.symbol, s.name, currencyOf(s.currency)(s.price));
      }
    }
    if (needle) {
      for (const h of hits) {
        add(h.symbol, h.name, `${h.exchange} · ${h.currency}`);
      }
    }
    return out.slice(0, 8);
  }, [q, universe, hits, watchlist]);

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary !py-2 text-xs">
        <Plus size={14} /> Add asset
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-edgestrong bg-surface3 shadow-2xl shadow-black/60">
            <div className="border-b border-edge p-2.5">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search any listed company…"
                  className="input !py-1.5 !pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {options.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted">
                  {searchError
                    ? searchError
                    : q.trim() && searched
                      ? "No matching company found."
                      : "You track every asset in the universe — search for any company by name."}
                </p>
              )}
              {options.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => {
                    onAdd(s.symbol);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface2"
                >
                  <span>
                    <span className="font-semibold text-ink">{s.symbol}</span>
                    <span className="ml-2 text-xs text-muted">{s.name}</span>
                  </span>
                  <span className="tnum text-xs text-secondary">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist);
  const { data: universe, loading, error, reload } = useAsync(() => stockService.getStocks(), []);

  // Current-quote refresh (every 45s while the tab is visible). The heavier
  // universe payload (fundamentals/technicals) is NOT refetched — only the
  // light quote endpoint is. On failure last-known values stay + a stale note.
  const watchKey = watchlist.join(",");
  const { data: quotes, lastUpdated, error: quoteError } = usePoll(
    () => stockService.getQuotes(watchlist),
    [watchKey],
  );
  const quoteBySymbol = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const q of quotes ?? []) {
      map.set(q.symbol, q);
      if (q.ticker) map.set(q.ticker, q);
    }
    return map;
  }, [quotes]);

  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"All" | "Low" | "Moderate" | "High">("All");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    if (!universe) return [];
    // 1. Tracked-universe rows, refreshed with the latest polled quotes.
    const merged: Stock[] = universe
      .filter((s) => watchlist.includes(s.symbol))
      .map((s) => {
        const q = quoteBySymbol.get(s.symbol);
        if (!q || q.price == null) return s;
        return {
          ...s,
          price: q.price,
          change: q.change ?? s.change,
          changePct: q.changePercent ?? s.changePct,
          currency: q.currency || s.currency,
          timestamp: q.timestamp ?? s.timestamp,
        };
      });
    // 2. Watchlist symbols found via search but not in the tracked universe.
    const known = new Set(merged.map((s) => s.symbol));
    for (const sym of watchlist) {
      if (known.has(sym)) continue;
      const q = quoteBySymbol.get(sym);
      if (!q || q.price == null) continue; // unpriced -> never faked
      known.add(sym);
      merged.push({
        symbol: sym,
        name: q.name || sym,
        exchange: q.exchange,
        country: q.country,
        sector: q.sector ?? "Other",
        currency: q.currency,
        price: q.price,
        change: q.change ?? 0,
        changePct: q.changePercent ?? 0,
        marketCap: null,
        pe: null,
        pb: null,
        roe: null,
        roce: null,
        debtToEquity: null,
        dividendYield: null,
        eps: null,
        revenue: null,
        netProfit: null,
        week52High: null,
        week52Low: null,
        risk: null,
        beta: null,
        insight: "",
        summary: "",
        timestamp: q.timestamp ?? undefined,
        source: q.source,
      });
    }
    let list = merged;
    if (riskFilter !== "All") list = list.filter((s) => s.risk === riskFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "changePct":
          cmp = a.changePct - b.changePct;
          break;
        case "marketCap":
          cmp = (a.marketCap ?? -Infinity) - (b.marketCap ?? -Infinity);
          break;
        case "pe":
          cmp = (a.pe ?? Infinity) - (b.pe ?? Infinity);
          break;
        case "risk":
          cmp = (a.risk ? RISK_ORDER[a.risk] : 99) - (b.risk ? RISK_ORDER[b.risk] : 99);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [universe, watchlist, quoteBySymbol, query, riskFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        subtitle="Track the assets you care about. Prices, fundamentals and insights come from the backend market-data service (latest available, may be delayed)."
        right={<AddAssetMenu universe={universe ?? []} watchlist={watchlist} onAdd={toggleWatchlist} />}
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or name…"
              className="input !py-2 !pl-9 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(["All", "Low", "Moderate", "High"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  riskFilter === r
                    ? "bg-surface3 text-ink"
                    : "text-muted hover:bg-surface2 hover:text-secondary",
                )}
              >
                {r === "All" ? "All risk" : r}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorState onRetry={reload} />
          </div>
        ) : loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={watchlist.length === 0 ? "Your watchlist is empty" : "No assets match"}
              message={
                watchlist.length === 0
                  ? "Add assets from the tracked universe to watch prices, fundamentals and insights in one place."
                  : "Try a different search term or risk filter."
              }
              action={
                watchlist.length === 0 ? (
                  <button
                    onClick={() => {
                      const first = universe?.[0];
                      if (first) toggleWatchlist(first.symbol);
                    }}
                    className="btn-ghost text-xs"
                  >
                    <Star size={13} /> Track your first asset
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-edge bg-surface2/30">
                  <Th label="Asset" k="symbol" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="Price" k="price" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <Th label="Change" k="changePct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <Th label="Market Cap" k="marketCap" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <Th label="P/E" k="pe" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <Th label="52W Range" className="w-[160px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="Risk" k="risk" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="AI Insight" className="w-[240px]" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <Th label="" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/60">
                {rows.map((s) => {
                  const fmt = currencyOf(s.currency);
                  const rangePct =
                    s.week52High != null && s.week52Low != null && s.week52High > s.week52Low
                      ? ((s.price - s.week52Low) / (s.week52High - s.week52Low)) * 100
                      : null;
                  return (
                    <tr key={s.symbol} className="group transition-colors hover:bg-surface2/50">
                      <td className="px-3 py-3">
                        <Link href={`/research/${s.symbol}`} className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface2 font-mono text-[10px] font-bold text-gold">
                            {s.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-ink">{s.symbol}</p>
                            <p className="max-w-40 truncate text-[11px] text-muted">{s.name}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-bold tnum text-ink">{fmt(s.price)}</td>
                      <td className="px-3 py-3 text-right">
                        <TrendBadge value={s.change} pct={s.changePct} />
                      </td>
                      <td className="px-3 py-3 text-right tnum text-secondary">
                        {s.marketCap != null ? marketCapLabel(s.marketCap, s.currency) : "N/A"}
                      </td>
                      <td className="px-3 py-3 text-right tnum text-secondary">{s.pe != null ? num2(s.pe) : "N/A"}</td>
                      <td className="px-3 py-3">
                        {rangePct == null || s.week52Low == null || s.week52High == null ? (
                          <span className="text-xs text-muted">N/A</span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex w-full justify-between text-[10px] tnum text-muted">
                              <span>{fmt(s.week52Low)}</span>
                              <span>{fmt(s.week52High)}</span>
                            </div>
                            <ProgressBar value={rangePct} tone="info" className="!h-1" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <RiskBadge risk={s.risk} />
                      </td>
                      <td className="px-3 py-3">
                        <p
                          className="line-clamp-2 text-[11.5px] leading-snug text-secondary"
                          title={s.insight}
                        >
                          {s.insight}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleWatchlist(s.symbol)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-negsoft hover:text-neg"
                          aria-label={`Remove ${s.symbol}`}
                          title="Remove from watchlist"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-edge px-4 py-2.5 text-[11px] text-muted">
        <span className="flex flex-wrap items-center gap-2">
          <span>
            Showing {rows.length} of {watchlist.length} tracked assets
          </span>
          <span>
            {lastUpdated ? `Last updated ${formatClock(lastUpdated)}` : "Loading latest quotes…"}
            {quoteError ? " · refresh failed — showing last known values" : ""} · latest available prices,
            may be delayed · click any asset to open research
          </span>
        </span>
          </div>
        )}
      </Card>
    </div>
  );
}
