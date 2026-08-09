"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { InfoTooltip } from "@/components/ui/Tooltip";

export function MetricCard({
  label,
  value,
  delta,
  deltaPct,
  spark,
  sparkPositive,
  explain,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number;
  deltaPct?: number;
  spark?: number[];
  sparkPositive?: boolean;
  explain?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const hasDelta = delta !== undefined || deltaPct !== undefined;
  const up = (delta ?? 0) >= 0 && (deltaPct ?? 0) >= 0;
  return (
    <Card hover className={cn("p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-secondary">
          {icon}
          {explain ? (
            <InfoTooltip label={label} text={explain} />
          ) : (
            <span>{label}</span>
          )}
        </span>
        {spark && <Sparkline data={spark} positive={sparkPositive} width={64} height={22} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-xl font-bold tracking-tight text-ink tnum">{value}</span>
        {hasDelta && (
          <span
            className={cn(
              "text-xs font-semibold tnum",
              up ? "text-pos" : "text-neg",
            )}
          >
            {up ? "▲" : "▼"} {deltaPct !== undefined && (up ? "+" : "")}
            {deltaPct?.toFixed(2)}%
          </span>
        )}
      </div>
    </Card>
  );
}
