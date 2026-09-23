import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { RiskLevel, Sentiment } from "@/lib/types";

export function TrendBadge({
  value,
  pct,
  className,
}: {
  value: number;
  pct: number;
  className?: string;
}) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tnum",
        up ? "bg-possoft text-pos" : "bg-negsoft text-neg",
        className,
      )}
    >
      {value === 0 ? (
        <Minus size={12} />
      ) : up ? (
        <ArrowUpRight size={12} />
      ) : (
        <ArrowDownRight size={12} />
      )}
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel | null }) {
  const map: Record<RiskLevel, string> = {
    Low: "bg-possoft text-pos",
    Moderate: "bg-goldsoft text-gold",
    High: "bg-negsoft text-neg",
  };
  if (!risk) {
    // Provider did not expose a volatility-based label — show N/A, never guess.
    return (
      <span className="inline-flex items-center rounded-full border border-edge bg-surface2/70 px-2 py-0.5 text-[11px] font-semibold text-muted">
        N/A
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", map[risk])}>
      {risk}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const map: Record<Sentiment, string> = {
    Positive: "bg-possoft text-pos",
    Neutral: "bg-infosoft text-info",
    Negative: "bg-negsoft text-neg",
  };
  const dot: Record<Sentiment, string> = {
    Positive: "bg-pos",
    Neutral: "bg-info",
    Negative: "bg-neg",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", map[sentiment])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[sentiment])} />
      {sentiment}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-edge bg-surface2/70 px-2 py-0.5 text-[11px] font-medium text-secondary">
      {category}
    </span>
  );
}

/** Small pill with a dot — used for statuses like "Demo data". */
export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "pos" | "neg" | "info";
}) {
  const tones = {
    neutral: "border-edge text-secondary",
    gold: "border-gold/30 bg-goldsoft text-gold",
    pos: "border-pos/30 bg-possoft text-pos",
    neg: "border-neg/30 bg-negsoft text-neg",
    info: "border-info/30 bg-infosoft text-info",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
