"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import { ResultRow } from "@/components/tools/shared";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";

type Data =
  | { kind: "no-portfolio" }
  | {
      kind: "ready";
      hhi: number;
      effective: number;
      maxWeight: number;
      top3: string[];
      topSector: { sector: string; pct: number } | null;
      total: number;
    };

async function load(): Promise<Data> {
  try {
    const [holdings, sectors] = await Promise.all([
      portfolioService.getHoldings(),
      portfolioService.getSectorAllocation(),
    ]);
    // Only holdings we could price at real market prices feed the maths.
    const priced = holdings.filter((h) => h.value != null);
    if (!priced.length) {
      return { kind: "no-portfolio" }; // no portfolio OR nothing priceable yet
    }
    const val = (h: { value: number | null }) => h.value ?? 0;
    const total = priced.reduce((a, h) => a + val(h), 0);
    if (total <= 0) return { kind: "no-portfolio" };
    const weights = priced.map((h) => val(h) / total);
    const hhi = weights.reduce((a, w) => a + w * w, 0);
    const effective = 1 / hhi;
    const maxWeight = Math.max(...weights) * 100;
    const top3 = [...priced]
      .sort((a, b) => val(b) - val(a))
      .slice(0, 3)
      .map((h) => h.symbol);
    return {
      kind: "ready",
      hhi,
      effective,
      maxWeight,
      top3,
      topSector: sectors[0] ?? null,
      total,
    };
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return { kind: "no-portfolio" };
    throw e;
  }
}

export function PortfolioAnalyzer() {
  const { data, loading, error, reload } = useAsync(load, []);

  const diversificationScore = useMemo(
    () => (data?.kind === "ready" ? Math.max(0, Math.min(100, Math.round(100 - data.hhi * 160))) : 0),
    [data],
  );

  if (error) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 lg:col-span-2">
          <ErrorState onRetry={reload} />
        </Card>
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SkeletonRows rows={4} />
        </Card>
        <Card className="p-5">
          <SkeletonRows rows={4} />
        </Card>
      </div>
    );
  }

  if (data.kind === "no-portfolio") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 lg:col-span-2">
          <EmptyState
            title="Nothing to analyze yet"
            message="Concentration metrics are computed from your own holdings at real market prices. Set up a portfolio first."
            action={
              <Link href="/portfolio?setup=virtual" className="btn-primary !py-2 text-xs">
                Set up portfolio
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <CardHeader title="Concentration Analysis" subtitle="Computed from your holdings at latest available prices" />
        <div className="mt-4">
          <ResultRow
            label="Herfindahl–Hirschman Index (HHI)"
            value={data.hhi.toFixed(4)}
            explain="Sum of squared weights. 0 = perfectly spread, 1 = a single asset. Lower is more diversified."
          />
          <ResultRow
            label="Effective number of positions"
            value={data.effective.toFixed(1)}
            explain="1 ÷ HHI — how many equal-sized positions your portfolio behaves like."
          />
          <ResultRow
            label="Largest single position"
            value={`${data.maxWeight.toFixed(1)}%`}
            explain="A position above ~15–20% starts to behave like a stock pick, not a portfolio."
          />
          <ResultRow
            label="Top sector share (equity)"
            value={data.topSector ? `${data.topSector.pct.toFixed(1)}%` : "N/A"}
            tone="gold"
            explain={
              data.topSector
                ? `${data.topSector.sector} is your largest sector by value of priced equity — this is exactly the kind of sector exposure worth watching.`
                : "Sector weights need priced holdings — currently unavailable."
            }
          />
        </div>
      </Card>

      <Card className="p-5">
        <CardHeader
          title="Diversification Score"
          subtitle="Transparent formula: 100 − HHI × 160"
        />
        <div className="mt-5">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-extrabold tracking-tight text-gold tnum">{diversificationScore}</span>
            <span className="mb-1 text-xs text-muted">/ 100</span>
          </div>
          <ProgressBar value={diversificationScore} tone={diversificationScore >= 60 ? "pos" : "gold"} className="mt-2 !h-2" />
          <p className="mt-4 text-[13px] leading-relaxed text-secondary">
            Your top three holdings are {data.top3.join(", ")}, worth about ₹
            {Math.round(data.total).toLocaleString("en-IN")} together at latest available prices.
          </p>
          <div className="mt-4 rounded-xl border border-edge bg-surface2/40 p-3.5">
            <p className="text-[11px] font-semibold text-info">Why it matters</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Concentration isn&apos;t bad by itself — it explains where returns come from. It becomes a risk when
              one sector&apos;s decline would dominate your outcome. The score is a fixed, visible formula on your
              real weights — not a prediction or a risk grade.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
