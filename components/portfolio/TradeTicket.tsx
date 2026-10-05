"use client";

/**
 * TRADE TICKET — virtual BUY/SELL at real latest-available prices.
 *
 * Multi-currency (portfolio base = INR): a foreign stock shows its NATIVE
 * price AND the FX conversion the order will use — never "$341" that silently
 * deducts ₹341:
 *
 *   Price: $341.00 USD
 *   FX rate: 1 USD = ₹95.80
 *   Estimated cost: ₹32,667.80
 *   Available cash: ₹1,00,000 → After purchase: ₹67,332.20
 *
 * The current quote refreshes on its own (light endpoint) — historical data
 * is never refetched here. All validation happens here AND on the backend;
 * backend errors (insufficient cash/shares) are surfaced verbatim.
 */

import { useEffect, useState } from "react";
import { Loader2, Receipt, ShoppingCart, TrendingDown, TriangleAlert } from "lucide-react";
import type { Stock, StockSearchResult } from "@/lib/types";
import { portfolioService, type OrderSide } from "@/lib/services/portfolioService";
import { stockService } from "@/lib/services/stockService";
import { ApiError } from "@/lib/services/api";
import { cn, currencyOf, inr, inrPrecise } from "@/lib/utils";
import { usePoll } from "@/lib/hooks/usePoll";
import { Card, CardHeader } from "@/components/ui/Card";

interface TradeTicketProps {
  /** Universe list — datalist options + fallback price while quotes load. */
  stocks: Stock[];
  /** Available virtual cash — ALWAYS the INR base currency. */
  cash: number;
  owned: Record<string, number>;
  symbol: string;
  side: OrderSide;
  onSymbolChange?: (symbol: string) => void;
  onSideChange: (side: OrderSide) => void;
  /** Called after a successful order so the parent can reload. */
  onDone: () => void;
}

