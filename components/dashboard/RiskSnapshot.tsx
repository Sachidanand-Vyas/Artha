"use client";

import { useEffect, useState } from "react";
import { portfolioService } from "@/lib/services/portfolioService";
import { analyticsService } from "@/lib/services/analyticsService";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { InfoTooltip } from "@/components/ui/Tooltip";
import { ErrorState, SkeletonRows } from "@/components/ui/States";

export function RiskSnapshot() {
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof analyticsService.getMetrics>> | null>(null);
  const [goals, setGoals] = useState<Awaited<ReturnType<typeof portfolioService.getGoals>> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([analyticsService.getMetrics(), portfolioService.getGoals()])
      .then(([m, g]) => {
        if (alive) {
          setMetrics(m);
          setGoals(g);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const retry = () => {
    setError(false);
    setMetrics(null);
    setGoals(null);
    Promise.all([analyticsService.getMetrics(), portfolioService.getGoals()])
      .then(([m, g]) => {
        setMetrics(m);
        setGoals(g);
      })
      .catch(() => setError(true));
  };

  if (error) {
    return (
      <Card className="p-5">
        <ErrorState onRetry={retry} />
      </Card>
    );
  }

  if (!metrics || !goals) {
    return (
      <Card className="p-5">
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  const avgGoalProgress = Math.round(goals.reduce((a, g) => a + g.pct, 0) / goals.length);

  const rows = [
    {
      label: "Diversification",
      value: `${metrics.diversification}%`,
      tone: "pos" as const,
      explain: "How spread out your holdings are across sectors and asset classes. A higher score means a single sector's decline hurts less. Above ~70% is generally considered well diversified.",
    },
    {
      label: "Liquidity",
      value: `${metrics.liquidity}%`,
      tone: "info" as const,
      explain: "Share of the portfolio that can be converted to cash quickly without a significant price impact. Cash, liquid funds and large-cap stocks score higher than small-caps or property.",
    },
    {
      label: "Volatility (annualised)",
      value: `${metrics.volatility.toFixed(1)}%`,
      tone: "gold" as const,
      explain: "How much the portfolio's value tends to swing in a year. Lower volatility means a smoother ride; higher volatility means bigger ups and downs — not necessarily worse returns.",
    },
    {
      label: "Goal progress (avg)",
      value: `${avgGoalProgress}%`,
      tone: "gold" as const,
      explain: "Average progress across your financial goals. Each goal tracks how much you have saved versus the target, adjusted for the deadline.",
    },
  ];

  return (
    <Card className="p-5">
      <CardHeader title="Financial Health" subtitle="Risk & readiness snapshot" />
      <div className="mt-4 flex items-center gap-5">
        <ProgressRing
          value={metrics.riskScore}
          label={`${metrics.riskScore}`}
          sublabel="/ 100"
          tone="gold"
          size={92}
        />
        <div>
          <InfoTooltip
            label="Risk Score"
            text="A single number summarising the portfolio's overall risk from volatility, concentration, leverage and liquidity. Educational only — it does not predict future returns."
          />
          <p className="text-sm font-semibold text-ink">{metrics.riskLabel} risk</p>
          <p className="mt-0.5 max-w-[180px] text-[11px] leading-relaxed text-muted">
            Combination of volatility, concentration and liquidity.
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
            <ProgressBar value={parseFloat(r.value)} tone={r.tone} />
          </div>
        ))}
      </div>
    </Card>
  );
}
