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

# Reverse lookup: provider ticker -> registry entry (identity metadata, no market data).
_REGISTRY_BY_TICKER: dict[str, tuple[str, dict[str, Any]]] = {
    e["ticker"]: (sym, e) for sym, e in SYMBOL_REGISTRY.items()
}

# ---------------------------------------------------------------------------
# Venue identity
# ---------------------------------------------------------------------------
# Yahoo's search payload carries no currency field, so identity (country /
# currency) is derived from the listing venue. This is *metadata*, never a
# price — and it replaces the old "unknown symbol must be NSE" assumption.

# Yahoo exchange codes + human display names -> (country, currency)
EXCHANGE_VENUE: dict[str, tuple[str, str]] = {
    # India
    "NSI": ("IN", "INR"), "NSE": ("IN", "INR"), "National Stock Exchange of India": ("IN", "INR"),
    "BSE": ("IN", "INR"), "Bombay": ("IN", "INR"),
    # United States
    "NMS": ("US", "USD"), "NGM": ("US", "USD"), "NCM": ("US", "USD"), "NBX": ("US", "USD"),
    "NYQ": ("US", "USD"), "ASE": ("US", "USD"),
    "PCB": ("US", "USD"), "BTS": ("US", "USD"), "CBOE": ("US", "USD"), "OTC": ("US", "USD"),
    "NASDAQ": ("US", "USD"), "NYSE": ("US", "USD"), "NYSE American": ("US", "USD"),
    "NYSEArca": ("US", "USD"), "OTC Markets": ("US", "USD"),
    # Rest of the world (common Yahoo venues)
    "TOR": ("CA", "CAD"), "VAN": ("CA", "CAD"), "Toronto": ("CA", "CAD"),
    "LON": ("GB", "GBP"), "London": ("GB", "GBP"),
    "FRA": ("DE", "EUR"), "Frankfurt": ("DE", "EUR"), "ETR": ("DE", "EUR"), "XETRA": ("DE", "EUR"),
    "PAR": ("FR", "EUR"), "Paris": ("FR", "EUR"),
    "AMS": ("NL", "EUR"), "Amsterdam": ("NL", "EUR"),
    "EPA": ("FR", "EUR"), "ENX": ("NL", "EUR"),
    "SWX": ("CH", "CHF"), "Swiss": ("CH", "CHF"),
    "TSE": ("JP", "JPY"), "Tokyo": ("JP", "JPY"),
    "HKG": ("HK", "HKD"), "Hong Kong": ("HK", "HKD"),
    "SHH": ("CN", "CNY"), "SHZ": ("CN", "CNY"), "Shanghai": ("CN", "CNY"), "Shenzhen": ("CN", "CNY"),
    "KSC": ("KR", "KRW"), "Korea": ("KR", "KRW"),
    "TWO": ("TW", "TWD"), "Taiwan": ("TW", "TWD"),
    "SES": ("SG", "SGD"), "Singapore": ("SG", "SGD"),
    "ASX": ("AU", "AUD"), "Australia": ("AU", "AUD"),
    "SAO": ("BR", "BRL"), "Sao Paulo": ("BR", "BRL"),
}

# Yahoo exchange codes -> venue name shown in the UI.
EXCHANGE_DISPLAY: dict[str, str] = {
    "NMS": "NASDAQ", "NGM": "NASDAQ", "NCM": "NASDAQ", "NBX": "NASDAQ",
    "NYQ": "NYSE", "ASE": "NYSE American", "PCB": "NYSE", "BTS": "BATS",
    "CBOE": "CBOE", "OTC": "OTC",
    "NSI": "NSE", "BSE": "BSE",
    "TOR": "Toronto", "VAN": "Toronto", "LON": "London", "FRA": "Frankfurt",
    "ETR": "XETRA", "PAR": "Paris", "AMS": "Amsterdam", "SWX": "SIX",
    "TSE": "Tokyo", "HKG": "Hong Kong", "SHH": "Shanghai", "SHZ": "Shenzhen",
    "KSC": "Korea", "TWO": "Taiwan", "SES": "Singapore", "ASX": "ASX", "SAO": "Sao Paulo",
}

