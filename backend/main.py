"""
Artha FastAPI backend — the data + analysis layer for the Next.js frontend.

Flow (viva one-liner):
    User -> Next.js -> FastAPI -> market data -> indicators/fundamentals
          -> feature-based recommendation -> JSON -> existing Artha UI

Run:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import init_db
from models.schemas import AdvisorAskIn, CalcIn, CalcResult, Candle, HoldingIn, StockAnalysis
from routes_account import router as account_router
from services import llm
from services import market_data as md
from services.calculations import calculate
from services.fundamentals import extract_fundamentals
from services.portfolio import value_portfolio
from services.prediction import build_insight, recommend
from services.technical_analysis import classify_risk, compute_technicals
from services.universe import get_market_snapshot, get_universe_snapshots, list_universe

load_dotenv()

app = FastAPI(
    title="Artha API",
    description="Market data, technical/fundamental analysis and BUY/HOLD/SELL signals.",
    version="0.1.0",
)

# Local dev: Next.js on 3000, FastAPI on 8000. No production assumptions.
FRONTEND_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    # Chrome sends a Private Network Access preflight (Access-Control-
    # Request-Private-Network) even for localhost -> localhost; Starlette >=1.6
    # rejects it with 400 unless explicitly allowed. Origins stay restricted
    # to FRONTEND_ORIGINS, so this only unlocks local dev.
    allow_private_network=True,
)

# Accounts, onboarding preferences and the virtual (paper-trading) portfolio.
# User data lives in the local SQLite file — see db.py / routes_account.py.
app.include_router(account_router)
init_db()


# ---------------------------------------------------------------------------
# Error handling — the frontend must get clean JSON it can turn into an
# error state, never a stack trace.
# ---------------------------------------------------------------------------
@app.exception_handler(md.SymbolNotFoundError)
async def symbol_not_found(_request, exc: md.SymbolNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc.args[0] if exc.args else exc)})


@app.exception_handler(md.DataProviderError)
async def provider_error(_request, exc: md.DataProviderError):
    message = str(exc)
    # An unknown ticker resolves but yields no data -> treat as 404, not 502.
    if "No historical data" in message:
        return JSONResponse(status_code=404, content={"detail": message})
    return JSONResponse(status_code=502, content={"detail": message})


@app.exception_handler(ValueError)
async def value_error(_request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok", "provider": md.PROVIDER_NAME}


# ---------------------------------------------------------------------------
# Advisor — calculation engine + optional LLM layer
# ---------------------------------------------------------------------------
@app.post("/api/finance/calculate")
def finance_calculate(inp: CalcIn) -> CalcResult:
    """
    Exact financial maths (SIP, compound interest, inflation, CAGR, required
    rate). Deterministic code — an LLM is never asked to do arithmetic.
    """
    return calculate(inp)          # ValueError -> 422 via the app handler


@app.get("/api/advisor/status")
def advisor_status():
    """Whether an LLM provider is configured (never exposes the key)."""
    return llm.status()


@app.post("/api/advisor/answer")
def advisor_answer(payload: AdvisorAskIn):
    """
    Optional LLM answer for the Advisor. `available: false` means no provider
    is configured — the frontend then falls back to its local knowledge layer,
    so the app runs with zero API keys.
    """
    if not llm.configured():
        return {"available": False, "text": None, "provider": None}
    try:
        text = llm.ask(payload.question, payload.history, payload.context)
    except Exception as exc:  # provider/network failure -> local fallback
        return {"available": True, "text": None, "provider": llm.provider_name(), "error": str(exc)}
    return {"available": True, "text": text, "provider": llm.provider_name()}


# ---------------------------------------------------------------------------
# Stocks
# ---------------------------------------------------------------------------
def _bar_time(ts) -> int:
    """Bar index -> unix seconds (naive daily timestamps are UTC dates)."""
    import pandas as pd

    t = pd.Timestamp(ts)
    if t.tz is None:
        t = t.tz_localize("UTC")
    return int(t.timestamp())


def _df_to_candles(df) -> list[Candle]:
    candles: list[Candle] = []
    for ts, row in df.iterrows():
        candles.append(
            Candle(
                time=_bar_time(ts),
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=float(row.get("Volume", 0) or 0),
            )
        )
    return candles


@app.get("/api/stocks")
def list_stocks():
    """Universe listing: latest quotes + fundamentals for every registered symbol."""
    return list_universe()


@app.get("/api/stocks/{symbol}")
def get_stock(symbol: str) -> StockAnalysis:
    """
    Full analysis for one stock:
    quote + historical OHLCV + technical indicators + fundamentals + prediction.
    """
    entry = md.resolve_symbol(symbol)          # raises 404 for unknown symbols
    provider = md.get_provider()

    df = provider.history(entry["ticker"], "1y", "1d")   # raises 404/502
    if len(df) < 30:
        raise md.DataProviderError(f"No historical data available for {entry['ticker']}")

    info = provider.info(entry["ticker"])       # {} on failure -> null fundamentals
    fund = extract_fundamentals(info)
    tech = compute_technicals(df)
    prediction = recommend(tech, fund)          # calculated, never hard-coded
    price, change, change_pct, iso = md.quote_from_history(df)

    week = df.tail(252)
    name = info.get("longName") or info.get("shortName") or entry["name"]

    return StockAnalysis(
        symbol=entry["symbol"],
        name=name,
        exchange=entry["exchange"],
        country=entry["country"],
        sector=info.get("sector") or "Other",
        currency=entry["currency"],
        price=round(price, 2),
        change=round(change, 2),
        change_percent=round(change_pct, 3),
        timestamp=iso,
        source=md.PROVIDER_NAME,
        week52_high=round(float(week["High"].max()), 2),
        week52_low=round(float(week["Low"].min()), 2),
        risk=classify_risk(tech.volatility),   # derived from realised volatility
        insight=build_insight(tech, fund),      # generated from actual indicator values,
        summary=(info.get("longBusinessSummary") or "")[:180],
        fundamentals=fund,
        historical_data=_df_to_candles(df),
        technical=tech,
        prediction=prediction,
    )


@app.get("/api/stocks/{symbol}/candles")
def get_candles(symbol: str, range: str = "1Y"):
    """OHLCV bars for the research chart. `range`: 1D | 1W | 1M | 6M | 1Y | 5Y."""
    entry = md.resolve_symbol(symbol)
    cfg = md.RANGE_CFG.get(range.strip().upper())
    if cfg is None:
        raise ValueError(f"Unsupported range '{range}' — use one of {', '.join(md.RANGE_CFG)}")
    period, interval, _ttl = cfg
    provider = md.get_provider()
    df = provider.history(entry["ticker"], period, interval)
    return {
        "symbol": entry["symbol"],
        "range": range.strip().upper(),
        "interval": interval,
        "candles": _df_to_candles(df),
        "source": md.PROVIDER_NAME,
    }


# ---------------------------------------------------------------------------
# Markets
# ---------------------------------------------------------------------------
@app.get("/api/markets")
def get_markets():
    """
    Indices (NIFTY/SENSEX/…), sector moves and breadth.

    Breadth is provider-dependent: when unavailable it is returned as null so
    the UI can show N/A instead of fabricated numbers.
    """
    return get_market_snapshot()


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------
@app.post("/api/portfolio/holdings")
def portfolio_holdings(holdings: list[HoldingIn]):
    """Value user holdings at latest available market prices."""
    if not holdings:
        return value_portfolio([])
    return value_portfolio(holdings)
