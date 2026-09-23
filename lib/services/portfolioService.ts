/**
 * PORTFOLIO SERVICE — the logged-in user's actual portfolio.
 *
 * Everything here comes from the FastAPI backend (SQLite + the existing
 * market-data layer):
 *   - quantities / average costs: entered by the user (virtual trades or a
 *     manual import of their real-world holdings),
 *   - prices, day changes, P&L, allocations: computed on the backend from the
 *     same market-data layer the rest of Artha uses — one source of truth.
 *
 * There is no seeded demo portfolio and no illustrative history: a user with
 * no portfolio gets `PortfolioNotSetupError`, which the UI turns into a setup
 * prompt instead of numbers.
 */

import type {
  AllocationSlice,
  Goal,
  Holding,
  HistoryPoint,
  PortfolioSummary,
  SectorSlice,
  Transaction,
} from "@/lib/types";
import { apiGet, apiSend, ApiError } from "@/lib/services/api";

/** Thrown when the user has not created a portfolio yet (empty state, not an error). */
export class PortfolioNotSetupError extends Error {
  constructor() {
    super("Your portfolio isn't set up yet.");
    this.name = "PortfolioNotSetupError";
  }
}

export type PortfolioMode = "virtual" | "manual";
export type OrderSide = "BUY" | "SELL";

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