# Ticker-suffix -> (country, currency, exchange) — e.g. RELIANCE.NS, SAP.DE, 7203.T
SUFFIX_VENUE: dict[str, tuple[str, str, str]] = {
    ".NS": ("IN", "INR", "NSE"),
    ".BO": ("IN", "INR", "BSE"),
    ".TO": ("CA", "CAD", "Toronto"),
    ".V": ("CA", "CAD", "Toronto"),
    ".L": ("GB", "GBP", "London"),
    ".DE": ("DE", "EUR", "XETRA"),
    ".F": ("DE", "EUR", "Frankfurt"),
    ".PA": ("FR", "EUR", "Paris"),
    ".AS": ("NL", "EUR", "Amsterdam"),
    ".MI": ("IT", "EUR", "Milan"),
    ".SW": ("CH", "CHF", "SIX"),
    ".T": ("JP", "JPY", "Tokyo"),
    ".HK": ("HK", "HKD", "Hong Kong"),
    ".SS": ("CN", "CNY", "Shanghai"),
    ".SZ": ("CN", "CNY", "Shenzhen"),
    ".KS": ("KR", "KRW", "Korea"),
    ".TW": ("TW", "TWD", "Taiwan"),
    ".SI": ("SG", "SGD", "Singapore"),
    ".AX": ("AU", "AUD", "ASX"),
    ".SA": ("BR", "BRL", "Sao Paulo"),
    ".MX": ("MX", "MXN", "Mexico"),
    ".IJ": ("ID", "IDR", "Jakarta"),
    ".KL": ("MY", "MYR", "Kuala Lumpur"),
}


def venue_for_ticker(ticker: str) -> Optional[tuple[str, str, str]]:
    """(country, currency, exchange) implied by a Yahoo ticker's suffix."""
    t = (ticker or "").upper()
    if t.endswith(".NS") or t.endswith(".BO"):
        return SUFFIX_VENUE[t[-3:]]
    dot = t.rfind(".")
    if dot > 0 and len(t) - dot <= 4:
        hit = SUFFIX_VENUE.get(t[dot:])
        if hit:
            return hit
    return None


def venue_for_exchange(exchange_code: str, display: Optional[str] = None) -> Optional[tuple[str, str]]:
    """(country, currency) for a Yahoo exchange code or display name."""
    for probe in (display, exchange_code):
        if not probe:
            continue
        hit = EXCHANGE_VENUE.get(str(probe)) or EXCHANGE_VENUE.get(str(probe).split("-")[0])
        if hit:
            return hit
    return None

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

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """Raw provider search hits for a free-text company query."""
        ...

    def quotes(self, tickers: list[str]) -> dict[str, dict]:
        """Light latest-quotes (price/change) for several tickers."""
        ...


def resolve_symbol(symbol: str) -> dict[str, Any]:
    """
    Resolve a user-facing symbol to a provider ticker + identity metadata.

    Order (first hit wins):
      1. the static registry (fast, offline — preserved as a metadata cache),
      2. index registry ("NIFTY 50", "^NSEI"),
      3. explicit provider syntax (RELIANCE.NS, BRK-B? no — see below),
         e.g. ``RELIANCE.NS``, ``SAP.DE``, ``^NSEI``, ``USDINR=X``,
      4. **dynamic provider search** — an unknown alphabetic symbol is looked
         up with Yahoo search instead of being assumed to be an NSE ticker,
      5. the legacy NSE guess ONLY when the search call itself failed
         (provider/network trouble), so existing flows keep working.

    A symbol the provider cannot identify raises ``SymbolNotFoundError`` —
    never a fabricated currency/exchange.
    """
    key = (symbol or "").strip().upper()
    if not key:
        raise SymbolNotFoundError("Unknown symbol: (empty)")

    # 1. Static registry — metadata cache, still the fastest path.
    if key in SYMBOL_REGISTRY:
        return {"symbol": key, **SYMBOL_REGISTRY[key]}

    # 2. Index registry (display symbol or index ticker).
    idx = _index_entry(key)
    if idx is not None:
        return idx

    # 3. Explicit provider tickers: anything with an exchange suffix, an index
    #    caret or an FX pair passes through untouched (RELIANCE.NS, 7203.T, …).
    if key.startswith("^") or "." in key or "=" in key:
        return _entry_for_ticker(key)

    # 4. Dynamic resolution via provider search — no "must be Indian" assumption.
    try:
        matches = search_instruments(key, limit=10)
    except DataProviderError:
        matches = None  # search itself failed -> fall through to legacy guess

    if matches is not None:
        best = _pick_match(key, matches)
        if best is None:
            raise SymbolNotFoundError(f"No matching company found for '{symbol}'")
        return {
            "symbol": best["symbol"],
            "ticker": best["ticker"],
            "exchange": best["exchange"],
            "currency": best["currency"],
            "country": best["country"],
            "name": best["name"],
        }

    # 5. Legacy fallback (Artha was NSE-first) — only if search was unavailable.
    if key.isalpha() and 1 <= len(key) <= 15:
        return {
            "symbol": key,
            "ticker": f"{key}.NS",
            "exchange": "NSE",
            "currency": "INR",
            "country": "IN",
            "name": key,
        }
    raise SymbolNotFoundError(f"Unknown symbol: {symbol}")


