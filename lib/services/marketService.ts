/**
 * MARKET SERVICE — indices, breadth and sector moves.
 *
 * Backed by GET /api/markets on the FastAPI backend. Breadth (advance/decline
 * counts) is provider-dependent: when it is unavailable the backend returns
 * `available: false` and the UI shows N/A instead of invented numbers.
 *
 * Interface unchanged: components keep calling `marketService.*`.
 */

import type { IndexQuote, MarketBreadth } from "@/lib/types";
import { apiGet } from "@/lib/services/api";

interface ApiIndex {
  symbol: string;
  name: string;
  exchange: string;
  value: number;
  change: number;
  change_percent: number;
  spark: number[];
  currency: "INR" | "USD";
  market: "INDIA" | "GLOBAL";
  timestamp: string;
  source: string;
}

interface ApiMarketSnapshot {
  indices: ApiIndex[];
  breadth: {
    advances: number | null;
    declines: number | null;
    unchanged: number | null;
    available: boolean;
    note: string;
  };
  sectors: { sector: string; change_percent: number }[];
  sectors_note: string;
  timestamp: string;
  source: string;
}

const MARKETS_TTL = 60_000;

/** One cached snapshot per TTL — the page fires three methods at once. */
const snapshot = () => apiGet<ApiMarketSnapshot>("/api/markets", MARKETS_TTL);

export interface MarketService {
  /** Major indices & indicators (NIFTY, SENSEX, NASDAQ, …). */
  getIndices(): Promise<IndexQuote[]>;
  /** Advances / declines / unchanged — may be reported as unavailable. */
  getBreadth(): Promise<MarketBreadth>;
  /** Sector-level performance for the day. */
  getSectorPerformance(): Promise<{ sector: string; changePct: number }[]>;
}

export const marketService: MarketService = {
  async getIndices() {
    const snap = await snapshot();
    return (snap.indices ?? []).map((i) => ({
      symbol: i.symbol,
      name: i.name,
      exchange: i.exchange,
      value: i.value,
      change: i.change,
      changePct: i.change_percent,
      spark: i.spark ?? [],
      currency: i.currency,
      market: i.market,
      timestamp: i.timestamp,
      source: i.source,
    }));
  },

  async getBreadth() {
    const snap = await snapshot();
    const b = snap.breadth ?? {
      advances: null,
      declines: null,
      unchanged: null,
      available: false,
      note: "",
    };
    return {
      advances: b.advances,
      declines: b.declines,
      unchanged: b.unchanged,
      available: b.available,
      note: b.note,
    };
  },

  async getSectorPerformance() {
    const snap = await snapshot();
    return (snap.sectors ?? []).map((s) => ({
      sector: s.sector,
      changePct: s.change_percent,
    }));
  },
};
