/**
 * Client for the OPTIONAL LLM layer (POST /api/advisor/answer).
 *
 * The provider and its key live only in backend/.env — Gemini via
 * GEMINI_API_KEY / GEMINI_MODEL, or another provider via AI_PROVIDER /
 * AI_API_KEY. Nothing here ever holds a key: the browser only posts the
 * question, the trimmed history and the Artha data for that intent.
 * When no provider is configured — or the call fails for any reason
 * (missing key, timeout, rate limit, provider error) — this returns null and
 * the Advisor falls back to its local knowledge layer, so the app never
 * depends on a paid API.
 */

import { apiPost } from "@/lib/services/api";

export interface LlmTurn {
  role: "user" | "assistant";
  content: string;
}

interface LlmResponse {
  available: boolean;
  text: string | null;
  provider?: string | null;
  error?: string;
}

export async function askLlm(input: {
  question: string;
  history: LlmTurn[];
  context: Record<string, unknown> | null;
  intent: string;
}): Promise<string | null> {
  try {
    const res = await apiPost<LlmResponse>(
      "/api/advisor/answer",
      {
        question: input.question,
        history: input.history,
        context: input.context,
        intent: input.intent,
      },
      0, // never cache LLM answers — each question is a fresh call
    );
    if (res?.available && res.text && res.text.trim()) return res.text;
    return null; // not configured (or provider failed) -> local fallback
  } catch {
    return null; // backend unreachable -> local fallback
  }
}
