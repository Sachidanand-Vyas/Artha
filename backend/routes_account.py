"""
Account + virtual-portfolio routes.

Wired into main.py. Everything user-specific (credentials, onboarding
preferences, virtual cash, holdings, transactions) lives in the local SQLite
database (see db.py); order execution prices come from the EXISTING market-data
layer (services.universe -> Yahoo Finance) so paper trades use the same real
prices as the rest of Artha.

Money is virtual. No broker, no real funds.
"""

from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from db import db, utcnow
from models.account import (
    AuthOut,
    LoginIn,
    OrderIn,
    PortfolioOut,
    PortfolioStartIn,
    PositionIn,
    PreferencesIn,
    SignupIn,
    TransactionOut,
    UserOut,
)
from models.schemas import HoldingIn
from services import auth
from services import fx as fx_service
from services import market_data as md
from services import quotes as quote_service
from services.portfolio import value_portfolio

router = APIRouter()

VIRTUAL_STARTING_CASH = 100_000.0  # ₹1,00,000 paper money

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def current_user(authorization: Optional[str] = Header(default=None)) -> object:
    """Resolve the bearer token to a user row, or 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated — please log in.")
    token = authorization.split(" ", 1)[1].strip()
    user = auth.get_user_for_token(token)
    if user is None:
        raise HTTPException(
            status_code=401, detail="Your session is invalid or has expired — please log in again."
        )
    return user


def _attach_token(user_row, token: str) -> AuthOut:
    return AuthOut(token=token, user=_user_out(user_row))


def _user_out(row) -> UserOut:
    return UserOut(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        country=row["country"],
        currency=row["currency"],
        onboarding_completed=bool(row["onboarding_completed"]),
        investment_goal=row["investment_goal"],
        monthly_range=row["monthly_range"],
        risk_profile=row["risk_profile"],
        experience=row["experience"],
        initial_preference=row["initial_preference"],
        pref_price_alerts=bool(row["pref_price_alerts"]),
        pref_daily_digest=bool(row["pref_daily_digest"]),
        pref_monthly_report=bool(row["pref_monthly_report"]),
        pref_product_updates=bool(row["pref_product_updates"]),
        created_at=row["created_at"],
    )


def _fetch_user(user_id: int):
    with db() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


# ---------------------------------------------------------------------------
# Multi-currency helpers
# ---------------------------------------------------------------------------
# Canonical display symbol for matching ("RELIANCE.NS" -> "RELIANCE").
# Memoised because identity resolution runs for every transaction during P&L
# replay; registry/explicit tickers resolve offline, only unknown names hit
# the provider search (itself cached for 10 minutes).
_ENTRY_MEMO: dict[str, Optional[dict]] = {}


def _entry_for(symbol: str) -> Optional[dict]:
    """Memoised resolve_symbol — None when the symbol cannot be identified."""
    key = (symbol or "").strip().upper()
    if not key:
        return None
    if key in _ENTRY_MEMO:
        return _ENTRY_MEMO[key]
    try:
        entry = md.resolve_symbol(key)
    except Exception:
        entry = None  # unresolvable -> callers keep the raw symbol
    _ENTRY_MEMO[key] = entry
    return entry


def _canonical_symbol(symbol: str) -> str:
    entry = _entry_for(symbol)
    if entry:
        return entry["symbol"]
    return (symbol or "").strip().upper()  # unresolvable -> keep the raw key


def _currency_of(symbol: str) -> str:
    entry = _entry_for(symbol)
    return (entry or {}).get("currency") or "INR"


def _current_rate_or_none(currency: str) -> Optional[float]:
    if currency == "INR":
        return 1.0
    try:
        return float(fx_service.get_rate(currency, "INR"))
    except Exception:
        return None  # legacy-row approximation is skipped when FX is unavailable


def _inr_amount(qty: float, native_price: float, symbol: str, stored) -> float:
    """
    INR value of one transaction row.

    New rows carry `amount_inr` (captured with the FX rate at execution).
    Legacy rows (NULL) fall back to qty × price — the old INR-only meaning —
    except for legacy FOREIGN-currency symbols, where the stored face value
    ($341 read as ₹341) is converted at the current rate as a documented
    one-time approximation (no rate was ever stored for those rows).
    """
    if stored is not None:
        return float(stored)
    amount = qty * native_price
    currency = _currency_of(symbol)
    if currency != "INR":
        rate = _current_rate_or_none(currency)
        if rate:
            amount *= rate
    return amount


_NATIVE_CCY_SYMBOL = {"INR": "₹", "USD": "$", "GBP": "£", "EUR": "€", "JPY": "¥"}


def _fmt_native(amount: float, currency: str) -> str:
    """"₹2,500.00" / "$341.00" / "341.00 GBP" — for user-facing messages."""
    sym = _NATIVE_CCY_SYMBOL.get(currency)
    return f"{sym}{amount:,.2f}" if sym else f"{amount:,.2f} {currency}"


def _merge_legacy_holding(
    conn,
    user_id: int,
    legacy_symbol: str,
    canonical: str,
    currency: str = "INR",
    fx_rate: float = 1.0,
) -> None:
    """
    Fold a pre-existing holding row stored under a non-canonical symbol
    (e.g. 'RELIANCE.NS') into the canonical row ('RELIANCE') so one
    instrument stays one position. Skipped when the two rows' currencies
    differ (a single average must never mix currencies); those rows are left
    alone and still valued independently.
    """
    if legacy_symbol == canonical:
        return
    legacy = conn.execute(
        "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
        (user_id, legacy_symbol),
    ).fetchone()
    if legacy is None:
        return
    current = conn.execute(
        "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
        (user_id, canonical),
    ).fetchone()
    legacy_keys = legacy.keys()
    legacy_ccy = legacy["currency"] if "currency" in legacy_keys else "INR"
    if current is None:
        conn.execute(
            "UPDATE holdings SET symbol = ? WHERE user_id = ? AND symbol = ?",
            (canonical, user_id, legacy_symbol),
        )
        return
    if (current["currency"] if "currency" in current.keys() else "INR") != legacy_ccy:
        return

    q0, a0 = float(current["quantity"]), float(current["average_buy_price"])
    q1, a1 = float(legacy["quantity"]), float(legacy["average_buy_price"])
    ai0 = float(current["average_buy_price_inr"] or 0.0) if "average_buy_price_inr" in current.keys() else 0.0
    ai1 = float(legacy["average_buy_price_inr"] or 0.0) if "average_buy_price_inr" in legacy.keys() else 0.0
    # Legacy rows: stored average IS the INR basis for INR assets; foreign
    # assets are converted at the current rate (documented approximation).
    conv = (lambda v: v * fx_rate) if currency != "INR" else (lambda v: v)
    ai0 = ai0 if ai0 > 0 else conv(a0)
    ai1 = ai1 if ai1 > 0 else conv(a1)
    new_qty = q0 + q1
    conn.execute(
        """
        UPDATE holdings SET quantity = ?, average_buy_price = ?,
            average_buy_price_inr = ?, updated_at = ?
        WHERE user_id = ? AND symbol = ?
        """,
        (
            new_qty,
            round((q0 * a0 + q1 * a1) / new_qty, 4),
            round((q0 * ai0 + q1 * ai1) / new_qty, 4),
            utcnow(),
            user_id,
            canonical,
        ),
    )
    conn.execute(
        "DELETE FROM holdings WHERE user_id = ? AND symbol = ?",
        (user_id, legacy_symbol),
    )


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@router.post("/api/auth/signup", response_model=AuthOut)
def signup(payload: SignupIn) -> AuthOut:
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if not USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-32 characters: letters, digits, '_' or '.' only.",
        )
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    with db() as conn:
        taken = conn.execute(
            "SELECT username, email FROM users WHERE username = ? OR email = ?",
            (username, email),
        ).fetchone()
        if taken is not None:
            which = "username" if taken["username"].lower() == username.lower() else "email"
            raise HTTPException(status_code=409, detail=f"That {which} is already registered.")
        cur = conn.execute(
            """
            INSERT INTO users (username, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (username, email, auth.hash_password(payload.password), utcnow()),
        )
        user_id = cur.lastrowid

    return _attach_token(_fetch_user(user_id), auth.create_session(user_id))


