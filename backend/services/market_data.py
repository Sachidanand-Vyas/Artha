"""
Market data provider layer.

`MarketDataProvider` is the abstraction the rest of the backend depends on, so
the data source can be swapped (NSE vendor, Alpha Vantage, broker API, …)
without touching analysis code. The concrete implementation below reads from
Yahoo Finance via yfinance — no API key required, suitable for development
and demos. Yahoo data is *latest available* (may be delayed) — never labelled
as live anywhere in Artha.

Environment:
    MARKET_DATA_API_KEY  — only needed if you switch to a keyed provider.
"""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

import pandas as pd
import yfinance as yf

from utils import cache

PROVIDER_NAME = "Yahoo Finance"

# ---------------------------------------------------------------------------
# Symbol registry
# ---------------------------------------------------------------------------
# Display symbol -> provider ticker + static identity fields.
# Static identity (exchange/currency/name) is metadata, not market data.
SYMBOL_REGISTRY: dict[str, dict[str, Any]] = {
    "RELIANCE":  {"ticker": "RELIANCE.NS",  "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Reliance Industries"},
    "TCS":       {"ticker": "TCS.NS",       "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Tata Consultancy Services"},
    "INFY":      {"ticker": "INFY.NS",      "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Infosys"},
    "HDFCBANK":  {"ticker": "HDFCBANK.NS",  "exchange": "NSE", "currency": "INR", "country": "IN", "name": "HDFC Bank"},
    "ICICIBANK": {"ticker": "ICICIBANK.NS", "exchange": "NSE", "currency": "INR", "country": "IN", "name": "ICICI Bank"},
    "SBIN":      {"ticker": "SBIN.NS",      "exchange": "NSE", "currency": "INR", "country": "IN", "name": "State Bank of India"},
    # TATAMOTORS.NS was retired when Tata Motors demerged (CV entity now trades as TMCV.NS)
    "TATAMOTORS":{"ticker": "TMCV.NS",      "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Tata Motors (CV)"},
    "WIPRO":     {"ticker": "WIPRO.NS",     "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Wipro"},
    "LT":        {"ticker": "LT.NS",        "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Larsen & Toubro"},
    "HINDUNILVR":{"ticker": "HINDUNILVR.NS","exchange": "NSE", "currency": "INR", "country": "IN", "name": "Hindustan Unilever"},
    "BAJFINANCE":{"ticker": "BAJFINANCE.NS","exchange": "NSE", "currency": "INR", "country": "IN", "name": "Bajaj Finance"},
    "ASIANPAINT":{"ticker": "ASIANPAINT.NS","exchange": "NSE", "currency": "INR", "country": "IN", "name": "Asian Paints"},
    "TITAN":     {"ticker": "TITAN.NS",     "exchange": "NSE", "currency": "INR", "country": "IN", "name": "Titan Company"},
    "ITC":       {"ticker": "ITC.NS",       "exchange": "NSE", "currency": "INR", "country": "IN", "name": "ITC"},
    "AAPL":      {"ticker": "AAPL",         "exchange": "NASDAQ", "currency": "USD", "country": "US", "name": "Apple Inc."},
    "MSFT":      {"ticker": "MSFT",         "exchange": "NASDAQ", "currency": "USD", "country": "US", "name": "Microsoft"},
    "NVDA":      {"ticker": "NVDA",         "exchange": "NASDAQ", "currency": "USD", "country": "US", "name": "NVIDIA"},
    "TSLA":      {"ticker": "TSLA",         "exchange": "NASDAQ", "currency": "USD", "country": "US", "name": "Tesla"},
}

UNIVERSE = list(SYMBOL_REGISTRY.keys())