def _index_entry(key: str) -> Optional[dict[str, Any]]:
    """Registry entry for a Markets-page index (by display symbol or ticker)."""
    for e in INDEX_REGISTRY:
        if key == e["symbol"].upper() or key == e["ticker"].upper():
            return {
                "symbol": e["symbol"],
                "ticker": e["ticker"],
                "exchange": e["exchange"],
                "currency": e["currency"],
                "country": "IN" if e["currency"] == "INR" else "US",
                "name": e["name"],
            }
    return None


def _entry_for_ticker(ticker: str) -> dict[str, Any]:
    """Identity for an explicit provider ticker (offline where possible)."""
    hit = _REGISTRY_BY_TICKER.get(ticker)
    if hit:
        return {"symbol": hit[0], **hit[1]}

    idx = _index_entry(ticker)
    if idx:
        return idx

    base = ticker.split(".")[0]
    if "=" in ticker:
        # FX pair: the price is quoted in the SECOND currency (USDINR=X -> INR).
        pair = ticker.split("=")[0]
        quote_ccy = pair[-3:]
        currency = quote_ccy if quote_ccy.isalpha() and len(quote_ccy) == 3 else "USD"
        return {
            "symbol": base,
            "ticker": ticker,
            "exchange": "FX",
            "currency": currency,
            "country": "IN" if currency == "INR" else "US",
            "name": base,
        }

    venue = venue_for_ticker(ticker)
    if venue:
        country, currency, exchange = venue
        return {
            "symbol": base,
            "ticker": ticker,
            "exchange": exchange,
            "currency": currency,
            "country": country,
            "name": base,
        }

    # Unknown suffix: ask the provider for the instrument's real identity.
    info = describe(ticker)
    if info.get("currency"):
        return {
            "symbol": base,
            "ticker": ticker,
            "exchange": info.get("exchange") or "OTHER",
            "currency": info["currency"],
            "country": info.get("country") or ("US" if info["currency"] == "USD" else "--"),
            "name": info.get("name") or base,
        }
    raise SymbolNotFoundError(f"Unknown symbol: {ticker}")


# ---------------------------------------------------------------------------
# Universal stock search — dynamic, provider-backed (no hardcoded universe)
# ---------------------------------------------------------------------------
SEARCH_TTL = 600.0    # seconds — per-query search cache
QUOTE_TTL = 30.0      # seconds — light quote fetch freshness
DESCRIBE_TTL = 3600.0 # seconds — identity metadata (currency/exchange/name)

# Only genuine listed instruments are offered to users (no futures, no FX,
# no crypto — out of scope for Artha's equity search).
_SEARCHABLE_TYPES = {"EQUITY", "ETF"}


def canonical_symbol(ticker: str, query: str = "") -> str:
    """Display symbol for a provider ticker: registry key if known, else the
    ticker without a recognised exchange suffix (RELIANCE.NS -> RELIANCE)."""
    hit = _REGISTRY_BY_TICKER.get(ticker)
    if hit:
        return hit[0]
    t = ticker.upper()
    if venue_for_ticker(t):
        base = t.rsplit(".", 1)[0]
        if base:
            return base
    return query.strip().upper() or ticker


