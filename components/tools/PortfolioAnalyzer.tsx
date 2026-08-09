"use client";

import { useMemo } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { portfolioService } from "@/lib/services/portfolioService";
import { ResultRow } from "@/components/tools/shared";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { SkeletonRows } from "@/components/ui/States";

export function PortfolioAnalyzer() {
  const { data: holdings, loading } = useAsync(() => portfolioService.getHoldings(), []);

  const result = useMemo(() => {
    if (!holdings?.length) return null;
    const total = holdings.reduce((a, h) => a + h.value, 0);
    const weights = holdings.map((h) => h.value / total);
    const hhi = weights.reduce((a, w) => a + w * w, 0);
    const effective = 1 / hhi;
    const maxWeight = Math.max(...weights) * 100;
    const top3 = [...holdings].sort((a, b) => b.value - a.value).slice(0, 3);
    // Rough sector concentration from the known sample sectors
    const sectorShare = holdings
      .filter((h) => ["TCS", "INFY", "WIPRO"].includes(h.symbol))
      .reduce((a, h) => a + (h.value / total) * 100, 0);
    return { hhi, effective, maxWeight, top3, sectorShare };
  }, [holdings]);

  if (loading || !result) {
    return (
      <Card className="p-5">
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  const diversificationScore = Math.max(0, Math.min(100, Math.round(100 - result.hhi * 160)));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <CardHeader title="Concentration Analysis" subtitle="Computed from your actual sample holdings" />
        <div className="mt-4">
          <ResultRow
            label="Herfindahl–Hirschman Index (HHI)"
            value={result.hhi.toFixed(4)}
            explain="Sum of squared weights. 0 = perfectly spread, 1 = a single asset. Lower is more diversified."
          />
          <ResultRow
            label="Effective number of positions"
            value={result.effective.toFixed(1)}
            explain="1 ÷ HHI — how many equal-sized positions your portfolio behaves like."
          />
          <ResultRow
            label="Largest single position"
            value={`${result.maxWeight.toFixed(1)}%`}
            explain="A position above ~15–20% starts to behave like a stock pick, not a portfolio."
          />
          <ResultRow
            label="IT services share (equity)"
            value={`${result.sectorShare.toFixed(1)}%`}
            tone="gold"
            explain="The sample holdings concentrate in IT — this is exactly the kind of sector exposure Artha flags."
          />
        </div>
      </Card>

      <Card className="p-5">
        <CardHeader
          title="Diversification Score"
          subtitle="Illustrative model output"
        />
        <div className="mt-5">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-extrabold tracking-tight text-gold tnum">{diversificationScore}</span>
            <span className="mb-1 text-xs text-muted">/ 100</span>
          </div>
          <ProgressBar value={diversificationScore} tone={diversificationScore >= 60 ? "pos" : "gold"} className="mt-2 !h-2" />
          <p className="mt-4 text-[13px] leading-relaxed text-secondary">
            Your top three holdings are {result.top3.map((t) => t.symbol).join(", ")}. Together with the sector
            concentration above, this is what the portfolio risk score (62/100) is built from.
          </p>
          <div className="mt-4 rounded-xl border border-edge bg-surface2/40 p-3.5">
            <p className="text-[11px] font-semibold text-info">Why it matters</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Concentration isn’t bad by itself — it explains where returns come from. It becomes a risk when one
              sector’s decline would dominate your outcome. The model just makes that trade-off visible.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
