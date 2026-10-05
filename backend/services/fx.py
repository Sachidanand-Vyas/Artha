"""
Currency conversion for the multi-currency virtual portfolio.

Artha's portfolio base currency is INR. Every tradable instrument has a native
currency (Indian stocks: INR, US stocks: USD) and conversions go through this
module so there is exactly one place that decides a rate.

Rates come from the EXISTING market-data provider (Yahoo Finance FX tickers,
e.g. USDINR=X) — no new provider, no API key. The rate is "latest available"
(may be delayed), like every other number in Artha.

Design notes
------------
- INR -> INR is 1.0 and never touches the network, so INR-only portfolios
  behave exactly as before even if the FX provider is unreachable.
- Rates are cached for FX_TTL seconds (prices move slowly relative to trades).
- `_fetch_rate` is a module-level seam so tests can pin a rate without
  network access.
"""

from __future__ import annotations

from utils import cache

# Seconds an FX rate may be reused before re-querying the provider.
FX_TTL = 300.0

# Yahoo FX tickers for USD -> INR, in preference order.
USD_INR_TICKERS = ("USDINR=X", "INR=X")


class FxRateUnavailable(RuntimeError):
    """No rate could be obtained for a required currency pair."""


def _fetch_rate(ticker: str) -> float:
    """Latest available close of one FX ticker, via the existing provider."""
    from . import market_data as md  # imported late: market_data imports us nowhere

    provider = md.get_provider()
    last_error: Exception | None = None
    for candidate in (ticker, *(t for t in USD_INR_TICKERS if t != ticker)):
        try:
            df = provider.history(candidate, "5d", "1d")
            price, _chg, _pct, _iso = md.quote_from_history(df)
            if price and price > 0:
                return float(price)
        except Exception as exc:  # try the next ticker, then fail loudly
            last_error = exc
    raise FxRateUnavailable(
        f"FX rate for {ticker} is unavailable from the market-data provider"
        + (f": {last_error}" if last_error else "")
    )


def _usd_inr() -> float:
    return cache.cached(("fx", "USD", "INR"), FX_TTL, lambda: _fetch_rate(USD_INR_TICKERS[0]))


def get_rate(base: str, quote: str = "INR") -> float:
    """
    Units of `quote` per 1 unit of `base` (e.g. get_rate("USD") -> 95.80 means
    1 USD = ₹95.80).

    - Same currency -> 1.0, offline.
    - USD -> INR     -> Yahoo FX ticker (latest available, cached).
    - Anything else  -> raises FxRateUnavailable (never a guessed rate).
    """
    base = (base or "").strip().upper()
    quote = (quote or "INR").strip().upper()
    if base == quote:
        return 1.0
    if base == "USD" and quote == "INR":
        return _usd_inr()
    raise FxRateUnavailable(f"Unsupported currency pair {base}->{quote}")


def to_inr(amount: float, currency: str) -> float:
    """Convert `amount` of `currency` into INR at the current available rate."""
    return amount * get_rate(currency, "INR")
