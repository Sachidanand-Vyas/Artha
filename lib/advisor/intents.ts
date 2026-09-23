/**
 * LIGHTWEIGHT INTENT + ENTITY DETECTION for the Advisor.
 *
 * Deliberately simple and auditable (no NLP model): keyword/regex scoring plus
 * conversation context. The goal is only that the Advisor does NOT assume
 * every question is about a stock — it must recognise whether the user wants:
 *   general finance knowledge / stock data / market data / portfolio data /
 *   a calculation / or something out of scope entirely.
 */

import type { KnowledgeEntry } from "@/lib/advisor/knowledge";
import type { Stock } from "@/lib/types";

export type Intent =
  | "GENERAL_FINANCE"
  | "INVESTING_EDUCATION"
  | "STOCK_ANALYSIS"
  | "MARKET_DATA"
  | "PORTFOLIO"
  | "CALCULATION"
  | "RISK"
  | "TAX"
  | "RETIREMENT"
  | "OUT_OF_SCOPE";

/** Which aspect of a stock the user asked about. */
export type StockField =
  | "price"
  | "rsi"
  | "macd"
  | "valuation"
  | "moving-average"
  | "dividend"
  | "risk"
  | "why"
  | "analysis";

/** Knowledge category -> the spec's intent taxonomy. */
export function intentForCategory(cat: KnowledgeEntry["category"]): Intent {
  switch (cat) {
    case "tax":
      return "TAX";
    case "retirement":
      return "RETIREMENT";
    case "investing":
      return "INVESTING_EDUCATION";
    default:
      return "GENERAL_FINANCE";
  }
}

/* -------------------------------------------------------------------------- */
/*  Stock entity resolution                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Common ways people name our tracked stocks without typing the ticker.
 * Resolved entities are validated against the live universe by the caller.
 */