export function TradeTicket({
  stocks,
  cash,
  owned,
  symbol,
  side,
  onSymbolChange,
  onSideChange,
  onDone,
}: TradeTicketProps) {
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<StockSearchResult[]>([]);

  // Latest quote for this symbol: price, native currency and the FX rate the
  // order will use. Polls while visible (default 45s); no history/fundamentals.
  const { data: quote } = usePoll(() => stockService.getQuote(symbol), [symbol]);

  const stock = stocks.find((s) => s.symbol === symbol);
  const currency = quote?.currency ?? stock?.currency ?? "INR";
  const fmt = currencyOf(currency);
  const price = quote?.price ?? stock?.price ?? null;
  const name = quote?.name ?? stock?.name ?? "";
  /** INR rate for 1 unit of `currency` (1 for INR; null = FX unavailable). */
  const fxRate: number | null = currency === "INR" ? 1 : quote?.fxRate ?? null;
  const fxReady = fxRate != null;

  const ownedQty = owned[symbol] ?? 0;
  const qtyNum = Number(qty);

  const nativeEstimate =
    price != null && Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum * price : null;
  /** What actually moves from the INR cash balance (native × qty × FX). */
  const estimateInr = nativeEstimate != null && fxReady ? nativeEstimate * (fxRate ?? 1) : null;

  const editable = Boolean(onSymbolChange);

  // Dynamic suggestions: any searched company can be traded, not only the
  // preloaded universe (debounced; failures just leave the current options).
  useEffect(() => {
    if (!editable) return;
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
        .then((results) => {
          if (alive) setSuggestions(results);
        })
        .catch(() => {
          /* keep previous suggestions */
        });
    }, term.length < 2 ? 0 : 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [symbol, editable]);

  const canSubmit =
    price != null &&
    fxReady &&
    Number.isInteger(qtyNum) &&
    qtyNum > 0 &&
    (side === "BUY" ? estimateInr != null && estimateInr <= cash + 1e-6 : qtyNum <= ownedQty);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);

    if (price == null) {
      setError("Price unavailable for this symbol — try again in a moment.");
      return;
    }
    if (!fxReady) {
      setError(
        `FX rate ${currency}/INR is unavailable right now — the order cannot be ` +
          "valued in INR, so it was not placed.",
      );
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (side === "BUY") {
      if (estimateInr == null || estimateInr > cash) {
        const needed = estimateInr != null ? inrPrecise(estimateInr) : "—";
        const detail =
          currency !== "INR" && estimateInr != null
            ? ` (${qtyNum} × ${fmt(price)} ${currency} × ${fxRate} = ${needed})`
            : "";
        setError(
          `Insufficient virtual cash — you need ${needed}${detail} but have ${inr(cash)}.`,
        );
        return;
      }
    }
    if (side === "SELL" && qtyNum > ownedQty) {
      setError(`You own ${ownedQty} share${ownedQty === 1 ? "" : "s"} of ${symbol}.`);
      return;
    }

    setBusy(true);
    try {
      await portfolioService.order(symbol, side, qtyNum);
      const native = `${fmt(price)}${currency !== "INR" ? ` ${currency}` : ""}`;
      const inrNote =
        currency !== "INR" && estimateInr != null
          ? ` → ${inrPrecise(estimateInr)} ${side === "BUY" ? "deducted" : "credited"}`
          : " (virtual)";
      setSuccess(
        side === "BUY"
          ? `Bought ${qtyNum} × ${symbol} at ${native}${inrNote}.`
          : `Sold ${qtyNum} × ${symbol} at ${native}${inrNote}.`,
      );
      setQty("");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Order failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Trade (virtual)"
        subtitle="Latest available market prices · INR cash · paper money only"
        right={
          <div className="flex items-center gap-1 rounded-lg border border-edge bg-surface2/70 p-0.5">
            {(["BUY", "SELL"] as OrderSide[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  onSideChange(s);
                  setError(null);
                  setSuccess(null);
                }}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-bold transition-colors",
                  side === s
                    ? s === "BUY"
                      ? "bg-possoft text-pos"
                      : "bg-negsoft text-neg"
                    : "text-muted hover:text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />

      <form onSubmit={submit} className="mt-4 space-y-3">
        {/* Symbol */}
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-secondary">Stock</label>
          {onSymbolChange ? (
            <>
              <input
                list="trade-symbols"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
                onBlur={(e) => onSymbolChange(e.target.value.toUpperCase())}
                placeholder="RELIANCE"
                className="input font-mono uppercase"
              />
              <datalist id="trade-symbols">
                {optionSymbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.name}
                  </option>
                ))}
              </datalist>
            </>
          ) : (
            <div className="input font-mono">{symbol}</div>
          )}
          <p className="mt-1 text-[11px] text-muted">
            {name ? `${name} · ` : ""}
            {price != null
              ? `Latest price ${fmt(price)}${currency !== "INR" ? ` ${currency}` : ""}`
              : "Price unavailable — check the symbol"}
          </p>
        </div>

        {/* Quantity + INR estimate */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-secondary">Quantity</label>
            <input
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="10"
              className="input tnum"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-secondary">
              Estimated {side === "BUY" ? "cost" : "proceeds"} (INR)
            </label>
            <div className="input tnum !text-ink">
              {estimateInr != null
                ? currency === "INR"
                  ? fmt(estimateInr)
                  : inrPrecise(estimateInr)
                : "—"}
            </div>
          </div>
        </div>

        {/* Foreign stock: make the conversion explicit — never $-as-₹ */}
        {currency !== "INR" && (
          <div className="space-y-1.5 rounded-xl border border-edge bg-surface2/40 px-3.5 py-2.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">Price</span>
              <span className="tnum font-semibold text-ink">
                {price != null ? fmt(price) : "—"} {currency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">FX rate</span>
              <span className="tnum font-semibold text-ink">
                {fxRate != null ? `1 ${currency} = ${inr(fxRate)}` : "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-edge pt-1.5">
              <span className="text-muted">Estimated {side === "BUY" ? "cost" : "proceeds"}</span>
              <span className="tnum font-semibold text-ink">
                {estimateInr != null ? inrPrecise(estimateInr) : "—"}
              </span>
            </div>
          </div>
        )}

        {!fxReady && currency !== "INR" && (
          <p className="flex items-start gap-1.5 rounded-lg border border-gold/30 bg-goldsoft/50 px-3 py-2 text-[12px] text-secondary">
            <TriangleAlert size={13} className="mt-0.5 shrink-0 text-gold" />
            FX rate {currency}/INR is unavailable right now — trading is paused until the rate can be
            fetched. No conversion is guessed.
          </p>
        )}

        {/* Account state — cash is always the INR base currency */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-edge bg-surface2/40 px-3.5 py-2.5 text-[12px]">
          <span className="text-muted">
            Available cash <span className="ml-1 font-semibold tnum text-ink">{inr(cash)}</span>
          </span>
          {side === "BUY" && estimateInr != null && estimateInr <= cash && (
            <span className="text-muted">
              After purchase{" "}
              <span className="ml-1 font-semibold tnum text-ink">{inrPrecise(cash - estimateInr)}</span>
            </span>
          )}
          <span className="text-muted">
            You own{" "}
            <span className="ml-1 font-semibold tnum text-ink">
              {ownedQty} {symbol}
            </span>
          </span>
        </div>

        {error && (
          <p className="rounded-lg border border-neg/30 bg-negsoft/50 px-3 py-2 text-[12.5px] text-neg">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg border border-pos/30 bg-possoft/50 px-3 py-2 text-[12.5px] text-pos">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || busy}
          className={cn("w-full", side === "BUY" ? "btn-primary" : "btn-ghost")}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : side === "BUY" ? (
            <ShoppingCart size={15} />
          ) : (
            <TrendingDown size={15} />
          )}
          {side === "BUY" ? "Buy" : "Sell"} {qtyNum > 0 ? `${qtyNum} ` : ""} {symbol || ""}
        </button>
      </form>

      <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
        <Receipt size={11} className="mt-0.5 shrink-0" />
        Virtual money only — orders execute at the latest available price (may be delayed) and are recorded
        with the FX rate used. No real funds are involved.
      </p>
    </Card>
  );
}