interface ApiPortfolio {
  exists: boolean;
  mode: PortfolioMode | null;
  virtual_cash: number;
  initial_capital: number;
  created_at: string | null;
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

interface ApiTransaction {
  id: number;
  symbol: string;
  type: "BUY" | "SELL";
  qty: number;
  price: number;
  amount: number;
  source: string; // 'trade' | 'import'
  timestamp: string; // ISO
}

export interface PortfolioState {
  exists: boolean;
  mode: PortfolioMode | null;
  cash: number;
  initialCapital: number;
  createdAt: string | null;
}

const PORTFOLIO_TTL = 30_000;
const TRANSACTIONS_TTL = 15_000;

/** One cached GET per TTL — summary, holdings and allocation share it. */
const fetchPortfolio = () => apiGet<ApiPortfolio>("/api/portfolio", PORTFOLIO_TTL);

async function requirePortfolio(): Promise<ApiPortfolio> {
  const p = await fetchPortfolio();
  if (!p.exists) throw new PortfolioNotSetupError();
  return p;
}

/* -------------------------------- Mapping -------------------------------- */

function mapHolding(h: ApiHolding): Holding {
  return {
    symbol: h.symbol,
    name: h.name,
    sector: h.sector,
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

function mapSummary(p: ApiPortfolio): PortfolioSummary {
  const t = p.totals;
  const equity = t.value;
  const cash = p.virtual_cash;
  const prevEquity = equity - t.day_change;
  const todayChangePct = prevEquity > 0 ? (t.day_change / prevEquity) * 100 : 0;

  return {
    totalValue: equity + cash,
    // Cost basis of the currently-held, priceable shares (qty x avg buy price).
    invested: t.invested,
    availableCash: cash,
    todayChange: t.day_change,
    todayChangePct,
    overallReturn: t.unrealized_pnl,
    overallReturnPct: t.return_percent,
    allPriced: p.holdings.every((h) => h.available),
  };
}

/* -------------------------------- Service -------------------------------- */

export interface PortfolioService {
  /** Cheap state probe (exists / mode / cash) — does not value holdings. */
  getState(): Promise<PortfolioState>;
  getSummary(): Promise<PortfolioSummary>;
  getHoldings(): Promise<Holding[]>;
  getAllocation(): Promise<AllocationSlice[]>;
  getSectorAllocation(): Promise<SectorSlice[]>;
  getTransactions(): Promise<Transaction[]>;
  /** No goals feature yet — always empty, never sample data. */
  getGoals(): Promise<Goal[]>;
  getCash(): Promise<number>;
  /**
   * Real cost-basis curve built ONLY from the user's own transactions
   * (cumulative buy − sell amounts over time). Null when there is nothing
   * meaningful to plot yet — historical market values are not stored.
   */
  getCostBasisHistory(): Promise<HistoryPoint[] | null>;
  /** Create the portfolio: ₹1,00,000 virtual cash ('virtual') or cash 0 ('manual'). */
  start(mode: PortfolioMode): Promise<PortfolioState>;
  /** Virtual market order at the latest available real price. */
  order(symbol: string, side: OrderSide, qty: number): Promise<PortfolioState>;
  /** Manual import of an existing holding (no cash movement). */
  addPosition(symbol: string, qty: number, avgCost: number): Promise<PortfolioState>;
}

const state = (p: ApiPortfolio): PortfolioState => ({
  exists: p.exists,
  mode: p.mode,
  cash: p.virtual_cash,
  initialCapital: p.initial_capital,
  createdAt: p.created_at,
});

const mutated = ["/api/portfolio"];

export const portfolioService: PortfolioService = {
  async getState() {
    const p = await fetchPortfolio();
    return state(p);
  },

  async getSummary() {
    return mapSummary(await requirePortfolio());
  },

  async getHoldings() {
    const p = await fetchPortfolio();
    if (!p.exists) throw new PortfolioNotSetupError();
    return p.holdings.map(mapHolding);
  },

  async getAllocation() {
    const p = await requirePortfolio();
    const priced = p.holdings.filter((h) => h.available && h.value != null);
    const byCountry = (country: "IN" | "US") =>
      priced
        .filter((h) => h.country === country)
        .reduce((sum, h) => sum + (h.value ?? 0), 0);

    const india = byCountry("IN");
    const us = byCountry("US");
    const equity = india + us;
    const cash = p.virtual_cash;
    const total = equity + cash;
    if (total <= 0) return [];

    const slices: AllocationSlice[] = [
      { label: "Equity — India", value: india, pct: Math.round((india / total) * 100) },
      { label: "Equity — US", value: us, pct: Math.round((us / total) * 100) },
      { label: "Cash", value: cash, pct: Math.round((cash / total) * 100) },
    ];
    return slices.filter((s) => s.value > 0);
  },

  async getSectorAllocation() {
    const p = await requirePortfolio();
    const valued = p.holdings.filter((h) => h.available && h.value);
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
    let rows: ApiTransaction[];
    try {
      rows = await apiGet<ApiTransaction[]>("/api/portfolio/transactions", TRANSACTIONS_TTL);
    } catch (e) {
      if (e instanceof ApiError && (e as ApiError).status === 400) return []; // no portfolio yet
      throw e;
    }
    // Company names come from the tracked universe (same source as Research).
    const universe = await import("@/lib/services/stockService")
      .then((m) => m.stockService.getStocks())
      .catch(() => []);
    const nameOf = (symbol: string) => universe.find((s) => s.symbol === symbol)?.name ?? "";

    return rows.map((t) => ({
      id: String(t.id),
      date: t.timestamp.slice(0, 10),
      symbol: t.symbol,
      name: nameOf(t.symbol),
      type: t.type,
      qty: t.qty,
      price: t.price,
      amount: t.amount,
    }));
  },

  async getGoals(): Promise<Goal[]> {
    // No goals feature yet — an empty list, never fabricated goals.
    return [];
  },

  async getCash() {
    const p = await fetchPortfolio();
    return p.exists ? p.virtual_cash : 0;
  },

  async getCostBasisHistory() {
    let rows: ApiTransaction[];
    try {
      rows = await apiGet<ApiTransaction[]>("/api/portfolio/transactions", TRANSACTIONS_TTL);
    } catch {
      return null;
    }
    if (rows.length < 2) return null; // one point makes no line
    const ascending = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let deployed = 0;
    const points: HistoryPoint[] = [];
    for (const t of ascending) {
      deployed += t.type === "BUY" ? t.amount : -t.amount;
      points.push({
        time: Date.parse(t.timestamp),
        value: Math.max(0, Math.round(deployed)),
      });
    }
    // Extend the line to now so same-day trades still render as a curve.
    const last = points[points.length - 1];
    const now = Date.now();
    if (last && now > last.time) points.push({ time: now, value: last.value });
    return points;
  },

  async start(mode) {
    const p = await apiSend<ApiPortfolio>(
      "/api/portfolio/start",
      { mode },
      mutated,
    );
    return state(p);
  },

  async order(symbol, side, qty) {
    const p = await apiSend<ApiPortfolio>(
      "/api/portfolio/order",
      { symbol, side, qty },
      mutated,
    );
    return state(p);
  },

  async addPosition(symbol, qty, avgCost) {
    const p = await apiSend<ApiPortfolio>(
      "/api/portfolio/position",
      { symbol, qty, avg_cost: avgCost },
      mutated,
    );
    return state(p);
  },
};
