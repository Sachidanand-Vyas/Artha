"""
Google Gemini transport for the Artha Advisor — official `google-genai` SDK.

Configuration comes ONLY from backend-only environment variables (never
hard-coded, never rendered into the Next.js bundle, never logged):

    GEMINI_API_KEY   Google AI Studio key — required to enable Gemini
    GEMINI_MODEL     model id (optional; default: gemini-3.8-flash)

Contract (see services/llm.py and main.py -> POST /api/advisor/answer):
  * `available()` is False without a key -> the endpoint reports
    `available: false` and the frontend keeps its local/rule-based Advisor.
  * `generate()` raises GeminiError on ANY failure — missing key, timeout,
    rate limit, provider error, empty reply — so the caller always has a
    safe local fallback; the Advisor is never dependent on Gemini.
  * One request = one model call. Nothing is logged or stored server-side:
    no key, no prompt, no history, no reply.
  * Limits are enforced here as defence in depth (question length, turn
    count/length, output size) on top of the pydantic limits in schemas.py.

The system prompt — including the grounding/hallucination rules and the
Artha data for this question — is built by services/llm.py and passed in
unchanged: this module only moves bytes to and from the model.
"""

from __future__ import annotations

import os
import re
from typing import Any, Optional

try:  # google-genai is pinned in requirements.txt; if that install is broken
    from google import genai                    # we still boot and simply run
    from google.genai import types as genai_types  # the local Advisor instead.
    _SDK_IMPORT_ERROR: Optional[str] = None
except Exception as exc:  # pragma: no cover — only on a broken installation
    genai = None  # type: ignore[assignment]
    genai_types = None  # type: ignore[assignment]
    _SDK_IMPORT_ERROR = type(exc).__name__

DEFAULT_MODEL = "gemini-3.8-flash"  # gemini-2.5-flash is deprecated (404); use current model
TIMEOUT_SECONDS = 30            # per-request budget: fail fast -> local fallback
MAX_QUESTION_CHARS = 4_000      # mirrors AdvisorAskIn.question
HISTORY_LIMIT = 6               # most recent turns only (mirrors services/llm)
HISTORY_CHAR_LIMIT = 600        # per-turn cap
MAX_OUTPUT_TOKENS = 900         # answer-sized replies, never raw data dumps

# Anything key-shaped must never leave the process, whatever the SDK raises.
_KEY_LIKE = re.compile(r"AIza[0-9A-Za-z_-]{8,}|sk-[0-9A-Za-z_-]{8,}|Bearer\s+\S+")


class GeminiError(Exception):
    """Any Gemini failure — the caller ALWAYS falls back to the local Advisor."""


def api_key() -> str:
    """The key, read from the backend-only env var. Never logged, never echoed."""
    return os.getenv("GEMINI_API_KEY", "").strip()


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "").strip() or DEFAULT_MODEL


def available() -> bool:
    """True only when a key is present AND the google-genai SDK imported."""
    return bool(api_key()) and genai is not None


# --------------------------------------------------------------------------- #
# Request building — sanitised and size-limited
# --------------------------------------------------------------------------- #

def _clean_question(question: str) -> str:
    text = str(question or "").replace("\x00", "").strip()
    return text[:MAX_QUESTION_CHARS]


def _trim_history(history: Optional[list[dict]]) -> list[dict]:
    """Most recent turns, role/content shape only, capped in count and length."""
    clean: list[dict] = []
    for turn in (history or [])[-HISTORY_LIMIT:]:
        if not isinstance(turn, dict):
            continue
        role = str(turn.get("role", "")).lower()
        content = (
            str(turn.get("content") or turn.get("text") or "").replace("\x00", "")[:HISTORY_CHAR_LIMIT]
        )
        if role in ("user", "assistant") and content.strip():
            clean.append({"role": role, "content": content})
    return clean


