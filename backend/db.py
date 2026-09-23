"""
SQLite persistence for Artha user accounts and portfolios.

Deliberately minimal: one file-backed database, no ORM, no extra services.
The existing market-data layer stays untouched — this only stores what the
USER enters (credentials, onboarding preferences, virtual cash, holdings,
transactions).

Tables
------
users        : id, username, email, password_hash (PBKDF2), onboarding + prefs
sessions     : bearer tokens issued at login
portfolios   : one per user — virtual paper-trading account
holdings     : per-user positions (quantity + average buy price)
transactions : BUY/SELL/IMPORT log used for history and cost-basis tracking
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

DB_PATH = Path(__file__).resolve().parent / "artha.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    username             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    email                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash        TEXT    NOT NULL,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    investment_goal      TEXT,
    monthly_range        TEXT,
    risk_profile         TEXT,
    experience           TEXT,
    initial_preference   TEXT,
    country              TEXT    NOT NULL DEFAULT 'India',
    currency             TEXT    NOT NULL DEFAULT 'INR',
    pref_price_alerts    INTEGER NOT NULL DEFAULT 1,
    pref_daily_digest    INTEGER NOT NULL DEFAULT 1,
    pref_monthly_report  INTEGER NOT NULL DEFAULT 0,
    pref_product_updates INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolios (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mode           TEXT    NOT NULL,          -- 'virtual' | 'manual'
    virtual_cash   REAL    NOT NULL,
    initial_capital REAL   NOT NULL,
    created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS holdings (
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol             TEXT    NOT NULL,
    quantity           REAL    NOT NULL,
    average_buy_price  REAL    NOT NULL,
    updated_at         TEXT    NOT NULL,
    PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol          TEXT    NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('BUY', 'SELL')),
    quantity        REAL    NOT NULL,
    execution_price REAL    NOT NULL,
    source          TEXT    NOT NULL DEFAULT 'trade',   -- 'trade' | 'import'
    timestamp       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, timestamp);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    """Connection that commits on success and always closes."""
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