# Index/commodity/FX tickers for the Markets page.
INDEX_REGISTRY: list[dict[str, Any]] = [
    {"symbol": "NIFTY 50",  "ticker": "^NSEI",     "name": "NIFTY 50",           "exchange": "NSE",     "currency": "INR", "market": "INDIA"},
    {"symbol": "SENSEX",    "ticker": "^BSESN",    "name": "BSE SENSEX",         "exchange": "BSE",     "currency": "INR", "market": "INDIA"},
    {"symbol": "NASDAQ",    "ticker": "^IXIC",     "name": "NASDAQ Composite",   "exchange": "NASDAQ",  "currency": "USD", "market": "GLOBAL"},
    {"symbol": "S&P 500",   "ticker": "^GSPC",     "name": "S&P 500",            "exchange": "NYSE",    "currency": "USD", "market": "GLOBAL"},
    {"symbol": "GOLD",      "ticker": "GC=F",      "name": "Gold (spot, USD/oz)","exchange": "COMEX",   "currency": "USD", "market": "GLOBAL"},
    {"symbol": "USD/INR",   "ticker": "USDINR=X",  "name": "US Dollar / INR",    "exchange": "FX",      "currency": "INR", "market": "GLOBAL"},
]

# Chart ranges offered by the research page -> (yfinance period, interval)
RANGE_CFG: dict[str, tuple[str, str, float]] = {
    # range: (period, interval, cache_ttl_seconds)
    "1D": ("1d", "5m", 120),
    "1W": ("5d", "30m", 120),
    "1M": ("1mo", "1d", 1800),
    "6M": ("6mo", "1d", 1800),
    "1Y": ("1y", "1d", 1800),
    "5Y": ("5y", "1wk", 3600),
}


class SymbolNotFoundError(KeyError):
    """Requested symbol is not in the registry and could not be resolved."""


class DataProviderError(RuntimeError):
    """The upstream market-data provider failed or returned no data."""


class MarketDataProvider(Protocol):
    """What the rest of the backend needs from a market-data source."""

    name: str

    def history(self, ticker: str, period: str, interval: str) -> pd.DataFrame:
        """OHLCV bars for one ticker. Raises DataProviderError on failure."""
        ...

    def batch_history(
        self, tickers: list[str], period: str, interval: str
    ) -> dict[str, pd.DataFrame]:
        """OHLCV bars for many tickers in as few requests as possible."""
        ...

    def info(self, ticker: str) -> dict:
        """Fundamental/company metadata for one ticker (may be empty on failure)."""
        ...


def resolve_symbol(symbol: str) -> dict[str, Any]:
    """
    Resolve a user-facing symbol to a registry entry.

    Unknown symbols default to NSE (e.g. "DMART" -> DMART.NS) — Artha's primary
    universe is Indian equities. The provider then decides whether it exists.
    """
    key = (symbol or "").strip().upper()
    if key in SYMBOL_REGISTRY:
        return {"symbol": key, **SYMBOL_REGISTRY[key]}
    # Explicit provider tickers pass through (RELIANCE.NS, ^NSEI, …)
    if any(key.endswith(sfx) for sfx in (".NS", ".BO")) or key.startswith("^"):
        return {
            "symbol": key.split(".")[0].lstrip("^"),
            "ticker": key,
            "exchange": "NSE" if key.endswith((".NS", ".BO")) else "OTHER",
            "currency": "INR",
            "country": "IN",
            "name": key,
        }
    if key.replace("-", "").replace("^", "").replace("=", "").isalpha() and 1 <= len(key) <= 15:
        return {
            "symbol": key,
            "ticker": f"{key}.NS",
            "exchange": "NSE",
            "currency": "INR",
            "country": "IN",
            "name": key,
        }
    raise SymbolNotFoundError(f"Unknown symbol: {symbol}")


