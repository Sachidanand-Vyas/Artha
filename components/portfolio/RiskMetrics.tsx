"use client";

import { useEffect, useState } from "react";
import type { AnalyticsMetrics } from "@/lib/types";
import { analyticsService } from "@/lib/services/analyticsService";
import { Card, CardHeader } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/Tooltip";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/utils";

interface MetricDef {
  key: keyof AnalyticsMetrics;
  label: string;
  fmt: (m: AnalyticsMetrics) => string;
  explain: string;
  good?: (m: AnalyticsMetrics) => boolean;
}

const METRICS: MetricDef[] = [
  {
    key: "sharpe",
    label: "Sharpe Ratio",
    fmt: (m) => m.sharpe.toFixed(2),
    explain:
      "Return earned per unit of risk taken. Above 1 is decent, above 2 is strong. It measures whether you are being paid fairly for the volatility you endure.",
  },
  {
    key: "sortino",
    label: "Sortino Ratio",
    fmt: (m) => m.sortino.toFixed(2),
    explain:
      "Like Sharpe, but it only penalises downside volatility. A higher Sortino means losses (not just swings) are better controlled.",
  },
  {
    key: "var95",
    label: "VaR (95%, 1m)",
    fmt: (m) => `${m.var95.toFixed(1)}%`,
    explain:
      "Value at Risk: in a typical month, losses are expected to stay within this percentage 95% of the time. The remaining 5% can be worse — it is a risk gauge, not a limit.",
  },
  {
    key: "maxDrawdown",
    label: "Max Drawdown",
    fmt: (m) => `${m.maxDrawdown.toFixed(1)}%`,
    explain:
      "The largest peak-to-trough decline your portfolio has experienced. It shows how much paper loss you had to tolerate — the true test of staying invested.",
  },
  {
    key: "volatility",
    label: "Volatility",
    fmt: (m) => `${m.volatility.toFixed(1)}%`,
    explain:
      "Annualised standard deviation of monthly returns — how much the portfolio typically swings in a year. Lower is smoother; higher is bumpier.",
  },
  {
    key: "beta",
    label: "Beta",
    fmt: (m) => m.beta.toFixed(2),
    explain:
      "Sensitivity to the broad market. Beta of 1 means the portfolio moves with the market; above 1 amplifies moves, below 1 dampens them.",
  },
  {
    key: "alpha",
    label: "Alpha",
    fmt: (m) => `${m.alpha > 0 ? "+" : ""}${m.alpha.toFixed(1)}%`,
    explain:
      "Return above what the market risk would predict. Positive alpha means the portfolio outperformed its beta-adjusted benchmark (on sample data).",
    good: (m) => m.alpha >= 0,
  },
  {
    key: "riskScore",
    label: "Risk Score",
    fmt: (m) => `${m.riskScore} / 100`,
    explain:
      "A composite of volatility, concentration, leverage and liquidity. It summarises the portfolio's overall risk profile — educational, not predictive.",
  },
];

export function RiskMetrics() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    analyticsService
      .getMetrics()
      .then((m) => {
        if (alive) setMetrics(m);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const retry = () => {
    setMetrics(null);
    setError(false);
    analyticsService.getMetrics().then(setMetrics).catch(() => setError(true));
  };

  return (
    <Card className="p-5">
      <CardHeader
        title="Analytics & Risk"
        subtitle="Each metric explains itself — what it measures and why it matters"
      />
      {error ? (
        <div className="mt-4">
          <ErrorState onRetry={retry} />
        </div>
      ) : !metrics ? (
        <div className="mt-4">
          <SkeletonRows rows={4} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {METRICS.map((m) => {
            const good = m.good?.(metrics);
            return (
              <div key={m.label} className="rounded-xl border border-edge bg-surface2/40 p-3.5">
                <InfoTooltip label={<span className="text-[11px] font-medium">{m.label}</span>} text={m.explain} />
                <p className={cn("mt-1.5 text-lg font-bold tnum", good === false ? "text-neg" : "text-ink")}>
                  {m.fmt(metrics)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
