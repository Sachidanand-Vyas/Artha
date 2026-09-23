"""
Universe snapshot builder — assembles StockSummary objects for every
registered symbol (quotes + fundamentals + quick technicals), and the
market snapshot (indices + breadth + sector moves) for the Markets page.

Everything here is computed from provider data; nothing is hard-coded.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from models.schemas import (
    Breadth,
    IndexQuoteOut,
    MarketSnapshot,
    SectorMove,
)
from services import market_data as md
from services.fundamentals import extract_fundamentals
from services.prediction import build_insight
from services.technical_analysis import classify_risk, compute_technicals
from utils import cache

UNIVERSE_TTL = 300.0       # seconds — quotes refreshed every 5 minutes
MARKET_TTL = 300.0
SUMMARY_MAX_CHARS = 180


def _truncate(text: str, limit: int = SUMMARY_MAX_CHARS) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit]
    return cut[: cut.rfind(" ")] + "…"


def _build_universe() -> dict[str, dict]:
    provider = md.get_provider()
    ticker_by_symbol = {s: e["ticker"] for s, e in md.SYMBOL_REGISTRY.items()}

    frames = provider.batch_history(list(ticker_by_symbol.values()), "1y", "1d")
    if not frames:
        raise md.DataProviderError("Could not download history for the stock universe")
    infos = md.fetch_many_info(list(ticker_by_symbol.values()))

    out: dict[str, dict] = {}
    for symbol, entry in md.SYMBOL_REGISTRY.items():
        ticker = entry["ticker"]
        df = frames.get(ticker)
        if df is None or len(df) < 30:
            continue  # provider has no usable history for this symbol right now
        try:
            tech = compute_technicals(df)
        except ValueError:
            continue

        info = infos.get(ticker) or {}
        fund = extract_fundamentals(info)
        price, change, change_pct, iso = md.quote_from_history(df)

        week = df.tail(252)
        week52_high = float(week["High"].max())
        week52_low = float(week["Low"].min())

        name = info.get("longName") or info.get("shortName") or entry["name"]
        sector = info.get("sector") or "Other"
        summary = _truncate(info.get("longBusinessSummary") or "")

        snapshot = {
            "symbol": symbol,
            "name": name,
            "exchange": entry["exchange"],
            "country": entry["country"],
            "sector": sector,
            "currency": entry["currency"],
            "price": round(price, 2),
            "change": round(change, 2),
            "change_percent": round(change_pct, 3),
            "timestamp": iso,
            "source": md.PROVIDER_NAME,
            "week52_high": round(week52_high, 2),
            "week52_low": round(week52_low, 2),
            "risk": classify_risk(tech.volatility),
            "insight": build_insight(tech, fund),
            "summary": summary,
            "fundamentals": fund.model_dump(),
        }
        out[symbol] = snapshot
    return out


def get_universe_snapshots() -> dict[str, dict]:
    """symbol -> StockSummary dict. Cached for UNIVERSE_TTL seconds."""
    return cache.cached("universe", UNIVERSE_TTL, _build_universe)


def list_universe() -> list[dict]:
    return list(get_universe_snapshots().values())


def _sector_moves(snapshots: dict[str, dict]) -> list[dict]:
    """Sector performance derived from the real daily moves of tracked large caps."""
    buckets: dict[str, list[float]] = {}
    for snap in snapshots.values():
        buckets.setdefault(snap.get("sector") or "Other", []).append(
            float(snap.get("change_percent") or 0.0)
        )
    moves = [
        {"sector": sector, "change_percent": round(sum(vals) / len(vals), 2)}
        for sector, vals in buckets.items()
    ]
    return sorted(moves, key=lambda m: m["change_percent"], reverse=True)


def build_market_snapshot() -> MarketSnapshot:
    provider = md.get_provider()
    tickers = [e["ticker"] for e in md.INDEX_REGISTRY]
    frames = provider.batch_history(tickers, "6mo", "1d")
    if not frames:
        raise md.DataProviderError("Could not download index history")

    indices: list[IndexQuoteOut] = []
    latest_ts = ""
    for entry in md.INDEX_REGISTRY:
        df = frames.get(entry["ticker"])
        if df is None or len(df) < 2:
            continue
        value, change, change_pct, iso = md.quote_from_history(df)
        spark = [round(float(v), 2) for v in df["Close"].tail(40).tolist()]
        latest_ts = max(latest_ts, iso)
        indices.append(
            IndexQuoteOut(
                symbol=entry["symbol"],
                name=entry["name"],
                exchange=entry["exchange"],
                value=round(value, 2),
                change=round(change, 2),
                change_percent=round(change_pct, 3),
                spark=spark,
                currency=entry["currency"],
                market=entry["market"],
                timestamp=iso,
                source=md.PROVIDER_NAME,
            )
        )

    # Breadth (advance/decline across the whole exchange) is not available from
    # this provider — return nulls so the UI shows N/A instead of fake numbers.
    breadth = Breadth(
        advances=None,
        declines=None,
        unchanged=None,
        available=False,
        note="Advance/decline breadth is not available from the current market-data provider.",
    )

    sectors: list[SectorMove] = []
    sectors_note = ""
    try:
        sectors = [SectorMove(**m) for m in _sector_moves(get_universe_snapshots())]
        sectors_note = "Average daily move of tracked large-cap stocks, grouped by sector."
    except Exception:
        sectors_note = "Sector moves are temporarily unavailable."

    return MarketSnapshot(
        indices=indices,
        breadth=breadth,
        sectors=sectors,
        sectors_note=sectors_note,
        timestamp=latest_ts or datetime.now(timezone.utc).isoformat(),
        source=md.PROVIDER_NAME,
    )


def get_market_snapshot() -> MarketSnapshot:
    return cache.cached("market", MARKET_TTL, build_market_snapshot)
