"""
Optional LLM layer for the Artha Advisor.

Configuration comes ONLY from backend-only environment variables — no key is
ever hard-coded, logged or exposed to the Next.js frontend:

    GEMINI_API_KEY   Google AI Studio key -> official google-genai SDK (Gemini)
    GEMINI_MODEL     optional Gemini model id (default: gemini-2.5-flash)
    AI_PROVIDER      optional override: gemini | openai | anthropic
                     (empty -> Gemini automatically when GEMINI_API_KEY exists)
    AI_API_KEY       provider key for openai/anthropic (not used by Gemini)
    AI_MODEL         optional model name for openai/anthropic
    AI_BASE_URL      optional override for OpenAI-compatible gateways
                     (OpenRouter, Groq, DeepSeek, local Ollama, ...)

When no provider is configured — or the provider fails in ANY way (missing
key, timeout, rate limit, error) — the caller gets an error / `available:
false` and the frontend falls back to the local finance-knowledge layer, so
the demo works with zero keys and never depends on Gemini.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

import requests

from . import gemini

# Behavioural contract for the model (see the project spec).
SYSTEM_PROMPT = """You are Artha, a financial education and decision-support assistant.

Your role is to explain financial concepts clearly, analyze available Artha market and portfolio data, perform financial calculations, and help users understand financial decisions.

You can answer questions about:
- stocks
- markets
- investing
- mutual funds
- ETFs
- SIPs
- bonds
- portfolio management
- risk
- diversification
- personal finance
- budgeting
- saving
- retirement planning
- financial calculations
- basic taxation and financial concepts

When current Artha data is provided in the conversation, use it rather than guessing.
Never fabricate market prices, portfolio values, financial metrics or news.

GROUNDING RULES — Artha's retrieved data is authoritative:
- Values under "Application data for this question" come from Artha's own services. Use them verbatim; for Artha-specific values they override your general knowledge.
- Never invent stock prices. Never invent FX rates. Never invent portfolio balances. Never invent holdings. Never invent RSI/MACD values or fundamental values. Never invent calculator results.
- If a required value is not supplied, say the data is unavailable instead of guessing — never fill the gap.
- Quote the timestamp and source supplied with the data ("as of ...", "source: ...") and never call data live or current unless the supplied data says so.
- Artha's BUY/HOLD/SELL signal is a HEURISTIC computed from measured features, not a prediction or guarantee: explain it, but never change, upgrade or downgrade it.
- Calculator results are exact outputs of Artha's calculation engine: explain them, never recompute or alter them.
- Keep clearly separated (1) Artha's supplied data, (2) general financial education, (3) your own estimates or opinions — label (2) and (3) as such.

Distinguish between:
1. factual data (from the provided application data)
2. educational explanations
3. estimates/calculations (show the formula/assumptions)
4. opinions or scenarios (label them as such)

