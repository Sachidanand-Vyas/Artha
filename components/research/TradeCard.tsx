"use client";

/**
 * Trade card on the Research page — buy/sell this stock with virtual money at
 * the real latest-available price. Shows the user's actual cash and holdings;
 * with no portfolio it links to the setup flow instead of pretending.
 */

import Link from "next/link";
import { useAsync } from "@/lib/hooks/useAsync";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import { stockService } from "@/lib/services/stockService";
import type { Stock } from "@/lib/types";
import { TradeTicket } from "@/components/portfolio/TradeTicket";
import { SkeletonRows } from "@/components/ui/States";
import { useState } from "react";
import type { OrderSide } from "@/lib/services/portfolioService";

type Data =
  | { kind: "no-portfolio" }
  | { kind: "ready"; cash: number; owned: Record<string, number>; stocks: Stock[] };

async function load(): Promise<Data> {
  try {
    const [state, stocks] = await Promise.all([
      portfolioService.getState(),
      stockService.getStocks(),
    ]);
    if (!state.exists) return { kind: "no-portfolio" };
    const holdings = await portfolioService.getHoldings();
    const owned = Object.fromEntries(holdings.map((h) => [h.symbol, h.qty]));
    return { kind: "ready", cash: state.cash, owned, stocks };
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return { kind: "no-portfolio" };
    throw e;
  }
}

export function TradeCard({ symbol }: { symbol: string }) {
  const { data, loading, reload } = useAsync(load, []);
  const [side, setSide] = useState<OrderSide>("BUY");

  if (loading || !data) {
    return (
      <div className="card p-5">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (data.kind === "no-portfolio") {
    return (
      <div className="card p-5">
        <p className="text-sm font-bold text-ink">Trade this stock (virtual)</p>
        <p className="mt-2 text-[13px] leading-relaxed text-secondary">
          Your portfolio isn&apos;t set up yet — set it up to buy {symbol} with ₹1,00,000 of virtual cash at real
          market prices.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portfolio?setup=virtual" className="btn-primary !py-2 text-xs">
            Start Virtual Portfolio
          </Link>
          <Link href="/portfolio?setup=manual" className="btn-ghost !py-2 text-xs">
            Add Existing Holdings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TradeTicket
      stocks={data.stocks}
      cash={data.cash}
      owned={data.owned}
      symbol={symbol}
      side={side}
      onSideChange={setSide}
      onDone={reload}
    />
  );
}
