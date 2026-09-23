"""Pydantic request/response models for accounts, preferences and the virtual portfolio.

Conventions match the rest of the backend: snake_case on the wire, nulls for
values that do not exist yet (never fabricated).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from models.schemas import HoldingValuation, PortfolioTotals


class SignupIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)  # username or email
    password: str = Field(min_length=1, max_length=128)


class PreferencesIn(BaseModel):
    """Partial update — only the fields the client sends are changed."""

    investment_goal: Optional[str] = None
    monthly_range: Optional[str] = None
    risk_profile: Optional[str] = None
    experience: Optional[str] = None
    initial_preference: Optional[str] = None
    onboarding_completed: Optional[bool] = None

    pref_price_alerts: Optional[bool] = None
    pref_daily_digest: Optional[bool] = None
    pref_monthly_report: Optional[bool] = None
    pref_product_updates: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    country: str
    currency: str
    onboarding_completed: bool
    investment_goal: Optional[str] = None
    monthly_range: Optional[str] = None
    risk_profile: Optional[str] = None
    experience: Optional[str] = None
    initial_preference: Optional[str] = None
    pref_price_alerts: bool
    pref_daily_digest: bool
    pref_monthly_report: bool
    pref_product_updates: bool
    created_at: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class PortfolioStartIn(BaseModel):
    mode: Literal["virtual", "manual"]


class OrderIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    side: Literal["BUY", "SELL"]
    qty: float


class PositionIn(BaseModel):
    """Manual import of an existing real-world holding (not a trade)."""

    symbol: str = Field(min_length=1, max_length=20)
    qty: float
    avg_cost: float


class TransactionOut(BaseModel):
    id: int
    symbol: str
    type: Literal["BUY", "SELL"]
    qty: float
    price: float
    amount: float
    source: str
    timestamp: str


class PortfolioOut(BaseModel):
    exists: bool
    mode: Optional[Literal["virtual", "manual"]] = None
    virtual_cash: float = 0.0
    initial_capital: float = 0.0
    created_at: Optional[str] = None
    holdings: list[HoldingValuation] = Field(default_factory=list)
    totals: PortfolioTotals
    timestamp: str = ""
    source: str = ""
