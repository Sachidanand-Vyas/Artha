"use client";

/**
 * Artha Intelligence on the dashboard — computed from the logged-in user's
 * real holdings. With no portfolio it shows a setup prompt; it never falls
 * back to sample data.
 */

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import { buildPortfolioInsight } from "@/lib/insights";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAsync } from "@/lib/hooks/useAsync";
import { StatusPill } from "@/components/ui/Badge";
import { ErrorState, SkeletonRows } from "@/components/ui/States";

type InsightData =
  | { kind: "no-portfolio" }
  | { kind: "unpriced" }
  | { kind: "insight"; insight: NonNullable<ReturnType<typeof buildPortfolioInsight>> };

async function loadInsight(): Promise<InsightData> {
  try {
    const [summary, holdings, sectors] = await Promise.all([
      portfolioService.getSummary(),
      portfolioService.getHoldings(),
      portfolioService.getSectorAllocation(),
    ]);
    const riskProfile = useAuthStore.getState().user?.risk_profile ?? null;
    const insight = buildPortfolioInsight({ summary, holdings, sectors, riskProfile });
    if (!insight) return { kind: "unpriced" };
    return { kind: "insight", insight };
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return { kind: "no-portfolio" };
    throw e;
  }
}

export function AIInsightCard() {
  const { data, loading, error, reload } = useAsync(loadInsight, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-goldsoft/60 to-surface p-5">
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-goldsoft/60 to-surface p-5">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (data.kind === "no-portfolio") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-goldsoft/60 to-surface p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="section-label flex items-center gap-1.5 !text-gold">
              <Sparkles size={12} />
              Artha Intelligence
            </span>
            <StatusPill tone="info">No data yet</StatusPill>
          </div>
          <h3 className="mt-3 text-lg font-bold leading-snug text-ink">
            Add holdings to receive portfolio insights.
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">
            Artha only comments on what actually exists — once your portfolio is set up, insights like sector
            concentration and position size are calculated from your real holdings and live market prices.
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
      </div>
    );
  }

  if (data.kind === "unpriced") {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-goldsoft/60 to-surface p-5">
        <span className="section-label flex items-center gap-1.5 !text-gold">
          <Sparkles size={12} />
          Artha Intelligence
        </span>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          Your holdings exist but could not be priced right now — market data is unavailable, so no insight is
          shown rather than a guessed one.
        </p>
        <button onClick={reload} className="btn-ghost mt-4 !py-1.5 text-xs">
          Try again
        </button>
      </div>
    );
  }

  const { tag, title, insight, why, action, caveat } = data.insight;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-goldsoft/60 to-surface p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="section-label flex items-center gap-1.5 !text-gold">
            <Sparkles size={12} />
            Artha Intelligence
          </span>
          <StatusPill tone="gold">{tag}</StatusPill>
        </div>

        <h3 className="mt-3 text-lg font-bold leading-snug text-ink">{title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">{insight}</p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-edge bg-surface/80 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-info">Why this matters</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">{why}</p>
          </div>
          <div className="rounded-xl border border-edge bg-surface/80 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Suggested check</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">{action}</p>
          </div>
        </div>

        <p className="mt-4 border-t border-edge/70 pt-3 text-[10.5px] leading-relaxed text-muted">{caveat}</p>
      </div>
    </div>
  );
}
