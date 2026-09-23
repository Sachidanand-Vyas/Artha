/**
 * CALCULATION ROUTING for the Advisor.
 *
 * 1. `parseCalculation` turns a natural-language question into structured
 *    inputs (amount / rate / tenure / goal) — pure text handling, no maths.
 * 2. `runCalculation` calls the FastAPI calculation engine
 *    (POST /api/finance/calculate), which computes the exact result.
 * 3. `formatCalculation` renders it with Artha's usual number formatting.
 *
 * The LLM (when configured) is given the finished result to explain — it is
 * never asked to do arithmetic itself.
 */

import { apiPost } from "@/lib/services/api";
import { inr } from "@/lib/utils";

export type CalcKind =
  | "compound_fv"
  | "sip_fv"
  | "sip_required"
  | "lumpsum_required"
  | "inflation_adjusted"
  | "cagr"
  | "absolute_return"
  | "required_rate";

export interface CalcRequest {
  kind: CalcKind;
  principal?: number;
  monthly?: number;
  target?: number;
  amount?: number;
  annual_rate_pct?: number;
  inflation_pct?: number;
  years?: number;
  start_value?: number;
  end_value?: number;
}

export interface CalcResult {
  kind: string;
  formula: string;
  inputs: Record<string, number>;
  results: Record<string, number>;
}

export interface CalcParse {
  request: CalcRequest | null;
  /** What the user must supply to make the calculation possible. */
  missing: string[];
  /** True when the question clearly asks for a calculation (even if incomplete). */
  wantsCalculation: boolean;
}

/* ------------------------------- parsing ---------------------------------- */

const MULTIPLIERS: Record<string, number> = {
  lakh: 1e5,
  lac: 1e5,
  lakhs: 1e5,
  crore: 1e7,
  cr: 1e7,
  k: 1e3,
  thousand: 1e3,
};

const CALC_HINT_RE =
  /\b(calculate|compute|what will|how much will|how much do i need|how much should i invest|how much to invest|project(?:ed)?|become|grow to|reach|accumulate|sip returns|compound interest on|future value|target)\b/i;

/** Extract a plain number ("1,25,000" / "10.5") or null. */
function parseAmountToken(raw: string, unit?: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const mult = unit ? MULTIPLIERS[unit.toLowerCase().replace(/s$/, "")] ?? MULTIPLIERS[unit.toLowerCase()] : undefined;
  return mult ? n * mult : n;
}

interface ParsedNumbers {
  amounts: { value: number; index: number; monthly: boolean }[];
  rate: number | null;
  inflationRate: number | null;
  years: number | null;
  months: number | null;
}

function parseNumbers(text: string): ParsedNumbers {
  let work = text;

  // Rates first so those numbers are not mistaken for amounts.
  let rate: number | null = null;
  let inflationRate: number | null = null;
  const rateRe = /(\d+(?:\.\d+)?)\s*(?:%|percent|per cent|p\.?\s?a\.?)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rateRe.exec(work)) !== null) {
    const n = Number(rm[1]);
    const before = work.slice(Math.max(0, rm.index - 40), rm.index).toLowerCase();
    if (/\binflat/.test(before)) inflationRate = n;
    else if (rate === null) rate = n;
  }

  let years: number | null = null;
  const yearRe = /(\d+(?:\.\d+)?)\s*(?:years|yrs|year|y)\b/gi;
  const ym = work.match(yearRe);
  if (ym) years = Number(ym[0].match(/\d+(\.\d+)?/)![0]);

  let months: number | null = null;
  const monthRe = /(\d+(?:\.\d+)?)\s*(?:months|month)\b/gi;
  const mm = work.match(monthRe);
  if (mm) months = Number(mm[0].match(/\d+(\.\d+)?/)![0]);

  // Mask rate/duration spans so only money-like numbers remain.
  work = work
    .replace(rateRe, " ")
    .replace(/(\d+(?:\.\d+)?)\s*(?:years|yrs|year|y)\b/gi, " ")
    .replace(/(\d+(?:\.\d+)?)\s*(?:months|month)\b/gi, " ");

  const amounts: ParsedNumbers["amounts"] = [];
  const amountRe = /(?:₹|rs\.?\s*|inr\s*)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand)?/gi;
  let am: RegExpExecArray | null;
  while ((am = amountRe.exec(work)) !== null) {
    const value = parseAmountToken(am[1], am[2]);
    if (value === null || value <= 0) continue;
    const around = work.slice(Math.max(0, am.index - 24), am.index + (am[0]?.length ?? 0) + 24).toLowerCase();
    const monthly = /per\s*month|monthly|\/\s*mo|\bpm\b|every\s*month|a\s*month|\bper\s*mo\b/.test(around);
    amounts.push({ value, index: am.index, monthly });
  }

  return { amounts, rate, inflationRate, years, months };
}