Explain concepts in simple language, with a short example where useful.
When discussing an investment, explain relevant risks and factors instead of presenting certainty.
Do not claim guaranteed returns.
Do not present financial education as personalized professional financial advice.
Match the length of the answer to the question: short questions get short answers.
If a question is unrelated to finance, politely say that Artha is focused on finance and offer to answer a finance-related question instead."""

TIMEOUT_SECONDS = 40
HISTORY_LIMIT = 6
HISTORY_CHAR_LIMIT = 600
CONTEXT_CHAR_LIMIT = 20_000    # serialised Artha context cap (input limit)

# Anything key-shaped must never be returned to the frontend or written to a log.
_KEY_LIKE = re.compile(r"AIza[0-9A-Za-z_-]{8,}|sk-[0-9A-Za-z_-]{8,}|Bearer\s+\S+")


def provider_name() -> str:
    """Selected provider: an explicit AI_PROVIDER wins; otherwise Gemini when
    its key exists, so an empty config still means "no provider"."""
    p = os.getenv("AI_PROVIDER", "").strip().lower()
    if p in ("gemini", "google", "google-gemini"):
        return "gemini"
    if p:
        return p
    return "gemini" if gemini.api_key() else ""


def configured() -> bool:
    """True only when the selected provider has everything it needs (and, for
    Gemini, the google-genai SDK actually imported)."""
    p = provider_name()
    if p == "gemini":
        return gemini.available()
    return bool(p) and bool(os.getenv("AI_API_KEY", "").strip())


def safe_error(exc: BaseException, limit: int = 200) -> str:
    """
    Provider failure message that is safe to return to the frontend: short,
    key-redacted, and stripped of anything that could leak a credential or a
    full prompt. Used for every provider — the raw exception never escapes.
    """
    raw = f"{type(exc).__name__}: {exc}"
    for name in ("AI_API_KEY", "GEMINI_API_KEY"):
        value = os.getenv(name, "").strip()
        if value:
            raw = raw.replace(value, "[redacted]")
    raw = _KEY_LIKE.sub("[redacted]", raw)
    return " ".join(raw.split())[:limit]


def _trim_history(history: Optional[list[dict]]) -> list[dict]:
    """Keep the most recent turns, with a role/content shape only."""
    clean: list[dict] = []
    for turn in (history or [])[-HISTORY_LIMIT:]:
        role = str(turn.get("role", "")).lower()
        content = str(turn.get("content") or turn.get("text") or "")[:HISTORY_CHAR_LIMIT]
        if role in ("user", "assistant") and content.strip():
            clean.append({"role": role, "content": content})
    return clean


def _system_block(context: Optional[dict]) -> str:
    """Application context is appended to the system prompt — only what's needed.
    Timestamps/sources ride along inside the context, so the model can say how
    fresh the data is. Oversized context is truncated (input limit), never
    silently rewritten."""
    if not context:
        return SYSTEM_PROMPT
    try:
        blob = json.dumps(context, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return SYSTEM_PROMPT
    if len(blob) > CONTEXT_CHAR_LIMIT:
        blob = blob[:CONTEXT_CHAR_LIMIT] + " …[context truncated: too large]"
    return (
        SYSTEM_PROMPT
        + "\n\nApplication data for this question (use it; never invent values):\n"
        + blob
    )


def _ask_openai(system: str, history: list[dict], question: str) -> str:
    base = (os.getenv("AI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("AI_MODEL") or "gpt-4o-mini"
    messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": question}]
    resp = requests.post(
        f"{base}/chat/completions",
        headers={
            "Authorization": f"Bearer {os.getenv('AI_API_KEY', '').strip()}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": messages, "temperature": 0.3},
        timeout=TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    data = resp.json()
    return str(data["choices"][0]["message"]["content"])


def _ask_anthropic(system: str, history: list[dict], question: str) -> str:
    base = (os.getenv("AI_BASE_URL") or "https://api.anthropic.com").rstrip("/")
    model = os.getenv("AI_MODEL") or "claude-3-5-sonnet-latest"
    messages = [*history, {"role": "user", "content": question}]
    resp = requests.post(
        f"{base}/v1/messages",
        headers={
            "x-api-key": os.getenv("AI_API_KEY", "").strip(),
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 1024,
            "system": system,
            "messages": messages,
            "temperature": 0.3,
        },
        timeout=TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    data = resp.json()
    parts = data.get("content") or []
    return "".join(str(p.get("text", "")) for p in parts if p.get("type") == "text")


def ask(question: str, history: Optional[list[dict]], context: Optional[dict]) -> str:
    """Call the configured provider. Raises on failure (caller falls back locally)."""
    # DEBUG: ADVISOR_REQUEST trace
    import logging
    logger = logging.getLogger(__name__)
    p = provider_name()
    logger.info(
        "ADVISOR_REQUEST INTENT=%s GEMINI_SELECTED=%s",
        (question or "?")[:60],
        p == "gemini",
    )
    system = _system_block(context)
    turns = _trim_history(history)
    if p == "gemini":
        # Official google-genai SDK; context + grounding rules live in `system`.
        return gemini.generate(system=system, history=turns, question=question)
    if p in ("openai", "openai_compatible", "compatible"):
        return _ask_openai(system, turns, question)
    if p == "anthropic":
        return _ask_anthropic(system, turns, question)
    raise ValueError(f"Unsupported AI_PROVIDER '{p}' (use 'gemini', 'openai' or 'anthropic')")


def status() -> dict[str, Any]:
    """Safe-to-expose status: never includes the key itself."""
    p = provider_name()
    if p == "gemini":
        return {
            "configured": gemini.available(),
            "provider": "gemini",
            "model": gemini.model_name(),
        }
    return {
        "configured": configured(),
        "provider": p or None,
        "model": os.getenv("AI_MODEL") or None,
    }
