"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { portfolioService, PortfolioNotSetupError } from "@/lib/services/portfolioService";
import { useAsync } from "@/lib/hooks/useAsync";
import { inrCompact } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/Tooltip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";

const COLORS = ["#d4a94f", "#5b8def", "#16c784", "#8b7cf6", "#3ec5c5"];

/** A missing portfolio is an empty state, not an error. */
const orEmpty = async <T,>(promise: Promise<T>, empty: T): Promise<T> => {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof PortfolioNotSetupError) return empty;
    throw e;
  }
};

export function AssetAllocation() {
  const { data: allocation, loading: loadingA, error: errA, reload: reloadA } = useAsync(
    () => orEmpty(portfolioService.getAllocation(), []),
    [],
  );
  const { data: sectors, loading: loadingS, error: errS, reload: reloadS } = useAsync(
    () => orEmpty(portfolioService.getSectorAllocation(), []),
    [],
  );
  const notSetup = !loadingA && !errA && (allocation?.length ?? 0) === 0 && (sectors?.length ?? 0) === 0;

  return (
    <Card className="p-5">
      <CardHeader
        title="Asset Allocation"
        subtitle="Where your money sits"
        right={
          <InfoTooltip
            label=""
            text="How your total wealth is split across asset classes. Diversification across these buckets is the main driver of portfolio risk."
          />
        }
      />
      {errA ? (
        <div className="mt-4">
          <ErrorState onRetry={reloadA} />
        </div>
      ) : loadingA || !allocation ? (
        <div className="mt-4">
          <SkeletonRows rows={4} />
        </div>
      ) : allocation.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={notSetup ? "Your portfolio isn't set up yet." : "Nothing valued yet"}
            message={
              notSetup
                ? "Set up a virtual portfolio or add your holdings to see where your money sits."
                : "No priced holdings or cash to allocate right now — market data may be unavailable."
            }
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-52 w-52 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {allocation.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [inrCompact(Number(value)), String(name)]}
                  contentStyle={{
                    background: "#182130",
                    border: "1px solid rgba(150,168,196,0.22)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#e8eef6",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-muted">Total</span>
              <span className="text-base font-bold text-ink tnum">
                {inrCompact(allocation.reduce((a, s) => a + s.value, 0))}
              </span>
            </div>
          </div>
          <div className="w-full flex-1 space-y-2.5">
            {allocation.map((slice, i) => (
              <div key={slice.label} className="flex items-center gap-2.5 text-[13px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-secondary">{slice.label}</span>
                <span className="ml-auto font-semibold tnum text-ink">{slice.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-edge pt-4">
        <CardHeader
          title="Sector Allocation"
          subtitle="Equity portion, by sector"
        />
        {errS ? (
          <div className="mt-3">
            <ErrorState onRetry={reloadS} />
          </div>
        ) : loadingS || !sectors ? (
          <div className="mt-3">
            <SkeletonRows rows={5} />
          </div>
        ) : sectors.length === 0 ? (
          <p className="mt-3 text-xs text-muted">
            No priced equity yet — sector weights appear once your holdings can be valued.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {sectors.map((s) => (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs text-secondary">{s.sector}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs font-semibold tnum text-ink">
                  {s.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
