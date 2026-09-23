/**
 * STOCK SERVICE — the single entry point every page uses for stock data.
 *
 * The implementation talks to the FastAPI backend (see backend/), which owns
 * market-data fetching, indicator calculation and the recommendation model.
 * The frontend never computes financial values itself.
 *
 * Interface unchanged: components keep calling `stockService.*`.
 */

import type {
  Stock,
  StockAnalysis,
  StockPrediction,
  Technicals,
  TimeRange,
} from "@/lib/types";
import { apiGet, isNotFound } from "@/lib/services/api";
import type { GeneratedCandle } from "@/lib/utils";

/* --------------------------- Backend wire types --------------------------- */

interface ApiCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ApiFundamentals {
  pe: number | null;
  pb: number | null;
  eps: number | null;
  roe: number | null;
  roce: number | null;
  debt_to_equity: number | null;
  market_cap: number | null;
  revenue: number | null;
  net_profit: number | null;
  revenue_growth: number | null;
  profit_growth: number | null;
  dividend_yield: number | null;
  beta: number | null;
}

interface ApiStockSummary {
  symbol: string;
  name: string;
  exchange: string;
  country: "IN" | "US";
  sector: string;
  currency: "INR" | "USD";
  price: number;
  change: number;
  change_percent: number;
  timestamp: string;
  source: string;
  week52_high: number | null;
  week52_low: number | null;
  risk: "Low" | "Moderate" | "High" | null;
  insight: string;
  summary: string;
  fundamentals: ApiFundamentals;
}

interface ApiTechnical {
  price: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number[];
  sma_20: number;
  sma_50: number;
  sma_200: number | null;
  ema_20: number;
  support: number;
  resistance: number;
  volatility: number;
  volume: number;
  volume_avg: number;
  volume_trend: number;
  latest_return: number;
  return_20d: number;
  sma20_above_50: boolean;
}

interface ApiPrediction {
  signal: "BUY" | "HOLD" | "SELL";
  score: number;
  signal_strength: number;
  reasons: string[];
  model: string;
  generated_at: string;
}

interface ApiStockAnalysis extends ApiStockSummary {
  historical_data: ApiCandle[];
  technical: ApiTechnical;
  prediction: ApiPrediction;
}

interface ApiCandleResponse {
  candles: ApiCandle[];
  source: string;
}

/* -------------------------------- Mapping -------------------------------- */

const num = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function mapSummary(b: ApiStockSummary): Stock {
  const f = b.fundamentals ?? ({} as ApiFundamentals);
  return {
    symbol: b.symbol,
    name: b.name,
    exchange: b.exchange,
    country: b.country,
    sector: b.sector,
    currency: b.currency,
    price: b.price,
    change: b.change,
    changePct: b.change_percent,
    marketCap: num(f.market_cap),
    pe: num(f.pe),
    pb: num(f.pb),
    roe: num(f.roe),
    roce: num(f.roce),
    debtToEquity: num(f.debt_to_equity),
    dividendYield: num(f.dividend_yield),
    eps: num(f.eps),
    revenue: num(f.revenue),
    netProfit: num(f.net_profit),
    beta: num(f.beta),
    week52High: b.week52_high ?? b.price,
    week52Low: b.week52_low ?? b.price,
    risk: b.risk ?? null,
    insight: b.insight ?? "",
    summary: b.summary ?? "",
    timestamp: b.timestamp,
    source: b.source,
  };
}

function mapTechnicals(t: ApiTechnical): Technicals {
  return {
    rsi: t.rsi,
    macd: t.macd,
    macdSignal: t.macd_signal,
    macdHistogram: t.macd_histogram ?? [],
    support: t.support,
    resistance: t.resistance,
    ma20: t.sma_20,
    ma50: t.sma_50,
    ma200: t.sma_200 ?? t.price, // not enough history -> fall back to price
    sma20Above50: t.sma20_above_50,
    volumeAvg: t.volume_avg,
    // Extra backend-computed values (consumed by the Advisor):
    ema20: t.ema_20,
    volatility: t.volatility,
    volume: t.volume,
    volumeTrend: t.volume_trend,
    latestReturn: t.latest_return,
    return20d: t.return_20d,
  };
}

function mapPrediction(p: ApiPrediction): StockPrediction {
  return {
    signal: p.signal,
    score: p.score,
    signalStrength: p.signal_strength,
    reasons: p.reasons ?? [],
    model: p.model,
    generatedAt: p.generated_at,
  };
}

function mapAnalysis(b: ApiStockAnalysis): StockAnalysis {
  return {
    ...mapSummary(b),
    technical: mapTechnicals(b.technical),
    prediction: mapPrediction(b.prediction),
  };
}

/* -------------------------------- Service -------------------------------- */

/** Cache lifetimes per chart range (seconds of staleness the UI tolerates). */
const RANGE_TTL: Record<TimeRange, number> = {
  "1D": 60_000,
  "1W": 60_000,
  "1M": 300_000,
  "6M": 300_000,
  "1Y": 300_000,
  "5Y": 600_000,
};

const ANALYSIS_TTL = 60_000;
const UNIVERSE_TTL = 60_000;

const enc = encodeURIComponent;

export interface StockService {
  getStocks(): Promise<Stock[]>;
  /** Full analysis (quote + technicals + prediction). undefined = unknown symbol. */
  getStock(symbol: string): Promise<StockAnalysis | undefined>;
  getCandles(symbol: string, range: TimeRange): Promise<GeneratedCandle[]>;
  getTechnicals(symbol: string): Promise<Technicals>;
}

export const stockService: StockService = {
  async getStocks() {
    const rows = await apiGet<ApiStockSummary[]>("/api/stocks", UNIVERSE_TTL);
    return (rows ?? []).map(mapSummary);
  },

  async getStock(symbol) {
    try {
      const data = await apiGet<ApiStockAnalysis>(
        `/api/stocks/${enc(symbol)}`,
        ANALYSIS_TTL,
      );
      return mapAnalysis(data);
    } catch (error) {
      // Unknown/blocked symbol -> let the page show its empty state.
      if (isNotFound(error)) return undefined;
      throw error; // network/provider failure -> page shows an error state
    }
  },

  async getCandles(symbol, range) {
    const data = await apiGet<ApiCandleResponse>(
      `/api/stocks/${enc(symbol)}/candles?range=${range}`,
      RANGE_TTL[range],
    );
    return (data?.candles ?? []).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  },

  async getTechnicals(symbol) {
    const data = await apiGet<ApiStockAnalysis>(
      `/api/stocks/${enc(symbol)}`,
      ANALYSIS_TTL,
    );
    return mapTechnicals(data.technical);
  },
};