def _contents(history: Optional[list[dict]], question: str) -> list[Any]:
    """Gemini chat roles: our 'assistant' turns are sent as 'model'."""
    contents = [
        genai_types.Content(
            role="user" if turn["role"] == "user" else "model",
            parts=[genai_types.Part.from_text(text=turn["content"])],
        )
        for turn in _trim_history(history)
    ]
    contents.append(
        genai_types.Content(
            role="user",
            parts=[genai_types.Part.from_text(text=question)],
        )
    )
    return contents


# --------------------------------------------------------------------------- #
# Error translation — short, safe to return to the frontend (no key, no prompt)
# --------------------------------------------------------------------------- #

def _snippet(exc: Exception, limit: int = 160) -> str:
    raw = f"{type(exc).__name__}: {exc}"
    key = api_key()
    if key:
        raw = raw.replace(key, "[redacted]")
    raw = _KEY_LIKE.sub("[redacted]", raw)
    return " ".join(raw.split())[:limit]


def _translate(exc: Exception) -> GeminiError:
    """Provider/SDK failure -> a GeminiError message that is safe to surface."""
    name = type(exc).__name__.lower()
    code = getattr(exc, "code", None)
    message = str(exc).lower()
    if isinstance(exc, TimeoutError) or "timeout" in name or "timed out" in message:
        return GeminiError(f"Gemini request timed out after {TIMEOUT_SECONDS}s ({_snippet(exc)})")
    if code == 429 or ("rate" in message and "limit" in message):
        return GeminiError(f"Gemini rate limit reached ({_snippet(exc)})")
    if isinstance(code, int):
        return GeminiError(f"Gemini API error HTTP {code} ({_snippet(exc)})")
    return GeminiError(f"Gemini call failed ({_snippet(exc)})")


# --------------------------------------------------------------------------- #
# The single call
# --------------------------------------------------------------------------- #

def _make_client(key: str):  # patched in tests — keeps the SDK in one place
    return genai.Client(
        api_key=key,
        http_options=genai_types.HttpOptions(
            timeout=int(TIMEOUT_SECONDS * 1000),  # SDK takes milliseconds
            # One attempt: a retry loop would only delay the local fallback.
            retry_options=genai_types.HttpRetryOptions(attempts=1),
        ),
    )


# DEBUG (temporary): log the runtime path — no key, no prompt, no history
import logging
logger = logging.getLogger(__name__)

def generate(system: str, history: Optional[list[dict]], question: str) -> str:
    """
    One grounded completion. Returns the model's text, or raises GeminiError
    (missing key / timeout / rate limit / provider error / empty reply) so the
    Advisor can fall back to its existing local behaviour.
    """
    # DEBUG: ADVISOR_REQUEST trace
    logger.info(
        "ADVISOR_REQUEST INTENT=%s GEMINI_SELECTED=true GEMINI_CALL_STARTED",
        (history or [])[-1].get("role", "user") if history else "user",
    )
    if not available():
        raise GeminiError(
            "Gemini SDK unavailable"
            if genai is None
            else "GEMINI_API_KEY is not set"
        )

    q = _clean_question(question)
    if not q:
        raise GeminiError("empty question — nothing to send to Gemini")

    try:
        client = _make_client(api_key())
        response = client.models.generate_content(
            model=model_name(),
            contents=_contents(history, q),
            config=genai_types.GenerateContentConfig(
                system_instruction=str(system or ""),
                temperature=0.3,            # faithful explanation, not creativity
                max_output_tokens=MAX_OUTPUT_TOKENS,
            ),
        )
        logger.info("ADVISOR_REQUEST GEMINI_CALL_SUCCEEDED")
    except GeminiError:
        raise
    except Exception as exc:  # SDK/network/rate-limit/provider failure
        logger.info("ADVISOR_REQUEST FALLBACK_USED=true")
        raise _translate(exc) from None

    try:
        text = (response.text or "").strip()
    except Exception:  # blocked/empty candidates -> no usable text
        text = ""
    if not text:
        raise GeminiError("Gemini returned an empty response")
    return text