@router.post("/api/auth/login", response_model=AuthOut)
def login(payload: LoginIn) -> AuthOut:
    identifier = payload.identifier.strip()
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? OR email = ?",
            (identifier, identifier.lower()),
        ).fetchone()

    # Same message for unknown user and wrong password — no account probing.
    if row is None or not auth.verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username/email or password.")

    return _attach_token(row, auth.create_session(row["id"]))


@router.post("/api/auth/logout")
def logout(user=Depends(current_user), authorization: Optional[str] = Header(default=None)):
    token = authorization.split(" ", 1)[1].strip()
    auth.revoke_session(token)
    return {"ok": True}


@router.get("/api/auth/me", response_model=UserOut)
def me(user=Depends(current_user)) -> UserOut:
    return _user_out(user)


@router.post("/api/user/preferences", response_model=UserOut)
def update_preferences(payload: PreferencesIn, user=Depends(current_user)) -> UserOut:
    """Partial update of onboarding answers and notification preferences."""
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return _user_out(user)
    if "onboarding_completed" in fields:
        fields["onboarding_completed"] = 1 if fields["onboarding_completed"] else 0
    for key in (
        "pref_price_alerts",
        "pref_daily_digest",
        "pref_monthly_report",
        "pref_product_updates",
    ):
        if key in fields:
            fields[key] = 1 if fields[key] else 0

    assignments = ", ".join(f"{k} = ?" for k in fields)
    with db() as conn:
        conn.execute(
            f"UPDATE users SET {assignments} WHERE id = ?",
            (*fields.values(), user["id"]),
        )
    return _user_out(_fetch_user(user["id"]))


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------
def _pnl_breakdown(user_id: int) -> dict:
    """
    Realized P&L + capital baseline, replayed from the transaction log in INR
    (chronological, average-cost matching — same method the holdings use).

      realized     = Σ over sells of (INR proceeds − INR avg cost at sale) × qty
      capital_base = initial capital + manually imported cost basis (INR)
      total_pnl    = (cash + market value) − capital_base == realized + unrealized

    Multi-currency: each row's INR value is the one stored at EXECUTION
    (amount_inr, which embeds the FX rate used then), so replaying history
    never re-prices old trades with today's FX rate. Legacy rows without
    amount_inr fall back to qty × price — the original INR-only meaning.
    """
    with db() as conn:
        txns = conn.execute(
            """
            SELECT symbol, type, quantity, execution_price, source, amount_inr
            FROM transactions WHERE user_id = ?
            ORDER BY timestamp ASC, id ASC
            """,
            (user_id,),
        ).fetchall()
        pf = conn.execute(
            "SELECT initial_capital FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()

    realized = 0.0
    imported = 0.0
    book: dict[str, list[float]] = {}  # canonical symbol -> [qty, avg INR cost/share]
    for t in txns:
        qty, price = float(t["quantity"]), float(t["execution_price"])
        amount_inr = _inr_amount(qty, price, t["symbol"], t["amount_inr"])
        symbol = _canonical_symbol(t["symbol"])
        if t["type"] == "BUY":
            if t["source"] == "import":
                imported += amount_inr  # money put in, spent outside Artha
            slot = book.setdefault(symbol, [0.0, 0.0])
            new_qty = slot[0] + qty
            slot[1] = (slot[0] * slot[1] + amount_inr) / new_qty if new_qty else 0.0
            slot[0] = new_qty
        else:  # SELL
            slot = book.get(symbol)
            held, avg = (slot[0], slot[1]) if slot else (0.0, 0.0)
            matched = min(qty, held)
            proceeds_ps = amount_inr / qty if qty else 0.0
            realized += (proceeds_ps - avg) * matched
            if slot is not None:
                slot[0] -= qty
                if slot[0] <= 1e-9:
                    del book[symbol]

    initial = float(pf["initial_capital"]) if pf else 0.0
    return {
        "capital_base": round(initial + imported, 2),
        "realized_pnl": round(realized, 2),
    }


def _portfolio_payload(user_id: int) -> PortfolioOut:
    with db() as conn:
        pf = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()
        rows = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? ORDER BY symbol", (user_id,)
        ).fetchall()

    holdings_in = [
        HoldingIn(
            symbol=r["symbol"],
            qty=r["quantity"],
            avg_cost=r["average_buy_price"],
            currency=(r["currency"] if "currency" in r.keys() else None),
            avg_cost_inr=(r["average_buy_price_inr"] if "average_buy_price_inr" in r.keys() else None),
        )
        for r in rows
    ]
    # Valuation comes from the existing portfolio service (real market prices).
    valuation = value_portfolio(holdings_in)
    pnl = _pnl_breakdown(user_id) if pf else {"capital_base": 0.0, "realized_pnl": 0.0}

    portfolio_value = (pf["virtual_cash"] if pf else 0.0) + valuation.totals.value
    capital_base = pnl["capital_base"]
    total_pnl = round(portfolio_value - capital_base, 2)
    total_return_pct = round(total_pnl / capital_base * 100.0, 4) if capital_base > 0 else 0.0

    return PortfolioOut(
        exists=pf is not None,
        mode=pf["mode"] if pf else None,
        virtual_cash=pf["virtual_cash"] if pf else 0.0,
        initial_capital=pf["initial_capital"] if pf else 0.0,
        created_at=pf["created_at"] if pf else None,
        holdings=valuation.holdings,
        totals=valuation.totals,
        capital_base=capital_base,
        total_pnl=total_pnl,
        total_return_pct=total_return_pct,
        realized_pnl=pnl["realized_pnl"],
        timestamp=valuation.timestamp,
        source=valuation.source,
    )


