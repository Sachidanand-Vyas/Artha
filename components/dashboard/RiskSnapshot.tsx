"use client";

/**
 * Dashboard "Portfolio Health" — real concentration/composition metrics
 * computed from the logged-in user's holdings. No sample risk scores: when
 * there is no portfolio (or no priced holdings) the card says so.
 */

import Link from "next/link";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import { useAsync } from "@/lib/hooks/useAsync";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { InfoTooltip } from "@/components/ui/Tooltip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";

type HealthData =
  | { kind: "no-portfolio" }
  | { kind: "unpriced" }
  | {
      kind: "ready";
      positions: number;
      priced: number;
      topSector: { sector: string; pct: number } | null;
      sectorCount: number;
      topHolding: { symbol: string; weightPct: number } | null;
      cashPct: number;
    };

async function loadHealth(): Promise<HealthData> {
  try {
    const [summary, holdings, sectors] = await Promise.all([
      portfolioService.getSummary(),
      portfolioService.getHoldings(),
      portfolioService.getSectorAllocation(),
    ]);
    const valued = holdings.filter((h) => h.available && h.value != null);
    if (holdings.length === 0) return { kind: "no-portfolio" };
    if (valued.length === 0) return { kind: "unpriced" };

    const topHoldingValued = [...valued].sort((a, b) => (b.weightPct ?? 0) - (a.weightPct ?? 0))[0];
    return {
      kind: "ready",
      positions: holdings.length,
      priced: valued.length,
      topSector: sectors[0] ?? null,
      sectorCount: sectors.length,
      topHolding: topHoldingValued
        ? { symbol: topHoldingValued.symbol, weightPct: topHoldingValued.weightPct }
        : null,
      cashPct:
        summary.totalValue > 0
          ? Math.round((summary.availableCash / summary.totalValue) * 100)
          : 0,
    };
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return { kind: "no-portfolio" };
    throw e;
  }
}

export function RiskSnapshot() {
  const { data, loading, error, reload } = useAsync(loadHealth, []);

  if (error) {
    return (
      <Card className="p-5">
        <ErrorState onRetry={reload} />
      </Card>
    );
  }

  if (loading || !data) {
    return (
      <Card className="p-5">
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  if (data.kind === "no-portfolio") {
    return (
      <Card className="p-5">
        <CardHeader title="Portfolio Health" subtitle="Concentration & composition" />
        <div className="mt-3">
          <EmptyState
            title="No portfolio yet"
            message="Health metrics are calculated from your actual holdings. Set up a portfolio to see them."
            action={
              <Link href="/portfolio?setup=virtual" className="btn-primary !py-2 text-xs">
                Set up portfolio
              </Link>
            }
          />
        </div>
      </Card>
    );
  }

  if (data.kind === "unpriced") {
    return (
      <Card className="p-5">
        <CardHeader title="Portfolio Health" subtitle="Concentration & composition" />
        <p className="mt-3 text-sm text-secondary">
          You hold positions, but market data is unavailable right now — so no metrics are shown rather than
          guessed ones.
        </p>
        <button onClick={reload} className="btn-ghost mt-4 !py-1.5 text-xs">
          Try again
        </button>
      </Card>
    );
  }

  const concentration = data.topSector?.pct ?? 0;
  const rows = [
    {
      label: "Largest sector",
      value: data.topSector ? `${data.topSector.pct.toFixed(1)}%` : "N/A",
      pct: data.topSector?.pct ?? 0,
      explain: `Share of your priced equity in your biggest sector (${data.topSector?.sector ?? "n/a"}). Above ~40% a single sector's bad day becomes your bad day.`,
    },
    {
      label: "Largest position",
      value: data.topHolding ? `${data.topHolding.symbol} · ${data.topHolding.weightPct.toFixed(1)}%` : "N/A",
      pct: data.topHolding?.weightPct ?? 0,
      explain: "Weight of your biggest single stock. Above ~15–20% the portfolio starts behaving like a stock pick.",
    },
    {
      label: "Sectors held",
      value: `${data.sectorCount}`,
      pct: Math.min(100, data.sectorCount * 20),
      explain: "How many distinct sectors your holdings spread across. More sectors usually means smoother rides.",
    },
    {
      label: "Cash share",
      value: `${data.cashPct}%`,
      pct: data.cashPct,
      explain: "Share of total portfolio value sitting in uninvested (virtual) cash — dry powder or idle money.",
    },
  ];

  return (
    <Card className="p-5">
      <CardHeader title="Portfolio Health" subtitle="Calculated from your actual holdings" />
      <div className="mt-4 flex items-center gap-5">
        <ProgressRing
          value={Math.round(concentration)}
          label={`${Math.round(concentration)}`}
          sublabel="% top sector"
          tone="gold"
          size={92}
        />
        <div>
          <InfoTooltip
            label="Sector concentration"
            text="The share of your equity held in your largest sector. It shows where your outcomes come from — not a prediction, a measurement."
          />
          <p className="text-sm font-semibold text-ink">
            {data.topSector ? `${data.topSector.sector} led` : "Sector mix unavailable"}
          </p>
          <p className="mt-0.5 max-w-[180px] text-[11px] leading-relaxed text-muted">
            {data.positions} position{data.positions === 1 ? "" : "s"} · {data.priced} priced at latest market
            prices.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <InfoTooltip label={r.label} text={r.explain} />
              <span className="font-semibold text-ink tnum">{r.value}</span>
            </div>
            <ProgressBar value={Math.max(0, Math.min(100, r.pct))} tone="gold" />
          </div>
        ))}
      </div>
    </Card>
  );
}
