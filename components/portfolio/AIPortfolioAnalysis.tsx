import { Sparkles } from "lucide-react";
import { portfolioInsight } from "@/lib/mock/ai";
import { StatusPill } from "@/components/ui/Badge";

export function AIPortfolioAnalysis() {
  const { tag, title, insight, why, action, caveat } = portfolioInsight;
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-info">{why.split(":")[0]}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">{why.split(":").slice(1).join(":")}</p>
          </div>
          <div className="rounded-xl border border-edge bg-surface/80 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">{action.split(":")[0]}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-secondary">{action.split(":").slice(1).join(":")}</p>
          </div>
        </div>
        <p className="mt-4 border-t border-edge/70 pt-3 text-[10.5px] leading-relaxed text-muted">{caveat}</p>
      </div>
    </div>
  );
}