def _require_portfolio(user_id: int):
    with db() as conn:
        pf = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()
    if pf is None:
        raise HTTPException(
            status_code=400,
            detail="You don't have a portfolio yet — start one from the Portfolio page first.",
        )
    return pf


def _get_priced(symbol: str) -> dict:
    """
    Latest quote for ANY tradable symbol (registry or dynamically discovered).
    Clean 404 for unknown/unpriceable symbols, 502 for provider failures.
    """
    symbol = symbol.strip().upper()
    try:
        return quote_service.get_quote(symbol)
    except md.SymbolNotFoundError as exc:
        detail = str(exc.args[0] if exc.args else exc)
        raise HTTPException(status_code=404, detail=detail)
    except md.DataProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


def _clean_qty(qty: float) -> int:
    q = int(qty)
    if qty <= 0 or q != qty:
        raise HTTPException(status_code=400, detail="Quantity must be a whole number greater than zero.")
    return q


@router.get("/api/portfolio", response_model=PortfolioOut)
def get_portfolio(user=Depends(current_user)) -> PortfolioOut:
    """Portfolio state: virtual cash + holdings valued at real market prices."""
    return _portfolio_payload(user["id"])


@router.post("/api/portfolio/start", response_model=PortfolioOut)
def start_portfolio(payload: PortfolioStartIn, user=Depends(current_user)) -> PortfolioOut:
    """Create the user's portfolio: ₹1,00,000 virtual cash, or manual mode (cash 0)."""
    user_id = user["id"]
    with db() as conn:
        existing = conn.execute(
            "SELECT user_id FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing is None:
            cash = VIRTUAL_STARTING_CASH if payload.mode == "virtual" else 0.0
            conn.execute(
                """
                INSERT INTO portfolios (user_id, mode, virtual_cash, initial_capital, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, payload.mode, cash, cash, utcnow()),
            )
    return _portfolio_payload(user_id)


@router.post("/api/portfolio/order", response_model=PortfolioOut)
def place_order(payload: OrderIn, user=Depends(current_user)) -> PortfolioOut:
    """
    Virtual market order at the latest available price, converted into the
    portfolio's base currency (INR) at the FX rate of the moment.

    BUY  : INR cost = native price × qty × current FX rate for foreign stock
           (× 1 for INR stock). The INR-converted cost — never the raw foreign
           number — is validated against and deducted from virtual cash.
    SELL : the current native price is converted at the CURRENT rate before
           crediting virtual cash.

    Every transaction records native price, native currency, the FX rate used
    and the INR value, so historical cost basis never changes when FX moves.
    """
    user_id = user["id"]
    qty = _clean_qty(payload.qty)
    requested = payload.symbol.strip().upper()

    _require_portfolio(user_id)
    quote = _get_priced(requested)               # 404 for unknown symbols
    symbol = quote["symbol"]                     # canonical display symbol
    currency = quote["currency"]
    price = round(float(quote["price"]), 2)      # NATIVE, per share

    try:
        fx_rate = float(fx_service.get_rate(currency, "INR"))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"FX rate {currency}->INR is unavailable, so the order cannot be "
                f"valued in INR — nothing was placed. ({exc})"
            ),
        )

    price_inr = price * fx_rate
    native_amount = round(qty * price, 2)
    amount_inr = round(qty * price_inr, 2)       # what INR actually moves

    with db() as conn:
        pf = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()
        _merge_legacy_holding(conn, user_id, requested, symbol, currency, fx_rate)
        holding = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()

        if payload.side == "BUY":
            cash = float(pf["virtual_cash"])
            if amount_inr > cash + 1e-6:
                if currency == "INR":
                    # Unchanged wording for the INR-only case.
                    detail = (
                        f"Insufficient virtual cash: {qty} x ₹{price:,.2f} = ₹{amount_inr:,.2f}, "
                        f"but you have ₹{cash:,.2f}."
                    )
                else:
                    detail = (
                        f"Insufficient virtual cash: {qty} x {_fmt_native(price, currency)} "
                        f"× {fx_rate:.2f} INR/{currency} = ₹{amount_inr:,.2f}, "
                        f"but you have ₹{cash:,.2f}."
                    )
                raise HTTPException(status_code=400, detail=detail)
            old_qty = float(holding["quantity"]) if holding else 0.0
            old_avg = float(holding["average_buy_price"]) if holding else 0.0
            stored_inr = (
                float(holding["average_buy_price_inr"])
                if holding and holding["average_buy_price_inr"] is not None
                else 0.0
            )
            # Legacy rows (0) have no stored INR basis: an INR asset keeps the
            # stored figure (its old meaning); a legacy FOREIGN asset — whose
            # face value used to be mislabelled ₹ — is converted at the current
            # rate, the same approximation valuation uses.
            old_avg_inr = (
                stored_inr
                if stored_inr > 0
                else (old_avg * fx_rate if currency != "INR" else old_avg)
            )
            new_qty = old_qty + qty
            new_avg = (old_qty * old_avg + qty * price) / new_qty
            new_avg_inr = (old_qty * old_avg_inr + amount_inr) / new_qty
            conn.execute(
                """
                INSERT INTO holdings
                    (user_id, symbol, quantity, average_buy_price, currency,
                     average_buy_price_inr, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, symbol) DO UPDATE SET
                    quantity = excluded.quantity,
                    average_buy_price = excluded.average_buy_price,
                    currency = excluded.currency,
                    average_buy_price_inr = excluded.average_buy_price_inr,
                    updated_at = excluded.updated_at
                """,
                (user_id, symbol, new_qty, round(new_avg, 4), currency,
                 round(new_avg_inr, 4), utcnow()),
            )
            conn.execute(
                "UPDATE portfolios SET virtual_cash = ? WHERE user_id = ?",
                (round(cash - amount_inr, 2), user_id),
            )
        else:  # SELL
            owned = int(holding["quantity"]) if holding else 0
            if qty > owned:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient shares: you own {owned} of {symbol}, cannot sell {qty}.",
                )
            cash = float(pf["virtual_cash"])
            remaining = owned - qty
            if remaining == 0:
                conn.execute(
                    "DELETE FROM holdings WHERE user_id = ? AND symbol = ?", (user_id, symbol)
                )
            else:
                conn.execute(
                    "UPDATE holdings SET quantity = ?, updated_at = ? WHERE user_id = ? AND symbol = ?",
                    (remaining, utcnow(), user_id, symbol),
                )
            # Credit at the CURRENT FX rate (not the rate you bought at).
            conn.execute(
                "UPDATE portfolios SET virtual_cash = ? WHERE user_id = ?",
                (round(cash + amount_inr, 2), user_id),
            )

        conn.execute(
            """
            INSERT INTO transactions
                (user_id, symbol, type, quantity, execution_price, source, timestamp,
                 currency, fx_rate, amount_inr)
            VALUES (?, ?, ?, ?, ?, 'trade', ?, ?, ?, ?)
            """,
            (user_id, symbol, payload.side, qty, price, utcnow(),
             currency, fx_rate, amount_inr),
        )

    return _portfolio_payload(user_id)


@router.post("/api/portfolio/position", response_model=PortfolioOut)
def add_position(payload: PositionIn, user=Depends(current_user)) -> PortfolioOut:
    """
    Manual import of an existing real-world holding (NOT a trade, NOT a broker
    integration). The average price you enter is in the security's NATIVE
    currency; it is converted ONCE at import time to build the holding's INR
    cost basis (the FX rate used is stored on the transaction row), so later
    FX moves cannot rewrite what you paid. Virtual cash is unaffected because
    this money was spent outside Artha.
    """
    user_id = user["id"]
    qty = _clean_qty(payload.qty)
    if payload.avg_cost <= 0:
        raise HTTPException(status_code=400, detail="Average buy price must be greater than zero.")
    requested = payload.symbol.strip().upper()

    _require_portfolio(user_id)
    # Validate against any tradable symbol (not just the tracked universe).
    quote = _get_priced(requested)
    symbol = quote["symbol"]
    currency = quote["currency"]
    try:
        fx_rate = float(fx_service.get_rate(currency, "INR"))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"FX rate {currency}->INR is unavailable, so this holding cannot be "
                f"given an INR cost basis — nothing was saved. ({exc})"
            ),
        )

    avg_cost = round(payload.avg_cost, 2)              # NATIVE, per share
    avg_cost_inr = round(avg_cost * fx_rate, 4)        # INR basis captured NOW
    amount_inr = round(qty * avg_cost * fx_rate, 2)

    with db() as conn:
        _merge_legacy_holding(conn, user_id, requested, symbol, currency, fx_rate)
        holding = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()
        old_qty = float(holding["quantity"]) if holding else 0.0
        old_avg = float(holding["average_buy_price"]) if holding else 0.0
        stored_inr = (
            float(holding["average_buy_price_inr"])
            if holding and holding["average_buy_price_inr"] is not None
            else 0.0
        )
        # Legacy row: INR figure as-is; legacy foreign converted at current rate
        # (the documented approximation — no rate was stored back then).
        old_avg_inr = (
            stored_inr
            if stored_inr > 0
            else (old_avg * fx_rate if currency != "INR" else old_avg)
        )
        new_qty = old_qty + qty
        new_avg = (old_qty * old_avg + qty * avg_cost) / new_qty
        new_avg_inr = (old_qty * old_avg_inr + amount_inr) / new_qty
        conn.execute(
            """
            INSERT INTO holdings
                (user_id, symbol, quantity, average_buy_price, currency,
                 average_buy_price_inr, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, symbol) DO UPDATE SET
                quantity = excluded.quantity,
                average_buy_price = excluded.average_buy_price,
                currency = excluded.currency,
                average_buy_price_inr = excluded.average_buy_price_inr,
                updated_at = excluded.updated_at
            """,
            (user_id, symbol, new_qty, round(new_avg, 4), currency,
             round(new_avg_inr, 4), utcnow()),
        )
        conn.execute(
            """
            INSERT INTO transactions
                (user_id, symbol, type, quantity, execution_price, source, timestamp,
                 currency, fx_rate, amount_inr)
            VALUES (?, ?, 'BUY', ?, ?, 'import', ?, ?, ?, ?)
            """,
            (user_id, symbol, qty, avg_cost, utcnow(), currency, fx_rate, amount_inr),
        )

    return _portfolio_payload(user_id)


@router.get("/api/portfolio/transactions", response_model=list[TransactionOut])
def list_transactions(user=Depends(current_user)) -> list[TransactionOut]:
    """Most recent first; empty list when there is nothing to show yet."""
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, symbol, type, quantity, execution_price, source, timestamp,
                   currency, fx_rate, amount_inr
            FROM transactions WHERE user_id = ?
            ORDER BY timestamp DESC, id DESC LIMIT 200
            """,
            (user["id"],),
        ).fetchall()
    return [
        TransactionOut(
            id=r["id"],
            symbol=r["symbol"],
            type=r["type"],
            qty=r["quantity"],
            price=r["execution_price"],            # NATIVE currency
            # INR at execution; legacy rows use the same fallback as the P&L
            # replay (qty x price, converted for legacy foreign symbols).
            amount=round(
                _inr_amount(
                    float(r["quantity"]),
                    float(r["execution_price"]),
                    r["symbol"],
                    r["amount_inr"],
                ),
                2,
            ),
            currency=r["currency"] or "INR",
            fx_rate=r["fx_rate"] if r["fx_rate"] is not None else 1.0,
            source=r["source"],
            timestamp=r["timestamp"],
        )
        for r in rows
    ]
