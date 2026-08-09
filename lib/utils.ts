import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------------------------------- */
/*  Number & currency formatting      */
/* ---------------------------------- */

const inr0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const numFmt = new Intl.NumberFormat("en-IN");
const numFmt2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numFmt1 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** ₹12,34,567 */
export const inr = (n: number) => inr0.format(n);
/** ₹1,234.56 */
export const inrPrecise = (n: number) => inr2.format(n);
/** $1,234.56 */
export const usd = (n: number) => usdFmt.format(n);
/** 12,34,567 */
export const num = (n: number) => numFmt.format(n);
export const num2 = (n: number) => numFmt2.format(n);
export const num1 = (n: number) => numFmt1.format(n);

/** Indian compact: ₹95,000 → ₹95K · ₹12,50,000 → ₹12.5L · ₹3,20,00,000 → ₹3.2Cr · ₹20 lakh crore → ₹20L Cr */
export function inrCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}₹${num1(abs / 1e12)}L Cr`;
  if (abs >= 1e7) return `${sign}₹${num1(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${num1(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${num1(abs / 1e3)}K`;
  return `${sign}₹${num0(abs)}`;
}
const num0 = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/** US compact: 2.4T, 850B, 12.4M */
export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${num1(abs / 1e12)}T`;
  if (abs >= 1e9) return `${sign}$${num1(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${num1(abs / 1e6)}M`;
  return `${sign}$${num0(abs)}`;
}

export function marketCapLabel(n: number, currency: "INR" | "USD" = "INR"): string {
  return currency === "INR" ? inrCompact(n) : usdCompact(n);
}

export function currencyOf(c: "INR" | "USD"): (n: number) => string {
  return c === "INR" ? inr : usd;
}

/** Signed percent: +2.35% / -1.20% */
export function pct(n: number, digits = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** Signed number: +1,234 / -456 */
export function signed(n: number, digits = 0): string {
  const v = digits > 0 ? num2(Math.abs(n)) : num0(Math.abs(n));
  return `${n >= 0 ? "+" : "-"}${v}`;
}

/* ---------------------------------- */
/*  Dates & times                     */
/* ---------------------------------- */

const dayFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatFullDate(d: Date = new Date()): string {
  return dayFmt.format(d);
}

export function formatShortDate(ts: number): string {
  return shortFmt.format(ts);
}

/** Relative time: "2h ago", "3d ago" */
export function timeAgo(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return relFmt.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return relFmt.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 2_592_000_000) return relFmt.format(Math.round(diff / 86_400_000), "day");
  return shortFmt.format(ts);
}

/** IST market-open check (Mon–Fri, 09:15–15:30) — used only as a mock status flag. */
export function istMarketOpen(d: Date = new Date()): boolean {
  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ---------------------------------- */
/*  Deterministic random generation   */
/* ---------------------------------- */

/** Small seeded PRNG (mulberry32) so mock data is stable across reloads. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded geometric random-walk of prices. */
export function randomWalk(
  seed: number,
  n: number,
  start: number,
  drift: number,
  vol: number,
): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    const shock = (rnd() - 0.5) * 2 * vol;
    v = Math.max(1, v * (1 + drift + shock));
    out.push(v);
  }
  return out;
}

export interface GeneratedCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Deterministic OHLC candles. `intervalSec` is the seconds between bars
 * (e.g. 300 for 5-minute bars, 86400 for daily). Start price drifts up.
 */
export function generateCandles(
  seed: number,
  n: number,
  startPrice: number,
  intervalSec: number,
  endTime: number,
  drift: number,
  vol: number,
): GeneratedCandle[] {
  const rnd = mulberry32(seed);
  const out: GeneratedCandle[] = [];
  let close = startPrice;
  let time = endTime - n * intervalSec;
  const baseVol = 1_000_000 + rnd() * 3_000_000;
  for (let i = 0; i < n; i++) {
    time += intervalSec;
    const open = close;
    const shock = (rnd() - 0.5) * 2 * vol;
    const c = Math.max(1, open * (1 + drift + shock));
    const hi = Math.max(open, c) * (1 + rnd() * vol * 0.55);
    const lo = Math.min(open, c) * (1 - rnd() * vol * 0.55);
    const volume = Math.round(baseVol * (0.55 + rnd() * 0.9) * (1 + Math.abs(c - open) / open * 12));
    out.push({ time, open, high: hi, low: lo, close: c, volume });
    close = c;
  }
  return out;
}