const TARGET_HINT_RE = /\b(reach|goal|target|accumulate|need to have|need by|worth of|corpus|build up|to have)\b/i;
const SAVE_HINT_RE = /\b(save|saving|sip|monthly|set aside|invest every month|put away)\b/i;

/**
 * Parse an investment/money question into a calculation request.
 * Returns `wantsCalculation: true` whenever the user clearly wants maths,
 * even when some inputs are still missing (the answer then asks for them).
 */
export function parseCalculation(text: string): CalcParse {
  const wantsCalculation = CALC_HINT_RE.test(text);
  const n = parseNumbers(text);
  const hasInflation = /\binflat/i.test(text);
  const isCagr = /\bcagr\b|\bannual(?:ised)? (growth|return) rate\b/i.test(text);
  const monthlyAmt = n.amounts.find((a) => a.monthly);
  const nonMonthly = n.amounts.filter((a) => !a.monthly);
  const first = n.amounts[0];
  const targetish = TARGET_HINT_RE.test(text);
  const saveish = SAVE_HINT_RE.test(text);

  const years = n.years ?? (n.months ? n.months / 12 : null);

  // ---- Cases we can complete right now -------------------------------------
  if (hasInflation && first && years) {
    return {
      wantsCalculation: true,
      missing: [],
      request: {
        kind: "inflation_adjusted",
        amount: first.value,
        years,
        inflation_pct: n.inflationRate ?? n.rate ?? undefined, // 6% default applied server-side? no -> handled below
        // Inflation questions without an explicit rate use 6% as a labelled assumption:
        ...(n.inflationRate ?? n.rate ? {} : { inflation_pct: 6 }),
      },
    };
  }

  if (isCagr && nonMonthly.length >= 2 && years) {
    return {
      wantsCalculation: true,
      missing: [],
      request: { kind: "cagr", start_value: nonMonthly[0].value, end_value: nonMonthly[1].value, years },
    };
  }

  if (monthlyAmt && n.rate != null && years) {
    if (targetish) {
      if (!nonMonthly.length) {
        return { wantsCalculation: true, missing: ["target amount"], request: null };
      }
      return {
        wantsCalculation: true,
        missing: [],
        request: { kind: "sip_required", target: nonMonthly[0].value, annual_rate_pct: n.rate, years },
      };
    }
    return {
      wantsCalculation: true,
      missing: [],
      request: { kind: "sip_fv", monthly: monthlyAmt.value, annual_rate_pct: n.rate, years },
    };
  }

  if (!monthlyAmt && n.rate != null && years && nonMonthly.length) {
    if (targetish && saveish) {
      return {
        wantsCalculation: true,
        missing: [],
        request: { kind: "sip_required", target: nonMonthly[0].value, annual_rate_pct: n.rate, years },
      };
    }
    if (targetish && /\b(return|rate|cagr|yield)\b/i.test(text)) {
      return {
        wantsCalculation: true,
        missing: [],
        request: { kind: "required_rate", target: nonMonthly[0].value, years, ...(nonMonthly.length > 1 ? { principal: nonMonthly[1].value } : {}) },
      };
    }
    if (targetish) {
      return {
        wantsCalculation: true,
        missing: [],
        request: { kind: "lumpsum_required", target: nonMonthly[0].value, annual_rate_pct: n.rate, years },
      };
    }
    return {
      wantsCalculation: true,
      missing: [],
      request: { kind: "compound_fv", principal: nonMonthly[0].value, annual_rate_pct: n.rate, years },
    };
  }

  if (targetish && years && monthlyAmt && n.rate == null) {
    return { wantsCalculation: true, missing: ["expected return rate (%)"], request: null };
  }

  // ---- Calculation requested but inputs are missing -------------------------
  if (wantsCalculation) {
    const missing: string[] = [];
    if (!n.amounts.length) missing.push("amount");
    if (n.rate == null && !hasInflation && !isCagr) missing.push("expected return rate (%)");
    if (!years) missing.push("time horizon (years)");
    return { wantsCalculation: true, missing, request: null };
  }

  return { wantsCalculation: false, missing: [], request: null };
}

/* ------------------------------- execution -------------------------------- */

const CALC_TTL = 5 * 60 * 1000;

