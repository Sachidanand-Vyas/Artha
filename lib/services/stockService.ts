import type { Stock, Technicals, TimeRange } from "@/lib/types";
import { getStock, stocks } from "@/lib/mock/stocks";
import { delay } from "@/lib/services/delay";
import { generateCandles, type GeneratedCandle } from "@/lib/utils";

export interface StockService {
  getStocks(): Promise<Stock[]>;
  getStock(symbol: string): Promise<Stock | undefined>;
  getCandles(symbol: string, range: TimeRange): Promise<GeneratedCandle[]>;
  getTechnicals(symbol: string): Promise<Technicals>;
}

/* Range configuration: bar interval (seconds), bar count, drift, volatility */
const RANGE_CFG: Record<
  TimeRange,
  { intervalSec: number; bars: number; drift: number; vol: number }
> = {
  "1D": { intervalSec: 300, bars: 75, drift: 0.00012, vol: 0.0022 },
  "1W": { intervalSec: 3600, bars: 34, drift: 0.0006, vol: 0.004 },
  "1M": { intervalSec: 86400, bars: 22, drift: 0.0012, vol: 0.011 },
  "6M": { intervalSec: 86400, bars: 126, drift: 0.001, vol: 0.012 },
  "1Y": { intervalSec: 86400, bars: 252, drift: 0.0009, vol: 0.013 },
  "5Y": { intervalSec: 604800, bars: 260, drift: 0.0007, vol: 0.02 },
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const candleCache = new Map<string, GeneratedCandle[]>();

export const stockService: StockService = {
  async getStocks() {
    await delay(360);
    return stocks;
  },
  async getStock(symbol) {
    await delay(260);
    return getStock(symbol);
  },
  async getCandles(symbol, range) {
    await delay(420);
    const key = `${symbol}:${range}`;
    const cached = candleCache.get(key);
    if (cached) return cached;

    const stock = getStock(symbol)!;
    const cfg = RANGE_CFG[range];
    const end = Date.now() / 1000;
    const raw = generateCandles(
      hash(`${symbol}:${range}`),
      cfg.bars,
      stock.price * 0.92,
      cfg.intervalSec,
      end,
      cfg.drift,
      cfg.vol,
    );
    // Scale so the last close equals the current price
    const last = raw[raw.length - 1].close;
    const factor = stock.price / last;
    const scaled = raw.map((c) => ({
      ...c,
      open: c.open * factor,
      high: c.high * factor,
      low: c.low * factor,
      close: c.close * factor,
    }));
    candleCache.set(key, scaled);
    return scaled;
  },
  async getTechnicals(symbol) {
    await delay(380);
    const candles = await stockService.getCandles(symbol, "1Y");
    const closes = candles.map((c) => c.close);

    const sma = (n: number) => {
      if (closes.length < n) return closes[closes.length - 1];
      const slice = closes.slice(-n);
      return slice.reduce((a, b) => a + b, 0) / n;
    };
    const sma20 = sma(20);
    const sma50 = sma(50);
    const sma200 = sma(200);

    // RSI(14)
    let gains = 0;
    let losses = 0;
    const len = Math.min(closes.length - 1, 14);
    for (let i = closes.length - 14; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) gains += d;
      else losses -= d;
    }
    gains /= len;
    losses /= len;
    const rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);

    // MACD(12,26,9)
    const ema = (period: number, arr: number[]) => {
      const k = 2 / (period + 1);
      let e = arr[0];
      for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
      return e;
    };
    const ema12 = ema(12, closes);
    const ema26 = ema(26, closes);
    const macd = ema12 - ema26;
    const macdSignal = ema(9, closes.slice(-40).map((_, i, a) => ema(12, a.slice(0, i + 1)) - ema(26, a.slice(0, i + 1))));

    const last60 = candles.slice(-60);
    const support = Math.min(...last60.map((c) => c.low)) * 0.995;
    const resistance = Math.max(...last60.map((c) => c.high)) * 1.005;
    const volumeAvg = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;

    const macdHistogram = closes.slice(-24).map((_, i) => {
      const arr = closes.slice(0, closes.length - 24 + i + 1);
      const m = ema(12, arr) - ema(26, arr);
      const s = ema(9, arr);
      return m - s;
    });

    return {
      rsi,
      macd,
      macdSignal,
      macdHistogram,
      support,
      resistance,
      ma20: sma20,
      ma50: sma50,
      ma200: sma200,
      sma20Above50: sma20 > sma50,
      volumeAvg,
    };
  },
};