def search_instruments(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search publicly traded companies via the existing provider abstraction.

    Returns entries with: symbol (display), ticker (provider), name, exchange,
    country, currency. Registry entries are preferred as a metadata cache, but
    ANY listed company can be found — the registry is never a filter.
    An empty list means "no matching company found".
    """
    q = (query or "").strip()
    if not q:
        return []

    def _fetch() -> list[dict[str, Any]]:
        try:
            raw = get_provider().search(q, limit=max(limit * 3, 12))
        except DataProviderError:
            raise
        except Exception as exc:  # provider/network failure -> 502 via handler
            raise DataProviderError(f"Stock search failed: {exc}") from exc

        out: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in raw or []:
            ticker = str(item.get("symbol") or "").upper()
            qtype = str(item.get("quoteType") or "").upper()
            if not ticker or ticker in seen or qtype not in _SEARCHABLE_TYPES:
                continue
            seen.add(ticker)

            name = item.get("longname") or item.get("shortname") or ticker
            exchange = (
                item.get("exchDisp")
                or EXCHANGE_DISPLAY.get(str(item.get("exchange") or ""))
                or str(item.get("exchange") or "OTHER")
            )
            country_currency = venue_for_exchange(str(item.get("exchange") or ""), item.get("exchDisp"))
            suffix_venue = venue_for_ticker(ticker)
            if suffix_venue:
                country, currency = suffix_venue[0], suffix_venue[1]
            elif country_currency:
                country, currency = country_currency
            else:
                # Registry hit -> trusted metadata; otherwise assume nothing.
                reg = _REGISTRY_BY_TICKER.get(ticker)
                if not reg:
                    continue  # identity unknown -> not offered (never guessed)
                country, currency = reg[1]["country"], reg[1]["currency"]

            symbol = canonical_symbol(ticker)
            reg_entry = SYMBOL_REGISTRY.get(symbol)
            if reg_entry and reg_entry["ticker"] != ticker:
                # Alternate listing (ADR / cross-list) of a known symbol, e.g.
                # the NYSE INFY ADR vs registry INFY.NS. Navigation resolves by
                # display symbol, so offering it would silently show a
                # different instrument than the user clicked — skip it.
                continue
            if reg_entry:
                exchange = reg_entry["exchange"]
                name = reg_entry["name"]

            out.append(
                {
                    "symbol": symbol,
                    "ticker": ticker,
                    "name": name,
                    "exchange": exchange,
                    "country": country,
                    "currency": currency,
                    "quote_type": qtype,
                }
            )
            if len(out) >= limit:
                break

        # Known universe members always resolve to their registry entry first.
        key = q.upper()
        if key in SYMBOL_REGISTRY:
            e = SYMBOL_REGISTRY[key]
            entry = {
                "symbol": key,
                "ticker": e["ticker"],
                "name": e["name"],
                "exchange": e["exchange"],
                "country": e["country"],
                "currency": e["currency"],
                "quote_type": "EQUITY",
            }
            out = [entry] + [m for m in out if m["ticker"] != e["ticker"]]
            out = out[:limit]
        return out

    return cache.cached(("search", q.lower(), limit), SEARCH_TTL, _fetch)


def _pick_match(query: str, matches: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Confidence-ranked pick so fuzzy Yahoo results don't hijack a symbol."""
    import re

    needle = query.strip().upper()
    if not matches:
        return None
    for m in matches:  # exact ticker or display symbol
        if m["ticker"] == needle or m["symbol"] == needle:
            return m
    for m in matches:  # symbol starts with what the user typed (DMART -> DMART.NS)
        if m["symbol"].startswith(needle) or m["ticker"].startswith(needle):
            return m
    pattern = re.compile(rf"\b{re.escape(needle)}\b", re.IGNORECASE)
    for m in matches:  # company name contains the query as a word (tesla -> Tesla, Inc.)
        if pattern.search(m["name"] or ""):
            return m
    return None


# ---------------------------------------------------------------------------
# Instrument identity (currency/exchange/name) for arbitrary tickers
# ---------------------------------------------------------------------------
def describe(ticker: str) -> dict[str, Any]:
    """
    Identity metadata for one provider ticker: name, exchange, country,
    currency, sector. Registry first (no network), then provider info
    (cached per ticker), then venue heuristics. Never invents a currency.
    """
    hit = _REGISTRY_BY_TICKER.get(ticker.upper())
    if hit:
        sym, e = hit
        return {
            "symbol": sym,
            "ticker": e["ticker"],
            "name": e["name"],
            "exchange": e["exchange"],
            "country": e["country"],
            "currency": e["currency"],
            "sector": None,
        }

    def _fetch() -> dict[str, Any]:
        info = get_provider().info(ticker) or {}
        venue = venue_for_ticker(ticker)
        exchange_code = str(info.get("exchange") or "")
        exchange_disp = info.get("fullExchangeName") or EXCHANGE_DISPLAY.get(exchange_code)
        cc = venue_for_exchange(exchange_code, exchange_disp)
        if venue:
            country, currency, exchange = venue[0], venue[1], venue[2]
        elif info.get("currency"):
            currency = str(info["currency"])
            country = (cc[0] if cc else None) or ("US" if currency == "USD" else "IN" if currency == "INR" else "--")
            exchange = exchange_disp or exchange_code or "OTHER"
        elif cc:
            country, currency = cc
            exchange = exchange_disp or exchange_code or "OTHER"
        else:
            # Identity cannot be confirmed -> no currency (caller decides).
            return {
                "symbol": canonical_symbol(ticker),
                "ticker": ticker,
                "name": info.get("longName") or info.get("shortName") or ticker,
                "exchange": exchange_disp or exchange_code or "OTHER",
                "country": "--",
                "currency": None,
                "sector": info.get("sector"),
            }
        return {
            "symbol": canonical_symbol(ticker),
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName") or canonical_symbol(ticker),
            "exchange": exchange,
            "country": country,
            "currency": currency,
            "sector": info.get("sector"),
        }

    return cache.cached(("describe", ticker.upper()), DESCRIBE_TTL, _fetch)


def describe_many(tickers: list[str]) -> dict[str, dict[str, Any]]:
    """Concurrent describe() for several tickers (registry hits are instant)."""
    out: dict[str, dict[str, Any]] = {}
    missing = [t for t in dict.fromkeys(tickers) if t.upper() not in _REGISTRY_BY_TICKER]
    for t in dict.fromkeys(tickers):
        if t.upper() in _REGISTRY_BY_TICKER:
            out[t] = describe(t)
    if not missing:
        return out
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(describe, t): t for t in missing}
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                out[t] = fut.result()
            except Exception:
                out[t] = {"symbol": canonical_symbol(t), "ticker": t, "name": t,
                          "exchange": "OTHER", "country": "--", "currency": None, "sector": None}
    return out


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

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """Free-text company search (raw provider hits; mapping happens above)."""

        def _fetch() -> list[dict]:
            try:
                res = yf.Search(
                    query,
                    max_results=limit,
                    news_count=0,
                    lists_count=0,
                    include_cb=False,
                    raise_errors=True,
                )
            except Exception as exc:
                # A real provider/network failure must surface as an error so
                # callers can distinguish it from a genuine "no match".
                raise DataProviderError(f"Symbol search failed: {exc}") from exc
            quotes = getattr(res, "quotes", None)
            return list(quotes) if isinstance(quotes, list) else []

        return cache.cached(("psearch", query.strip().lower(), limit), SEARCH_TTL, _fetch)

    def quotes(self, tickers: list[str]) -> dict[str, dict]:
        """
        Light latest-quotes for several tickers from ONE small download
        (5 days of daily bars — includes the current session's bar while the
        market is open). Deliberately separate from `history()` so quote
        refreshes never re-fetch the long ranges the research chart uses.
        """
        if not tickers:
            return {}
        ordered = list(dict.fromkeys(tickers))
        key = ("quotes", tuple(sorted(ordered)))

        def _fetch() -> dict[str, dict]:
            try:
                raw = yf.download(
                    ordered,
                    period="5d",
                    interval="1d",
                    auto_adjust=True,
                    progress=False,
                    group_by="ticker",
                    threads=True,
                )
            except Exception as exc:
                raise DataProviderError(f"Quote download failed: {exc}") from exc

            out: dict[str, dict] = {}
            for t in ordered:
                df = _normalise_frame(raw, t)
                if df is None or df.empty:
                    continue
                closes = df["Close"].dropna()
                if closes.empty:
                    continue
                price = float(closes.iloc[-1])
                prev = float(closes.iloc[-2]) if len(closes) >= 2 else None
                change = (price - prev) if prev else None
                change_pct = (change / prev * 100.0) if (change is not None and prev) else None
                ts = df.index[-1]
                if isinstance(ts, pd.Timestamp):
                    ts_utc = ts.tz_localize("UTC") if ts.tz is None else ts.tz_convert("UTC")
                    iso = ts_utc.isoformat()
                else:
                    iso = pd.Timestamp(ts).isoformat()
                out[t] = {
                    "price": price,
                    "change": change,
                    "change_percent": change_pct,
                    "timestamp": iso,
                }
            return out

        return cache.cached(key, QUOTE_TTL, _fetch)


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
