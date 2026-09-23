"use client";

/**
 * TRADE TICKET — virtual BUY/SELL at real latest-available prices.
 *
 * Used on the Portfolio page (with a symbol picker) and on Research (fixed
 * symbol). All validation happens here AND on the backend; errors from the
 * backend (insufficient cash / shares) are surfaced verbatim.
 */

import { useState } from "react";
import { Loader2, Receipt, ShoppingCart, TrendingDown } from "lucide-react";
import type { Stock } from "@/lib/types";
import { portfolioService, type OrderSide } from "@/lib/services/portfolioService";
import { ApiError } from "@/lib/services/api";
import { cn, currencyOf } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";

interface TradeTicketProps {
  /** Universe list — used for the picker and the displayed live price. */
  stocks: Stock[];
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

  const stock = stocks.find((s) => s.symbol === symbol);
  const fmt = currencyOf(stock?.currency ?? "INR");
  const price = stock?.price ?? null;
  const ownedQty = owned[symbol] ?? 0;
  const qtyNum = Number(qty);
  const estimate = price != null && Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum * price : null;

  const canSubmit =
    !!stock &&
    price != null &&
    Number.isInteger(qtyNum) &&
    qtyNum > 0 &&
    (side === "BUY" ? estimate! <= cash + 1e-6 : qtyNum <= ownedQty);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);

    if (!stock || price == null) {
      setError("Pick a tracked stock first.");
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }
    if (side === "BUY" && estimate != null && estimate > cash) {
      setError(`Insufficient virtual cash — you need ${fmt(estimate)} but have ${fmt(cash)}.`);
      return;
    }
    if (side === "SELL" && qtyNum > ownedQty) {
      setError(`You own ${ownedQty} share${ownedQty === 1 ? "" : "s"} of ${symbol}.`);
      return;
    }

    setBusy(true);
    try {
      await portfolioService.order(symbol, side, qtyNum);
      setSuccess(
        side === "BUY"
          ? `Bought ${qtyNum} × ${symbol} at ${fmt(price)} (virtual).`
          : `Sold ${qtyNum} × ${symbol} at ${fmt(price)} (virtual).`,
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
        subtitle="Real market prices · paper money only"
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
                {stocks.map((s) => (
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
            {stock ? `${stock.name} · ` : ""}
            {price != null ? `Latest price ${fmt(price)}` : "Price unavailable — pick a tracked stock"}
          </p>
        </div>

        {/* Quantity */}
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
              {side === "BUY" ? "Estimated cost" : "Estimated proceeds"}
            </label>
            <div className="input tnum !text-ink">
              {estimate != null ? fmt(estimate) : "—"}
            </div>
          </div>
        </div>

        {/* Account state */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-edge bg-surface2/40 px-3.5 py-2.5 text-[12px]">
          <span className="text-muted">
            Available cash <span className="ml-1 font-semibold tnum text-ink">{fmt(cash)}</span>
          </span>
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
          {side === "BUY" ? "Buy" : "Sell"} {qtyNum > 0 ? `${qtyNum} ` : ""}
          {symbol || ""}
        </button>
      </form>

      <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
        <Receipt size={11} className="mt-0.5 shrink-0" />
        Virtual money only — orders execute at the latest available market price and are recorded in your
        transaction history. No real funds are involved.
      </p>
    </Card>
  );
}
