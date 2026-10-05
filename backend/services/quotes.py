"""
Latest-quote service — one place that assembles a "current price" payload for
ANY tradable symbol (registry or dynamically discovered).

Used by:
  - GET /api/stocks/quotes and GET /api/stocks/{symbol}/quote (frontend polling)
  - the virtual portfolio's order execution (routes_account)
  - portfolio valuation (services.portfolio)

Prices come from the provider's LIGHT quote path (5 days of daily bars, cached
for QUOTE_TTL seconds) — never from the 1y history the research chart uses, so
refreshing quotes never re-fetches historical/fundamental/technical data.

Every payload carries:
  - native price + native currency,
  - fx_rate: current INR rate for that currency (1.0 for INR, null when the
    FX provider is unavailable — never a guessed rate),
  - provider timestamp (latest available bar time) + source.

Data is "latest available" (may be delayed) — exactly what the UI must say.
"""

from __future__ import annotations

from typing import Any, Optional

from . import fx as fx_service
from . import market_data as md

SOURCE = md.PROVIDER_NAME


def _fx_rate(currency: str) -> Optional[float]:
    """Current INR rate for a currency, or None when it cannot be fetched."""
    try:
        return fx_service.get_rate(currency, "INR")
    except Exception:
        return None


def _empty(symbol: str, error: str) -> dict[str, Any]:
    return {
        "symbol": symbol,
        "ticker": "",
        "name": symbol,
        "exchange": "OTHER",
        "country": "--",
        "currency": "INR",
        "sector": None,
        "price": None,
        "change": None,
        "change_percent": None,
        "timestamp": None,
        "fx_rate": None,
        "available": False,
        "source": SOURCE,
        "error": error,
    }


def get_quotes(symbols: list[str]) -> list[dict[str, Any]]:
    """
    Latest quotes for several requested symbols. Never raises for a single
    bad symbol — that symbol comes back `available: false` with an error
    string the UI can show (e.g. "No matching company found").
    """
    requested = [s.strip() for s in symbols if s and s.strip()]
    if not requested:
        return []

    resolved: dict[str, dict[str, Any]] = {}   # requested -> resolution entry
    for sym in dict.fromkeys(requested):
        try:
            resolved[sym] = md.resolve_symbol(sym)
        except md.SymbolNotFoundError as exc:
            resolved[sym] = exc  # mark as unresolvable

    ok_entries = {k: v for k, v in resolved.items() if isinstance(v, dict)}
    tickers = list({e["ticker"] for e in ok_entries.values()})

    # Light price fetch (single batched download, cached QUOTE_TTL).
    prices: dict[str, dict] = {}
    price_error: Optional[str] = None
    if tickers:
        try:
            prices = md.get_provider().quotes(tickers)
        except md.DataProviderError as exc:
            price_error = str(exc)

    # Identity metadata (registry = instant, others = provider info, cached).
    meta: dict[str, dict] = {}
    if tickers:
        try:
            meta = md.describe_many(tickers)
        except Exception:
            meta = {}

    # FX rates for the distinct currencies involved (1.0 for INR, offline).
    currencies: set[str] = set()
    for e in ok_entries.values():
        ccy = (meta.get(e["ticker"]) or {}).get("currency") or e.get("currency") or "INR"
        currencies.add(ccy)
    fx_by_currency: dict[str, Optional[float]] = {
        ccy: (1.0 if ccy == "INR" else _fx_rate(ccy)) for ccy in currencies
    }

    out: list[dict[str, Any]] = []
    for sym in dict.fromkeys(requested):
        entry = resolved.get(sym)
        if not isinstance(entry, dict):
            message = str(entry.args[0] if entry and entry.args else entry)
            out.append(_empty(sym, message))
            continue

        ticker = entry["ticker"]
        info = meta.get(ticker) or {}
        currency = info.get("currency") or entry.get("currency") or "INR"
        quote = prices.get(ticker) or {}
        price = quote.get("price")
        fx_rate = fx_by_currency.get(currency)
        if fx_rate is None and currency != "INR":
            fx_rate = _fx_rate(currency)  # retried once per request, never guessed

        out.append(
            {
                "symbol": entry.get("symbol") or sym,
                "ticker": ticker,
                "name": info.get("name") or entry.get("name") or ticker,
                "exchange": info.get("exchange") or entry.get("exchange") or "OTHER",
                "country": info.get("country") or entry.get("country") or "--",
                "currency": currency,
                "sector": info.get("sector"),
                "price": price,
                "change": quote.get("change"),
                "change_percent": quote.get("change_percent"),
                "timestamp": quote.get("timestamp"),
                "fx_rate": fx_rate if currency != "INR" else 1.0,
                "available": price is not None,
                "source": SOURCE,
                "error": price_error
                or (None if price is not None else f"No market data for '{sym}' right now."),
            }
        )
    return out


def get_quote(symbol: str) -> dict[str, Any]:
    """
    Single-symbol quote that raises clean errors for the HTTP layer:
      - SymbolNotFoundError -> 404 "No matching company found …"
      - DataProviderError   -> 502 when the provider cannot price it
    """
    quote = get_quotes([symbol])[0]
    if quote["ticker"] == "":
        # Could not even resolve the symbol -> 404 "no matching company".
        raise md.SymbolNotFoundError(quote["error"] or f"Unknown symbol: {symbol}")
    if not quote["available"]:
        message = quote["error"] or f"No market data for '{symbol}'"
        if message.startswith("No market data"):
            # Resolved but the provider has nothing to price it -> 404, the
            # same status the old universe-based lookup returned.
            raise md.SymbolNotFoundError(message)
        raise md.DataProviderError(message)  # provider failure -> 502
    return quote
