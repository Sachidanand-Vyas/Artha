"""
Optional LLM layer for the Artha Advisor.

Configuration comes ONLY from the environment — no keys are ever hard-coded:

    AI_PROVIDER   empty/disabled | openai (any OpenAI-compatible base) | anthropic
    AI_API_KEY    provider key (required when a provider is selected)
    AI_MODEL      optional model name (provider defaults are used otherwise)
    AI_BASE_URL   optional override for OpenAI-compatible gateways
                  (OpenRouter, Groq, DeepSeek, local Ollama, ...)

When no provider is configured, `configured()` is False and the frontend falls
back to the local finance-knowledge layer, so the demo works with zero keys.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import requests

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


def provider_name() -> str:
    return os.getenv("AI_PROVIDER", "").strip().lower()


def configured() -> bool:
    """True only when both a provider and a key are present in the environment."""
    return bool(provider_name()) and bool(os.getenv("AI_API_KEY", "").strip())


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
    """Application context is appended to the system prompt — only what's needed."""
    if not context:
        return SYSTEM_PROMPT
    return (
        SYSTEM_PROMPT
        + "\n\nApplication data for this question (use it; never invent values):\n"
        + json.dumps(context, ensure_ascii=False)
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
    p = provider_name()
    system = _system_block(context)
    turns = _trim_history(history)
    if p in ("openai", "openai_compatible", "compatible"):
        return _ask_openai(system, turns, question)
    if p == "anthropic":
        return _ask_anthropic(system, turns, question)
    raise ValueError(f"Unsupported AI_PROVIDER '{p}' (use 'openai' or 'anthropic')")


def status() -> dict[str, Any]:
    """Safe-to-expose status: never includes the key itself."""
    p = provider_name()
    return {
        "configured": configured(),
        "provider": p or None,
        "model": os.getenv("AI_MODEL") or None,
    }
