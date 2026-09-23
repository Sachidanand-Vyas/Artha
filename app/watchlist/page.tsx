"use client";

import { useMemo, useState } from "react";
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
import type { Stock } from "@/lib/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { useAsync } from "@/lib/hooks/useAsync";
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
  const options = universe
    .filter((s) => !watchlist.includes(s.symbol))
    .filter((s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);

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
                  placeholder="Search the universe…"
                  className="input !py-1.5 !pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {options.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted">
                  {watchlist.length >= universe.length ? "You track every asset in the universe." : "No matches."}
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
                  <span className="tnum text-xs text-secondary">
                    {s.currency === "INR" ? "₹" : "$"}
                    {s.price.toFixed(2)}
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

export default function WatchlistPage() {
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist);
  const { data: universe, loading, error, reload } = useAsync(() => stockService.getStocks(), []);

  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"All" | "Low" | "Moderate" | "High">("All");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    if (!universe) return [];
    let list = universe.filter((s) => watchlist.includes(s.symbol));
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
  }, [universe, watchlist, query, riskFilter, sortKey, sortDir]);

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
                  const rangePct = ((s.price - s.week52Low) / (s.week52High - s.week52Low)) * 100;
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
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex w-full justify-between text-[10px] tnum text-muted">
                            <span>{fmt(s.week52Low)}</span>
                            <span>{fmt(s.week52High)}</span>
                          </div>
                          <ProgressBar value={rangePct} tone="info" className="!h-1" />
                        </div>
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
        <span>
          Showing {rows.length} of {watchlist.length} tracked assets
        </span>
        <span>
          {rows[0]?.source ? `${rows[0].source} · latest available prices · click any asset to open research` : "Click any asset to open full research"}
        </span>
          </div>
        )}
      </Card>
    </div>
  );
}