/** Ask the FastAPI calculation engine for the exact result. */
export async function runCalculation(request: CalcRequest): Promise<CalcResult> {
  return apiPost<CalcResult>("/api/finance/calculate", request, CALC_TTL);
}

/* ------------------------------- formatting ------------------------------- */

const KIND_LABEL: Record<CalcKind, string> = {
  compound_fv: "Compound growth",
  sip_fv: "SIP future value",
  sip_required: "Monthly contribution needed",
  lumpsum_required: "Upfront investment needed",
  inflation_adjusted: "Inflation adjustment",
  cagr: "CAGR",
  absolute_return: "Absolute return",
  required_rate: "Required return",
};

const money = (v: number | undefined) => (v == null ? "N/A" : inr(Math.round(v)));
const pct = (v: number | undefined, d = 2) => (v == null ? "N/A" : `${v.toFixed(d)}%`);

function inputsLine(req: CalcRequest): string {
  const parts: string[] = [];
  if (req.monthly) parts.push(`${money(req.monthly)}/month`);
  if (req.principal) parts.push(`${money(req.principal)} upfront`);
  if (req.target) parts.push(`goal ${money(req.target)}`);
  if (req.amount) parts.push(`${money(req.amount)}`);
  if (req.start_value != null && req.end_value != null)
    parts.push(`${money(req.start_value)} → ${money(req.end_value)}`);
  if (req.annual_rate_pct != null) parts.push(`at ${pct(req.annual_rate_pct, 1)}`);
  if (req.inflation_pct != null) parts.push(`inflation ${pct(req.inflation_pct, 1)}`);
  if (req.years) parts.push(`over ${req.years} years`);
  return parts.join(" · ");
}

/** Render a finished calculation as the Advisor's reply text. */
export function formatCalculation(req: CalcRequest, res: CalcResult): string {
  const r = res.results;
  const lines: string[] = [`**${KIND_LABEL[req.kind as CalcKind] ?? res.kind}**`, `_${inputsLine(req)}_`, ""];

  switch (req.kind) {
    case "sip_fv":
      lines.push(`**Future value: ${money(r.future_value)}**`);
      lines.push(`Total invested ${money(r.invested)} · gain **${money(r.gain)}**`);
      break;
    case "compound_fv":
      lines.push(`**Future value: ${money(r.future_value)}**`);
      lines.push(`Gain over the period **${money(r.gain)}**`);
      break;
    case "sip_required":
      lines.push(`**Invest ${money(r.monthly_required)} every month** to reach the goal.`);
      lines.push(`Total contributed ${money(r.total_contributed)} · the rest comes from returns.`);
      break;
    case "lumpsum_required":
      lines.push(`**Invest ${money(r.principal_required)} today** to reach the goal at the assumed return.`);
      break;
    case "inflation_adjusted":
      lines.push(
        `**${money(req.amount ?? 0)} today needs to be ${money(r.future_equivalent)} in ${req.years} year${(req.years ?? 0) > 1 ? "s" : ""}** to buy the same things.`,
      );
      lines.push(
        `Alternatively, ${money(req.amount ?? 0)} received then would be worth only **${money(r.purchasing_power_after)}** in today's money (${pct(r.erosion_pct, 0)} of purchasing power lost).`,
      );
      if (req.inflation_pct === 6 && !req.annual_rate_pct)
        lines.push("_Assumes 6% inflation (default — tell me your own rate to change it)._");
      break;
    case "cagr":
      lines.push(`**CAGR: ${pct(r.cagr_pct)}**`);
      break;
    case "absolute_return":
      lines.push(`**Return: ${pct(r.return_pct)}** · gain ${money(r.gain)}`);
      break;
    case "required_rate":
      lines.push(`**You need about ${pct(r.required_rate_pct)} per year** to reach that target in time.`);
      break;
    default:
      lines.push(JSON.stringify(r));
  }

  lines.push("", `\`${res.formula}\``);
  lines.push(
    "_Assumes a constant return every period — markets don't deliver that. An illustration for planning, not a promise._",
  );
  return lines.join("\n");
}

/** Friendly "tell me the missing inputs" reply. */
export function missingInputsReply(missing: string[]): string {
  return [
    "**I can run that — I just need a couple of numbers:**",
    `• ${missing.join("\n• ")}`,
    "",
    'For example: *"₹5,000 per month for 10 years at 12%"* or *"₹1 lakh at 10% for 5 years"*.',
    "",
    "_I calculate in the backend engine (exact maths), never by guessing._",
  ].join("\n");
}
