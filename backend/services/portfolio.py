"""Portfolio calculation service.

Multi-currency rules (portfolio base currency = INR):

  invested (cost basis) = qty x stored INR cost basis per share
                          (captured with the FX rate at execution time —
                           historical cost is NEVER revalued with today's rate;
                           legacy rows without a stored basis keep the old
                           meaning of avg_cost, i.e. INR as-is)
  value                 = qty x native price x current FX rate   (foreign asset)
                          qty x native price                      (INR asset)
  day change            = qty x native change x current FX rate   (same rule)

Quantities and average costs are *user inputs*; prices, FX rates and all
derived values come from the same market-data layer every other page uses —
one source of truth for prices across Artha. FX is latest-available Yahoo data
(may be delayed), like everything else; nothing here is labelled real-time.
"""

from __future__ import annotations

from models.schemas import (
    HoldingIn,
    HoldingValuation,
    PortfolioTotals,
    PortfolioValuation,
)
from utils import cache

from .market_data import PROVIDER_NAME

# Valuation reuses the light quote cache; 30s keeps portfolio refresh inside
# the frontend's polling window without re-downloading anything heavy.
HOLDINGS_TTL = 30.0


def value_portfolio(holdings: list[HoldingIn]) -> PortfolioValuation:
    """
    INR valuation of every holding at the latest available market prices.

    Holdings whose quote (or, for foreign assets, the FX rate) cannot be
    fetched are returned with available=False and null values (shown as N/A)
    instead of being silently dropped, estimated, or converted with a
    fabricated rate.
    """
    def _compute() -> PortfolioValuation:
        # Imported lazily to avoid a circular import at module load.
        from .quotes import get_quotes
        from .universe import get_universe_snapshots

        # Metadata only (name/sector/country) — never a hard dependency.
        try:
            snapshots = get_universe_snapshots()
        except Exception:
            snapshots = {}

        # Latest quotes for the held symbols (light path, one batched fetch).
        requested = list(dict.fromkeys(h.symbol for h in holdings))
        quote_rows = get_quotes(requested)
        quote_by_symbol = dict(zip(requested, quote_rows))

        rows: list[HoldingValuation] = []
        value_total = 0.0
        day_change_total = 0.0
        day_change_known = False
        last_ts = ""

        for h in holdings:
            q = quote_by_symbol.get(h.symbol)
            sym = h.symbol.upper()
            snap = snapshots.get(sym) or snapshots.get((q or {}).get("symbol") or "")

            currency = (q or {}).get("currency") or (snap or {}).get("currency") or "INR"
            fx = 1.0 if currency == "INR" else (q or {}).get("fx_rate")
            name = (q or {}).get("name") or (snap or {}).get("name") or sym
            sector = (q or {}).get("sector") or (snap or {}).get("sector") or "Other"
            country = (q or {}).get("country") or (snap or {}).get("country") or "IN"

            # INR cost basis per share. The stored value (captured with the FX
            # rate at execution) always wins — historical cost is NEVER
            # re-converted with today's rate. Legacy rows have no stored basis:
            # INR assets keep the stored figure (the old, unchanged meaning);
            # a legacy FOREIGN asset — whose face value used to be mislabelled
            # as ₹ — is converted at the current rate as a documented
            # approximation, since no rate was ever recorded for it.
            if h.avg_cost_inr is not None and h.avg_cost_inr > 0:
                cost_inr_ps = h.avg_cost_inr
            elif currency != "INR":
                cost_inr_ps = h.avg_cost * (fx if fx else 1.0)
            else:
                cost_inr_ps = h.avg_cost
            invested = h.qty * cost_inr_ps

            # Price: fresh quote first, universe snapshot as a fallback.
            price = (q or {}).get("price")
            if price is None and snap:
                price = snap.get("price")
            change = (q or {}).get("change")
            if change is None and snap:
                change = snap.get("change")
            change_pct = (q or {}).get("change_percent")
            if change_pct is None and snap:
                change_pct = snap.get("change_percent")
            ts = (q or {}).get("timestamp") or (snap or {}).get("timestamp")

            convertible = currency == "INR" or fx is not None

            if price is None or not convertible:
                # Unpriced (or unconvertible) -> N/A row, never an estimate.
                rows.append(
                    HoldingValuation(
                        symbol=sym,
                        name=name,
                        sector=sector,
                        country=country,
                        currency=currency,
                        qty=h.qty,
                        avg_cost=h.avg_cost,
                        avg_cost_inr=round(cost_inr_ps, 4),
                        invested=round(invested, 2),
                        fx_rate=fx,
                        unrealized_pnl=None,  # unpriced -> P&L unknown, never estimated
                        available=False,
                    )
                )
                continue

            ltp = float(price)
            value = h.qty * ltp * fx
            value_total += value
            if change is not None:
                day_change_total += h.qty * float(change) * fx
                day_change_known = True
            if ts:
                last_ts = max(last_ts, ts)
            rows.append(
                HoldingValuation(
                    symbol=sym,
                    name=name,
                    sector=sector,
                    country=country,
                    currency=currency,
                    qty=h.qty,
                    avg_cost=h.avg_cost,
                    avg_cost_inr=round(cost_inr_ps, 4),
                    invested=round(invested, 2),
                    ltp=round(ltp, 2),
                    fx_rate=round(fx, 6),
                    day_change=round(h.qty * float(change) * fx, 2) if change is not None else None,
                    day_change_percent=round(change_pct, 3) if change_pct is not None else None,
                    value=round(value, 2),
                    unrealized_pnl=round(value - invested, 2),
                    return_percent=round((value - invested) / invested * 100.0, 2)
                    if invested
                    else 0.0,
                    available=True,
                )
            )

        # Totals cover only holdings we could price, so invested and value stay
        # on the same basis (unavailable rows are listed but excluded here).
        invested_priced = sum(r.invested for r in rows if r.available)
        pnl = value_total - invested_priced
        # Weight = share of the *valued* equity; unavailable rows get 0.
        for r in rows:
            if r.available and r.value and value_total:
                r.weight_percent = round(r.value / value_total * 100.0, 2)

        totals = PortfolioTotals(
            invested=round(invested_priced, 2),
            value=round(value_total, 2),
            day_change=round(day_change_total, 2) if day_change_known else 0.0,
            unrealized_pnl=round(pnl, 2),
            return_percent=round(pnl / invested_priced * 100.0, 2) if invested_priced else 0.0,
        )

        return PortfolioValuation(
            holdings=rows,
            totals=totals,
            timestamp=last_ts,
            source=PROVIDER_NAME,
        )

    return cache.cached(
        (
            "portfolio",
            tuple(
                (h.symbol, h.qty, h.avg_cost, h.currency, h.avg_cost_inr)
                for h in holdings
            ),
        ),
        HOLDINGS_TTL,
        _compute,
    )
