"use client";

/**
 * PORTFOLIO SETUP — the two ways to start:
 *   1. Virtual money: ₹1,00,000 paper cash to trade with real prices.
 *   2. Manual import: enter existing holdings (quantity + average price).
 *
 * Also renders the manual "add holding" form, used once a portfolio exists.
 */

import { useEffect, useState } from "react";
import { Loader2, PieChart, Wallet } from "lucide-react";
import type { Stock, StockSearchResult } from "@/lib/types";
import { portfolioService, type PortfolioMode } from "@/lib/services/portfolioService";
import { stockService } from "@/lib/services/stockService";
import { ApiError } from "@/lib/services/api";
import { currencyOf } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";

export function PortfolioSetup({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (mode: PortfolioMode) => {
    setBusy(true);
    setError(null);
    try {
      await portfolioService.start(mode);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start your portfolio — please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/25 bg-goldsoft text-gold">
            <Wallet size={18} />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-ink">Start with Virtual Money</h3>
            <p className="text-[11.5px] text-muted">Paper trading · ₹1,00,000 starting cash</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-secondary">
          You get <span className="font-semibold text-ink">₹1,00,000 of virtual cash</span> to buy real stocks at
          their latest available market prices. Cash, holdings and P&amp;L update exactly like a real broker —
          except no real money is ever involved.
        </p>
        <button onClick={() => start("virtual")} disabled={busy} className="btn-primary mt-4 w-full">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
          Start with ₹1,00,000
        </button>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-info/25 bg-infosoft text-info">
            <PieChart size={18} />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-ink">Add My Existing Holdings</h3>
            <p className="text-[11.5px] text-muted">Manual entry · no broker connection</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-secondary">
          Already invest? Enter each holding&apos;s quantity and average buy price — Artha values them at real
          market prices and calculates your P&amp;L. This is manual entry, not a broker link.
        </p>
        <button onClick={() => start("manual")} disabled={busy} className="btn-ghost mt-4 w-full">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <PieChart size={15} />}
          Continue to add holdings
        </button>
      </Card>

      {error && (
        <p className="rounded-lg border border-neg/30 bg-negsoft/50 px-3 py-2 text-[12.5px] text-neg lg:col-span-2">
          {error}
        </p>
      )}
    </div>
  );
}

/** Manual import form — symbol, quantity, average buy price. */
export function AddHoldingForm({
  stocks,
  onDone,
  onCancel,
}: {
  stocks: Stock[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<StockSearchResult[]>([]);

  // Debounced dynamic search: any listed company can be imported, not only
  // the preloaded universe (failures just leave the current options).
  useEffect(() => {
    const term = symbol.trim();
    let alive = true;
    // Debounced: state updates only inside the timer callback.
    const timer = setTimeout(() => {
      if (term.length < 2) {
        setSuggestions([]);
        return;
      }
      stockService
        .searchStocks(term, 8)
        .then((r) => {
          if (alive) setSuggestions(r);
        })
        .catch(() => {
          /* keep previous suggestions */
        });
    }, term.length < 2 ? 0 : 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [symbol]);

  const qtyNum = Number(qty);
  const costNum = Number(avgCost);
  const stock = stocks.find((s) => s.symbol === symbol.toUpperCase());
  const matched = suggestions.find((r) => r.symbol === symbol.toUpperCase());
  const currency = stock?.currency ?? matched?.currency ?? "INR";
  const known = Boolean(stock || matched);
  const valid =
    known && Number.isInteger(qtyNum) && qtyNum > 0 && Number.isFinite(costNum) && costNum > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!known) {
      setError("Search for a listed stock first (e.g. RELIANCE, TSLA, INFY).");
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (!Number.isFinite(costNum) || costNum <= 0) {
      setError("Average buy price must be greater than zero.");
      return;
    }
    setBusy(true);
    try {
      await portfolioService.addPosition(symbol.toUpperCase(), qtyNum, costNum);
      setSymbol("");
      setQty("");
      setAvgCost("");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add the holding — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const price = stock?.price;
  const fmtNative = currencyOf(currency);
  const optionSymbols = (() => {
    const seen = new Set<string>();
    const out: { symbol: string; name: string }[] = [];
    for (const s of [...stocks, ...suggestions.map((r) => ({ symbol: r.symbol, name: r.name }))]) {
      if (seen.has(s.symbol)) continue;
      seen.add(s.symbol);
      out.push(s);
    }
    return out;
  })();

  return (
    <Card className="p-5">
      <CardHeader
        title="Add a holding"
        subtitle="Manual import — quantity and average buy price are yours; the live price comes from the backend"
      />
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-secondary">Stock</label>
          <input
            list="add-holding-symbols"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onBlur={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="RELIANCE"
            className="input font-mono uppercase"
          />
          <datalist id="add-holding-symbols">
            {optionSymbols.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.name}
              </option>
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-muted">
            {stock
              ? `Now ${price != null ? fmtNative(price) : "price unavailable"}`
              : matched
                ? `${matched.exchange} · ${matched.currency}`
                : "Search any listed company"}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-secondary">Quantity</label>
          <input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="20"
            className="input tnum"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-secondary">
            Average buy price ({currency === "INR" ? "₹" : currency})
          </label>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            placeholder="2450"
            className="input tnum"
          />
          {currency !== "INR" && (
            <p className="mt-1 text-[11px] text-muted">
              In {currency} — converted to an INR cost basis once, at today&apos;s rate.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-neg/30 bg-negsoft/50 px-3 py-2 text-[12.5px] text-neg sm:col-span-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 sm:col-span-3">
          <button type="submit" disabled={!valid || busy} className="btn-primary">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Add holding
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Imports don&apos;t touch your virtual cash — that money was spent outside Artha. Importing is not broker
        integration; you enter the numbers yourself.
      </p>
    </Card>
  );
}
