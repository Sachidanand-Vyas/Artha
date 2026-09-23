"use client";

import Link from "next/link";
import { ArrowUpRight, Calculator, GraduationCap } from "lucide-react";
import { greeting } from "@/lib/utils";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { AIInsightCard } from "@/components/dashboard/AIInsightCard";
import { RiskSnapshot } from "@/components/dashboard/RiskSnapshot";
import { WatchlistPreview } from "@/components/dashboard/WatchlistPreview";
import { NewsStrip } from "@/components/dashboard/NewsStrip";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {greeting()}, Sachidanand
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Your financial intelligence, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tools" className="btn-ghost !py-1.5 !px-3 text-xs">
            <Calculator size={14} /> Tools
          </Link>
          <Link href="/learn" className="btn-ghost !py-1.5 !px-3 text-xs">
            <GraduationCap size={14} /> Learn
          </Link>
        </div>
      </div>

      {/* Portfolio + AI insight */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PortfolioOverview />
        </div>
        <AIInsightCard />
      </div>

      {/* Market overview */}
      <MarketOverview />

      {/* Health + watchlist + news */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RiskSnapshot />
        <WatchlistPreview />
        <NewsStrip />
      </div>

      <p className="flex items-center gap-1.5 pt-2 text-[11px] text-muted">
        <ArrowUpRight size={12} />
        Market data: latest available prices via the Artha backend (may be delayed, not live). News, learning and
        transaction content is clearly-labelled demo material. Educational — not financial advice.
      </p>
    </div>
  );
}
