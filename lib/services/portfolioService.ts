/**
 * PORTFOLIO SERVICE — valuation of the user's holdings.
 *
 * Quantities and average costs are user inputs (demo portfolio, stored here).
 * Every price, day change, P&L and allocation percentage is computed by the
 * FastAPI backend from the same market-data layer the rest of Artha uses —
 * one source of truth for prices.
 *
 * Transactions, goals and cash are still clearly-labelled demo/user data.
 *
 * Interface unchanged: components keep calling `portfolioService.*`.
 */

import type {
  AllocationSlice,
  Goal,
  Holding,
  PortfolioSummary,
  SectorSlice,
  Transaction,
} from "@/lib/types";
import { apiPost } from "@/lib/services/api";
import { randomWalk } from "@/lib/utils";
import {
  analytics,
  cashBalance,
  goals,
  transactions,
} from "@/lib/mock/portfolio";

/* Demo portfolio: quantity + average cost are user inputs, NOT market data. */
const SEED_HOLDINGS: { symbol: string; qty: number; avgCost: number }[] = [
  { symbol: "RELIANCE", qty: 40, avgCost: 2380 },
  { symbol: "TCS", qty: 25, avgCost: 3180 },
  { symbol: "HDFCBANK", qty: 60, avgCost: 1442 },
  { symbol: "INFY", qty: 80, avgCost: 1352 },
  { symbol: "ICICIBANK", qty: 100, avgCost: 982 },
  { symbol: "SBIN", qty: 120, avgCost: 698 },
  { symbol: "LT", qty: 15, avgCost: 2965 },
  { symbol: "NVDA", qty: 12, avgCost: 84.5 },
  { symbol: "MSFT", qty: 6, avgCost: 331 },
];

/* --------------------------- Backend wire types --------------------------- */

interface ApiHolding {
  symbol: string;
  name: string;
  sector: string;
  country: "IN" | "US";
  currency: "INR" | "USD";
  qty: number;
  avg_cost: number;
  invested: number;
  ltp: number | null;
  day_change: number | null;
  day_change_percent: number | null;
  value: number | null;
  return_percent: number | null;
  weight_percent: number;
  available: boolean;
}

interface ApiValuation {
  holdings: ApiHolding[];
  totals: {
    invested: number;
    value: number;
    day_change: number;
    unrealized_pnl: number;
    return_percent: number;
  };
  timestamp: string;
  source: string;
}

const VALUATION_TTL = 60_000;

/** One valuation per TTL — summary, holdings, allocation and sectors share it. */
const valuation = () =>
  apiPost<ApiValuation>(
    "/api/portfolio/holdings",
    SEED_HOLDINGS.map((h) => ({ symbol: h.symbol, qty: h.qty, avg_cost: h.avgCost })),
    VALUATION_TTL,
  );

/* -------------------------------- Mapping -------------------------------- */

function mapHolding(h: ApiHolding): Holding {
  return {
    symbol: h.symbol,
    name: h.name,
    qty: h.qty,
    avgCost: h.avg_cost,
    ltp: h.available ? h.ltp : null,
    dayChange: h.available ? h.day_change : null,
    dayChangePct: h.available ? h.day_change_percent : null,
    invested: h.invested,
    value: h.available ? h.value : null,
    returnPct: h.available ? h.return_percent : null,
    weightPct: h.weight_percent,
    available: h.available,
  };
}

/* ------------------------- Illustrative history --------------------------- */
/* The backend values TODAY's holdings; it has no past portfolio value, so the
   chart shape below is a seeded random walk scaled to the real current value
   and is labelled as illustrative in the UI. */

const HISTORY_POINTS = 24;
const MONTH_MS = 30 * 24 * 3600 * 1000;

function illustrativeHistory(totalValue: number): PortfolioSummary["valueHistory"] {
  const shape = randomWalk(41, HISTORY_POINTS, 1, 0.012, 0.03);
  const benchShape = randomWalk(42, HISTORY_POINTS, 1, 0.01, 0.035);
  const last = shape[shape.length - 1] || 1;
  const benchLast = benchShape[benchShape.length - 1] || 1;
  const now = Date.now();
  return shape.map((v, i) => ({
    time: now - (HISTORY_POINTS - i) * MONTH_MS,
    value: (v / last) * totalValue,
    benchmark: (benchShape[i] / benchLast) * totalValue,
  }));
}

/* -------------------------------- Service -------------------------------- */

export interface PortfolioService {
  getSummary(): Promise<PortfolioSummary>;
  getHoldings(): Promise<Holding[]>;
  getAllocation(): Promise<AllocationSlice[]>;
  getSectorAllocation(): Promise<SectorSlice[]>;
  getTransactions(): Promise<Transaction[]>;
  getGoals(): Promise<Goal[]>;
  getCash(): Promise<number>;
}

export const portfolioService: PortfolioService = {
  async getSummary() {
    const v = await valuation();
    const t = v.totals;
    const equityPlusCash = t.value + cashBalance;
    // Day % = day change against the previous close (value - day change).
    const prevValue = t.value - t.day_change;
    const todayChangePct = prevValue > 0 ? (t.day_change / prevValue) * 100 : 0;

    return {
      totalValue: equityPlusCash,
      invested: t.invested,
      availableCash: cashBalance,
      todayChange: t.day_change,
      todayChangePct,
      overallReturn: t.unrealized_pnl,
      overallReturnPct: t.return_percent,
      dayHistory: randomWalk(43, 30, equityPlusCash * 0.995, 0.0002, 0.0022),
      valueHistory: illustrativeHistory(equityPlusCash),
    };
  },

  async getHoldings() {
    const v = await valuation();
    return v.holdings.map(mapHolding);
  },

  async getAllocation() {
    const v = await valuation();
    const priced = v.holdings.filter((h) => h.available);
    const byCountry = (country: "IN" | "US") =>
      priced
        .filter((h) => h.country === country)
        .reduce((sum, h) => sum + (h.value ?? 0), 0);

    const india = byCountry("IN");
    const us = byCountry("US");
    const equity = india + us;
    const total = equity + cashBalance;
    if (total <= 0) return [];

    const slices: AllocationSlice[] = [
      { label: "Equity — India", value: india, pct: Math.round((india / total) * 100) },
      { label: "Equity — US", value: us, pct: Math.round((us / total) * 100) },
      { label: "Cash", value: cashBalance, pct: Math.round((cashBalance / total) * 100) },
    ];
    return slices.filter((s) => s.value > 0);
  },

  async getSectorAllocation() {
    const v = await valuation();
    const valued = v.holdings.filter((h) => h.available && h.value);
    const equity = valued.reduce((sum, h) => sum + (h.value ?? 0), 0);
    if (equity <= 0) return [];

    const buckets = new Map<string, number>();
    for (const h of valued) {
      const sector = h.sector || "Other";
      buckets.set(sector, (buckets.get(sector) ?? 0) + (h.value ?? 0));
    }
    return [...buckets.entries()]
      .map(([sector, value]) => ({
        sector,
        pct: Math.round((value / equity) * 1000) / 10,
      }))
      .sort((a, b) => b.pct - a.pct);
  },

  async getTransactions() {
    await Promise.resolve();
    return transactions;
  },

  async getGoals() {
    await Promise.resolve();
    return goals;
  },

  async getCash() {
    await Promise.resolve();
    return cashBalance;
  },
};

export { analytics as portfolioAnalytics };
