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
from services.portfolio import value_portfolio
from services.universe import get_universe_snapshots

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
def _portfolio_payload(user_id: int) -> PortfolioOut:
    with db() as conn:
        pf = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()
        rows = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? ORDER BY symbol", (user_id,)
        ).fetchall()

    holdings_in = [
        HoldingIn(symbol=r["symbol"], qty=r["quantity"], avg_cost=r["average_buy_price"])
        for r in rows
    ]
    # Valuation comes from the existing portfolio service (real market prices).
    valuation = value_portfolio(holdings_in)

    return PortfolioOut(
        exists=pf is not None,
        mode=pf["mode"] if pf else None,
        virtual_cash=pf["virtual_cash"] if pf else 0.0,
        initial_capital=pf["initial_capital"] if pf else 0.0,
        created_at=pf["created_at"] if pf else None,
        holdings=valuation.holdings,
        totals=valuation.totals,
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
    """Latest market snapshot for a tracked symbol, or a clean 404/502."""
    symbol = symbol.strip().upper()
    snap = get_universe_snapshots().get(symbol)  # provider failure -> 502 via handler
    if snap is None or snap.get("price") is None:
        raise HTTPException(
            status_code=404,
            detail=f"No market data for '{symbol}' — check the symbol on the Research page.",
        )
    return snap


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
    Virtual market order at the latest available real price.

    BUY  : costs qty x price from virtual cash, upserts the holding (weighted
           average cost) and records the transaction.
    SELL : credits qty x price to virtual cash, reduces/removes the holding.
    """
    user_id = user["id"]
    qty = _clean_qty(payload.qty)
    symbol = payload.symbol.strip().upper()

    _require_portfolio(user_id)
    snap = _get_priced(symbol)                 # 404 for unknown symbols
    price = round(float(snap["price"]), 2)
    amount = round(qty * price, 2)

    with db() as conn:
        pf = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ?", (user_id,)
        ).fetchone()
        holding = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()

        if payload.side == "BUY":
            cash = float(pf["virtual_cash"])
            if amount > cash + 1e-6:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient virtual cash: {qty} x ₹{price:,.2f} = ₹{amount:,.2f}, "
                        f"but you have ₹{cash:,.2f}."
                    ),
                )
            old_qty = float(holding["quantity"]) if holding else 0.0
            old_avg = float(holding["average_buy_price"]) if holding else 0.0
            new_qty = old_qty + qty
            new_avg = (old_qty * old_avg + qty * price) / new_qty
            conn.execute(
                """
                INSERT INTO holdings (user_id, symbol, quantity, average_buy_price, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, symbol) DO UPDATE SET
                    quantity = excluded.quantity,
                    average_buy_price = excluded.average_buy_price,
                    updated_at = excluded.updated_at
                """,
                (user_id, symbol, new_qty, round(new_avg, 4), utcnow()),
            )
            conn.execute(
                "UPDATE portfolios SET virtual_cash = ? WHERE user_id = ?",
                (round(cash - amount, 2), user_id),
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
            conn.execute(
                "UPDATE portfolios SET virtual_cash = ? WHERE user_id = ?",
                (round(cash + amount, 2), user_id),
            )

        conn.execute(
            """
            INSERT INTO transactions (user_id, symbol, type, quantity, execution_price, source, timestamp)
            VALUES (?, ?, ?, ?, ?, 'trade', ?)
            """,
            (user_id, symbol, payload.side, qty, price, utcnow()),
        )

    return _portfolio_payload(user_id)


@router.post("/api/portfolio/position", response_model=PortfolioOut)
def add_position(payload: PositionIn, user=Depends(current_user)) -> PortfolioOut:
    """
    Manual import of an existing real-world holding (NOT a trade, NOT a broker
    integration). Adds quantity at the user-entered average cost; virtual cash
    is unaffected because this money was spent outside Artha.
    """
    user_id = user["id"]
    qty = _clean_qty(payload.qty)
    if payload.avg_cost <= 0:
        raise HTTPException(status_code=400, detail="Average buy price must be greater than zero.")
    symbol = payload.symbol.strip().upper()

    _require_portfolio(user_id)
    # Validate the symbol against the tracked universe so it can be priced.
    _get_priced(symbol)

    with db() as conn:
        holding = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()
        old_qty = float(holding["quantity"]) if holding else 0.0
        old_avg = float(holding["average_buy_price"]) if holding else 0.0
        new_qty = old_qty + qty
        new_avg = (old_qty * old_avg + qty * payload.avg_cost) / new_qty
        conn.execute(
            """
            INSERT INTO holdings (user_id, symbol, quantity, average_buy_price, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, symbol) DO UPDATE SET
                quantity = excluded.quantity,
                average_buy_price = excluded.average_buy_price,
                updated_at = excluded.updated_at
            """,
            (user_id, symbol, new_qty, round(new_avg, 4), utcnow()),
        )
        conn.execute(
            """
            INSERT INTO transactions (user_id, symbol, type, quantity, execution_price, source, timestamp)
            VALUES (?, ?, 'BUY', ?, ?, 'import', ?)
            """,
            (user_id, symbol, qty, round(payload.avg_cost, 2), utcnow()),
        )

    return _portfolio_payload(user_id)


@router.get("/api/portfolio/transactions", response_model=list[TransactionOut])
def list_transactions(user=Depends(current_user)) -> list[TransactionOut]:
    """Most recent first; empty list when there is nothing to show yet."""
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, symbol, type, quantity, execution_price, source, timestamp
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
            price=r["execution_price"],
            amount=round(r["quantity"] * r["execution_price"], 2),
            source=r["source"],
            timestamp=r["timestamp"],
        )
        for r in rows
    ]