export const STOCK_ALIASES: Record<string, string> = {
  sbi: "SBIN",
  "state bank": "SBIN",
  "state bank of india": "SBIN",
  hdfc: "HDFCBANK",
  hdfcbank: "HDFCBANK",
  icici: "ICICIBANK",
  reliance: "RELIANCE",
  "reliance industries": "RELIANCE",
  infosys: "INFY",
  tcs: "TCS",
  "tata consultanc": "TCS",
  "tata motors": "TATAMOTORS",
  wipro: "WIPRO",
  "l&t": "LT",
  "l and t": "LT",
  larsen: "LT",
  "larsen & toubro": "LT",
  hul: "HINDUNILVR",
  unilever: "HINDUNILVR",
  "hindustan unilever": "HINDUNILVR",
  bajaj: "BAJFINANCE",
  "bajaj finance": "BAJFINANCE",
  "asian paints": "ASIANPAINT",
  titan: "TITAN",
  itc: "ITC",
  apple: "AAPL",
  microsoft: "MSFT",
  nvidia: "NVDA",
  nvda: "NVDA",
  tesla: "TSLA",
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (s: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(s)}([^a-z0-9]|$)`, "i");

/**
 * Resolve a stock mentioned in free text to a tracked symbol.
 * Tries: aliases -> tickers -> full company names (longest match wins).
 * Returns null when no tracked stock is mentioned.
 */
export function resolveStockEntity(text: string, universe: Stock[] | null): string | null {
  const t = text.toLowerCase();

  // 1. Curated aliases (longest keys first so "state bank of india" beats "sbi"-style prefixes).
  const aliasKeys = Object.keys(STOCK_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of aliasKeys) {
    if (wordRe(key).test(t)) return STOCK_ALIASES[key];
  }

  if (!universe?.length) return null;

  // 2. Exact ticker mention (word boundary so "ITC" ≠ "NOTICE").
  for (const s of universe) {
    if (wordRe(s.symbol).test(t)) return s.symbol;
  }

  // 3. Full company name (longest match wins: "HDFC Bank" before "Bank").
  let best: { symbol: string; len: number } | null = null;
  for (const s of universe) {
    const name = s.name.toLowerCase();
    if (name.length >= 4 && t.includes(name) && (!best || name.length > best.len)) {
      best = { symbol: s.symbol, len: name.length };
    }
  }
  return best?.symbol ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Index / market entity                                                      */
/* -------------------------------------------------------------------------- */

export type IndexEntity = "NIFTY 50" | "SENSEX" | "MARKET";

/** True for index/market-level questions (as opposed to one stock). */
export function detectIndexEntity(text: string): IndexEntity | null {
  const t = text.toLowerCase();
  if (/\bbank nifty\b|\bnifty\b|\bsensex\b|\bnifty 50\b/.test(t)) {
    return /sensex/.test(t) ? "SENSEX" : "NIFTY 50";
  }
  if (/\b(share|stock)\s+market\b|\bmarket (today|now|performance|level|close|closed|open|status)\b|\bhow (is|are) (the )?markets?\b|\bmarket\b.*\b(today|up|down|fall|rise|perform)/.test(t)) {
    return "MARKET";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Stock question aspect                                                      */
/* -------------------------------------------------------------------------- */

export function detectStockField(text: string): StockField {
  const t = text.toLowerCase();
  if (/\brsi\b/.test(t)) return "rsi";
  if (/\bmacd\b/.test(t)) return "macd";
  if (/\bp\s*\/?\s*e\b|\bpe\b|\bp\s*\/?\s*b\b|\bpb\b|valuation|expensive|cheap|costly|overvalued|undervalued|\broe\b|book value|debt.to.equity/.test(t)) return "valuation";
  if (/\bdividend\b/.test(t)) return "dividend";
  if (/\bmoving average\b|\bsma\b|\bema\b|\b\d+\s*-?\s*day (average|ma)\b|\btrend\b/.test(t)) return "moving-average";
  if (/\bvolatil|\bbeta\b|\brisky\b|\brisk\b|\bsafe\b/.test(t)) return "risk";
  if (/\bprice\b|\btrading at\b|\bltp\b|\bquote\b|\bhow much is\b|\bworth\b|\bcurrent (value|level)\b/.test(t)) return "price";
  if (/\bwhy\b|\breason\b|\bfell\b|\bfall(s|ing)?\b|\bdrop(ped|ping)?\b|\bdeclin|\bris(e|ing)\b|\bjump|\bsurg|\bcrash|\bmov(e|ing)\b|\bslump|\btoday\b|\brecently\b/.test(t)) return "why";
  return "analysis";
}

/* -------------------------------------------------------------------------- */
/*  Portfolio questions                                                        */
/* -------------------------------------------------------------------------- */

const PORTFOLIO_RE = new RegExp(
  [
    "\\b(portfolio|holdings|positions)\\b", // "my portfolio", "my holdings"
    "\\b(my|our)\\b[^?]{0,40}\\b(holdings?|positions?|exposure|allocation|investments?|portfolio)\\b",
    "\\bam i (diversified|over[- ]?exposed|too concentrated)\\b",
    "\\bhow much (am i|do i) (invested|hold|own)\\b",
    "\\bhow much\\b[^?]{0,30}\\bdo i (hold|own)\\b",
    "\\bwhy (is|has|was) my\\b",
    "\\b(sector|sectoral)\\b[^?]{0,30}\\b(exposure|allocation|do i hold|am i)\\b",
    "\\bincrease\\b[^?]{0,30}\\bmy\\b[^?]{0,30}\\ballocation\\b",
    "\\btoo concentrated\\b|\\bconcentration\\b",
  ].join("|"),
  "i",
);

export const isPortfolioQuestion = (text: string): boolean => PORTFOLIO_RE.test(text);

/* -------------------------------------------------------------------------- */
/*  Out of scope / greeting / elliptical follow-ups                            */
/* -------------------------------------------------------------------------- */

const OUT_OF_SCOPE_RE =
  /\b(cricket|ipl|football|soccer|chess|olympic|movie|bollywood|hollywood|celebrity|gossip|weather|temperature|rainfall?|recipe|cooking|politics|politician|elections?|song|lyrics|gym|workout|bodybuilding|girlfriend|boyfriend|horoscope|astrology|video game|console)\b/i;

export const isOutOfScope = (text: string): boolean => OUT_OF_SCOPE_RE.test(text);

export const isGreeting = (text: string): boolean =>
  /^(hi|hello|hey|yo|namaste|namaskar|hola|good (morning|afternoon|evening|night))[.!?\s]*$/i.test(
    text.trim(),
  );

export type FollowUp =
  | { type: "why" }
  | { type: "what-about"; payload: string }
  | null;

const WHY_RE =
  /^(why|why\?|why is that|why is that\?|why's that|why's that\?|why so|because|how so|explain(?: that| why| more)?|elaborate|more(?: detail| info| details)?|go on|tell me more|can you explain(?: that| more)?)[.!]?$/i;

const WHAT_ABOUT_RE = /^(?:and\s+)?(?:what|how) about\s+([^?]+?)[?]?$|^and\s+([^?]+?)[?]?$/i;

/**
 * Detects elliptical messages that only make sense with conversation context
 * ("Why?" / "What about Reliance?").
 */
export function detectFollowUp(text: string): FollowUp {
  const t = text.trim();
  if (t.length > 60) return null;
  if (WHY_RE.test(t)) return { type: "why" };
  const m = t.match(WHAT_ABOUT_RE);
  if (m) return { type: "what-about", payload: (m[1] ?? m[2] ?? "").trim() };
  return null;
}

/** The previous user turn (skipping the current message) for context. */
export function previousUserTurn(
  history: { role: string; text: string }[],
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && history[i].text.trim()) return history[i].text;
  }
  return null;
}
