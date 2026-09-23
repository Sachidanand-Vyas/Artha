/**
 * Client for the OPTIONAL LLM layer (POST /api/advisor/answer).
 *
 * The provider + key live only in backend/.env (AI_PROVIDER / AI_API_KEY).
 * When no provider is configured — or the call fails for any reason — this
 * returns null and the Advisor falls back to its local knowledge layer, so
 * the demo never depends on a paid API.
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