def _normalise_frame(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """yfinance may return flat or MultiIndex columns depending on batch size."""
    if df is None or df.empty:
        return pd.DataFrame()
    if isinstance(df.columns, pd.MultiIndex):
        level0 = df.columns.get_level_values(0)
        if ticker in set(level0):
            df = df[ticker]
        elif df.columns.nlevels > 1 and ticker in set(df.columns.get_level_values(1)):
            df = df.xs(ticker, level=1, axis=1)
    required = {"Open", "High", "Low", "Close"}
    if not required.issubset(df.columns):
        return pd.DataFrame()
    if "Volume" in df.columns:
        df = df.copy()
        df["Volume"] = df["Volume"].fillna(0.0)
    return df.dropna(subset=["Open", "High", "Low", "Close"])


class YahooFinanceProvider:
    """Yahoo Finance implementation (no API key). Data: latest available / delayed."""

    name = PROVIDER_NAME

    HISTORY_TTL_INTRADAY = 120.0     # seconds — market-open bars change constantly
    HISTORY_TTL_DAILY = 1800.0
    INFO_TTL = 3600.0

    def history(self, ticker: str, period: str, interval: str) -> pd.DataFrame:
        intraday = interval not in ("1d", "1wk", "1mo")
        ttl = self.HISTORY_TTL_INTRADAY if intraday else self.HISTORY_TTL_DAILY

        def _fetch() -> pd.DataFrame:
            try:
                raw = yf.download(
                    ticker,
                    period=period,
                    interval=interval,
                    auto_adjust=True,
                    progress=False,
                    group_by="ticker",
                    threads=True,
                )
            except Exception as exc:  # network/parse failure — surface as 502
                raise DataProviderError(f"History download failed for {ticker}: {exc}") from exc
            return _normalise_frame(raw, ticker)

        df = cache.cached(("hist", ticker, period, interval), ttl, _fetch)
        if df is None or df.empty:
            raise DataProviderError(f"No historical data available for {ticker}")
        return df

    def batch_history(
        self, tickers: list[str], period: str, interval: str
    ) -> dict[str, pd.DataFrame]:
        ttl = (
            self.HISTORY_TTL_INTRADAY
            if interval not in ("1d", "1wk", "1mo")
            else self.HISTORY_TTL_DAILY
        )
        key = ("batch", tuple(tickers), period, interval)

        def _fetch() -> dict[str, pd.DataFrame]:
            try:
                raw = yf.download(
                    tickers,
                    period=period,
                    interval=interval,
                    auto_adjust=True,
                    progress=False,
                    group_by="ticker",
                    threads=True,
                )
            except Exception as exc:
                raise DataProviderError(f"Batch download failed: {exc}") from exc
            return {
                t: frame
                for t in tickers
                if not (frame := _normalise_frame(raw, t)).empty
            }

        return cache.cached(key, ttl, _fetch)

    def info(self, ticker: str) -> dict:
        def _fetch() -> dict:
            try:
                data = yf.Ticker(ticker).info
                return dict(data) if isinstance(data, dict) else {}
            except Exception:
                # Fundamentals are optional: degrade to nulls, never fake numbers.
                return {}

        return cache.cached(("info", ticker), self.INFO_TTL, _fetch)


_provider: Optional[MarketDataProvider] = None


def get_provider() -> MarketDataProvider:
    """Provider factory — swap implementations here (env-driven later if needed)."""
    global _provider
    if _provider is None:
        if os.getenv("MARKET_DATA_PROVIDER", "yahoo").lower() != "yahoo":
            raise DataProviderError("Unsupported MARKET_DATA_PROVIDER")
        _provider = YahooFinanceProvider()
    return _provider


# ---------------------------------------------------------------------------
# Helpers shared by services
# ---------------------------------------------------------------------------

def quote_from_history(df: pd.DataFrame) -> tuple[float, float, float, str]:
    """
    Derive (price, change, change_percent, timestamp_iso) from OHLCV bars.

    price = latest available close (latest intraday close while market is open,
    otherwise the most recent session close). change = price - previous close.
    """
    closes = df["Close"].dropna()
    if len(closes) < 2:
        raise DataProviderError("Not enough bars to compute a quote")
    price = float(closes.iloc[-1])
    prev = float(closes.iloc[-2])
    change = price - prev
    change_pct = (change / prev * 100.0) if prev else 0.0
    ts = df.index[-1]
    if isinstance(ts, pd.Timestamp):
        ts_utc = ts.tz_localize("UTC") if ts.tz is None else ts.tz_convert("UTC")
        iso = ts_utc.isoformat()
    else:
        iso = pd.Timestamp(ts).isoformat()
    return price, change, change_pct, iso


def fetch_many_info(tickers: list[str], max_workers: int = 8) -> dict[str, dict]:
    """Fetch fundamental info for several tickers concurrently (cached per ticker)."""
    provider = get_provider()
    out: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(provider.info, t): t for t in tickers}
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                out[t] = fut.result()
            except Exception:
                out[t] = {}
    return out


def to_iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).isoformat()
