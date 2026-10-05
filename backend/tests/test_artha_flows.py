"""
Artha backend tests — universal stock search, independent quote refresh, and
multi-currency virtual-portfolio accounting (INR base currency).

Run from backend/:
    .venv/Scripts/python.exe -m unittest discover -s tests -v

No network and no third-party test framework: stdlib unittest only. The
market-data provider is replaced by an in-process fake and the SQLite file is
a temp directory, so tests never touch the real artha.db or Yahoo Finance.

Coverage (task list A–I):
  A. Indian stock buy  -> cash decreases by exactly the INR amount
  B. US stock buy at $341 with USD/INR = 95.80 -> 32,667.80 INR deducted
  C. quantity rules unchanged (whole shares only)
  D. SELL credits INR at the CURRENT FX rate (not the buy rate)
  E. historical INR cost basis does NOT change when FX moves
  F. portfolio valuation uses the CURRENT FX rate
  G. search finds Tesla, Apple, NVIDIA, Reliance, TCS and more
  H. invalid company -> clean "No matching company found"
  I. quote endpoint refreshes independently from historical data
  J. legacy-database migration + legacy-row behaviour preserved
"""

from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd

import db as db_module
from utils import cache

# Point the database at a temp file BEFORE anything (including main) touches it.
_TMP_DIR = Path(tempfile.mkdtemp(prefix="artha_tests_"))
db_module.DB_PATH = _TMP_DIR / "artha_test.db"
db_module.init_db()

from fastapi import HTTPException

import main as app_main  # FastAPI app — created against the temp database
import routes_account as routes
from models.account import OrderIn
from services import fx as fx_service
from services import market_data as md
from services import quotes as quote_service

# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #

def _fx_frame(rate: float) -> pd.DataFrame:
    idx = pd.date_range(end=pd.Timestamp("2026-09-25"), periods=5, freq="D", tz="UTC")
    return pd.DataFrame(
        {
            "Open": [rate] * 5,
            "High": [rate] * 5,
            "Low": [rate] * 5,
            "Close": [rate] * 5,
            "Volume": [0.0] * 5,
        },
        index=idx,
    )


class FakeProvider:
    """In-process stand-in for YahooFinanceProvider — zero network."""

    name = "Fake"

    def __init__(self, prices=None, fx_rate=95.8, search_results=None, info=None):
        self.prices = dict(prices or {})
        self.fx_rate = fx_rate
        self.search_results = {k.lower(): v for k, v in (search_results or {}).items()}
        self.info_by_ticker = dict(info or {})
        self.calls: dict[str, int] = {}

    def _count(self, key: str) -> None:
        self.calls[key] = self.calls.get(key, 0) + 1

    def search(self, query: str, limit: int = 10):
        self._count("search")
        return list(self.search_results.get(query.strip().lower(), []))

    def quotes(self, tickers):
        # Mirror the real provider: batched light quotes behind a QUOTE_TTL
        # cache (cleared by utils.cache.clear(), like production).
        key = ("quotes", tuple(sorted(dict.fromkeys(tickers))))

        def _fetch():
            self._count("quotes")
            return {
                t: {
                    "price": self.prices[t],
                    "change": 1.0,
                    "change_percent": 0.5,
                    "timestamp": "2026-09-25T00:00:00+00:00",
                }
                for t in tickers
                if t in self.prices
            }

        return cache.cached(key, md.QUOTE_TTL, _fetch)

    def history(self, ticker: str, period: str, interval: str):
        self._count(f"history:{ticker}:{period}:{interval}")
        if "=" in ticker:
            return _fx_frame(self.fx_rate)
        raise md.DataProviderError(f"No historical data available for {ticker}")

    def batch_history(self, tickers, period: str, interval: str):
        self._count("batch_history")
        return {}

    def info(self, ticker: str):
        self._count(f"info:{ticker}")
        return dict(self.info_by_ticker.get(ticker, {}))


def _hit(symbol, exchange, exch_disp, qtype="EQUITY", short=None, longname=None):
    """A Yahoo search payload row (that API has no currency field)."""
    return {
        "symbol": symbol,
        "shortname": short or symbol,
        "longname": longname or short or symbol,
        "exchange": exchange,
        "exchDisp": exch_disp,
        "quoteType": qtype,
    }


# Realistic provider search payloads for requirement G.
_SEARCH_FIXTURES = {
    "tesla": [
        _hit("TSLA", "NMS", "NASDAQ", short="Tesla, Inc.", longname="Tesla, Inc."),
        _hit("XTSLA=F", "CME", "Chicago Mercantile Exchange", qtype="FUTURE", short="Tesla futures"),
        _hit("BTC-USD", "CCC", "Cryptocurrency", qtype="CRYPTOCURRENCY", short="Bitcoin"),
    ],
    "apple": [_hit("AAPL", "NMS", "NASDAQ", short="Apple Inc.", longname="Apple Inc.")],
    "nvidia": [_hit("NVDA", "NMS", "NASDAQ", short="NVIDIA Corporation")],
    "reliance": [
        _hit("RELIANCE.NS", "NSI", "NSE", short="RELIANCE INDUSTRIES LTD",
             longname="Reliance Industries Limited"),
        _hit("RS", "NYQ", "NYSE", short="Reliance, Inc."),
    ],
    "tcs": [
        _hit("TCS.NS", "NSI", "NSE", short="TATA CONSULTANCY SERV LT"),
        _hit("TCS.BO", "BSE", "Bombay", short="TATA CONSULTANCY SERVICES LTD."),
    ],
    "amazon": [_hit("AMZN", "NMS", "NASDAQ", short="Amazon.com, Inc.")],
    "microsoft": [_hit("MSFT", "NMS", "NASDAQ", short="Microsoft Corporation")],
    "infosys": [
        _hit("INFY", "NYQ", "NYSE", short="Infosys Limited"),   # ADR — filtered (registry says INFY.NS)
        _hit("INFY.NS", "NSI", "NSE", short="Infosys Limited"),
    ],
    "wipro": [_hit("WIPRO.NS", "NSI", "NSE", short="Wipro Limited")],
    "alphabet": [_hit("GOOGL", "NMS", "NASDAQ", short="Alphabet Inc.")],
    "googl": [_hit("GOOGL", "NMS", "NASDAQ", short="Alphabet Inc.")],
    "boeing": [_hit("BA", "NYQ", "NYSE", short="The Boeing Company")],
    "adani enterprises": [_hit("ADANIENT.NS", "NSI", "NSE", short="Adani Enterprises Limited")],
    "adanient": [_hit("ADANIENT.NS", "NSI", "NSE", short="Adani Enterprises Limited")],
}

_USER_SEQ = [0]


def _new_user(cash: float = 100_000.0) -> dict:
    """A fresh user + virtual portfolio row (isolated per test)."""
    _USER_SEQ[0] += 1
    n = _USER_SEQ[0]
    with db_module.db() as conn:
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (f"tester{n}", f"tester{n}@test.local", "unused", db_module.utcnow()),
        )
        user_id = cur.lastrowid
        conn.execute(
            "INSERT INTO portfolios (user_id, mode, virtual_cash, initial_capital, created_at)"
            " VALUES (?, 'virtual', ?, ?, ?)",
            (user_id, cash, cash, db_module.utcnow()),
        )
    return {"id": user_id}


class ArthaBackendTest(unittest.TestCase):
    """Shared fixture: fake provider, patched universe, fresh virtual user."""

    prices = {"TSLA": 341.0, "RELIANCE.NS": 1500.0}
    fx_rate = 95.8
    search_results = None

    def setUp(self):
        cache.clear()
        self._orig_provider = md._provider
        self.provider = FakeProvider(self.prices, self.fx_rate, self.search_results)
        md._provider = self.provider
        routes._ENTRY_MEMO.clear()
        # Universe snapshots would batch-download real history — not under test.
        patcher = mock.patch("services.universe.get_universe_snapshots", return_value={})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(lambda: setattr(md, "_provider", self._orig_provider))
        self.addCleanup(cache.clear)
        self.user = _new_user()

    # -- small helpers ------------------------------------------------------ #
    def cash(self) -> float:
        with db_module.db() as conn:
            row = conn.execute(
                "SELECT virtual_cash FROM portfolios WHERE user_id = ?",
                (self.user["id"],),
            ).fetchone()
        return float(row["virtual_cash"])

    def holding(self, symbol: str):
        with db_module.db() as conn:
            return conn.execute(
                "SELECT * FROM holdings WHERE user_id = ? AND symbol = ?",
                (self.user["id"], symbol),
            ).fetchone()

    def transactions(self):
        with db_module.db() as conn:
            return conn.execute(
                "SELECT * FROM transactions WHERE user_id = ? ORDER BY id",
                (self.user["id"],),
            ).fetchall()

    def buy(self, symbol: str, qty: float, side: str = "BUY"):
        return routes.place_order(OrderIn(symbol=symbol, side=side, qty=qty), user=self.user)


# --------------------------------------------------------------------------- #
# A. Indian stock — INR behaves exactly as before
# --------------------------------------------------------------------------- #
class TestIndianStockBuy(ArthaBackendTest):
    def test_buy_inr_stock_deducts_exact_inr_amount(self):
        out = self.buy("RELIANCE", 1)
        self.assertAlmostEqual(out.virtual_cash, 100_000 - 1500.0, places=2)

        txn = self.transactions()[-1]
        self.assertEqual(txn["currency"], "INR")
        self.assertEqual(txn["fx_rate"], 1.0)
        self.assertAlmostEqual(txn["execution_price"], 1500.0, places=2)
        self.assertAlmostEqual(txn["amount_inr"], 1500.0, places=2)

        h = self.holding("RELIANCE")
        self.assertEqual(h["currency"], "INR")
        self.assertAlmostEqual(h["average_buy_price"], 1500.0, places=4)
        self.assertAlmostEqual(h["average_buy_price_inr"], 1500.0, places=4)

        # An INR-only trade never touches the FX provider.
        self.assertEqual(self.provider.calls.get("history:USDINR=X:5d:1d", 0), 0)

    def test_inr_holdings_valued_without_any_fx(self):
        self.buy("RELIANCE", 3)
        out = routes.get_portfolio(user=self.user)
        self.assertAlmostEqual(out.totals.invested, 4500.0, places=2)
        self.assertAlmostEqual(out.totals.value, 4500.0, places=2)
        self.assertEqual(out.holdings[0].currency, "INR")
        self.assertEqual(out.holdings[0].fx_rate, 1.0)
        self.assertEqual(self.provider.calls.get("history:USDINR=X:5d:1d", 0), 0)


# --------------------------------------------------------------------------- #
# B. US stock — $341 at USD/INR 95.80 costs 32,667.80 INR
# --------------------------------------------------------------------------- #
class TestUsStockBuyWithFx(ArthaBackendTest):
    def test_buy_tsla_deducts_inr_converted_cost(self):
        expected_inr = round(341.0 * 95.8, 2)
        self.assertAlmostEqual(expected_inr, 32_667.80, places=2)

        out = self.buy("TSLA", 1)
        self.assertAlmostEqual(out.virtual_cash, 100_000 - expected_inr, places=2)

        txn = self.transactions()[-1]
        self.assertEqual(txn["currency"], "USD")
        self.assertAlmostEqual(txn["fx_rate"], 95.8, places=4)
        self.assertAlmostEqual(txn["execution_price"], 341.0, places=2)   # native
        self.assertAlmostEqual(txn["amount_inr"], 32_667.80, places=2)     # INR

        h = self.holding("TSLA")
        self.assertEqual(h["currency"], "USD")
        self.assertAlmostEqual(h["average_buy_price"], 341.0, places=4)     # native kept
        self.assertAlmostEqual(h["average_buy_price_inr"], 32_667.80, places=2)

    def test_insufficient_cash_checked_against_inr_cost(self):
        # 299 x 341 x 95.8 = 97,676,666 ... way beyond cash -> rejected
        with self.assertRaises(HTTPException) as ctx:
            self.buy("TSLA", 299)
        self.assertEqual(ctx.exception.status_code, 400)
        # The rejection message must show the FX conversion, not $-as-₹.
        self.assertIn("$341.00", ctx.exception.detail)
        self.assertIn("95.80 INR/USD", ctx.exception.detail)
        self.assertAlmostEqual(self.cash(), 100_000.0, places=2)

    def test_trade_ticket_payload_carries_fx_identity(self):
        q = quote_service.get_quote("TSLA")
        self.assertEqual(q["currency"], "USD")
        self.assertEqual(q["exchange"], "NASDAQ")
        self.assertAlmostEqual(q["price"], 341.0, places=2)
        self.assertAlmostEqual(q["fx_rate"], 95.8, places=4)
        r = quote_service.get_quote("RELIANCE")
        self.assertEqual(r["currency"], "INR")
        self.assertEqual(r["fx_rate"], 1.0)


# --------------------------------------------------------------------------- #
# C. Quantity rules unchanged — whole shares only
# --------------------------------------------------------------------------- #
class TestQuantityRules(ArthaBackendTest):
    def test_fractional_and_non_positive_quantities_rejected(self):
        for bad in (0, -2, 2.5):
            with self.subTest(qty=bad):
                with self.assertRaises(HTTPException) as ctx:
                    self.buy("RELIANCE", bad)
                self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(self.transactions(), [])
        self.assertAlmostEqual(self.cash(), 100_000.0, places=2)


# --------------------------------------------------------------------------- #
# D. SELL credits INR at the CURRENT FX rate
# --------------------------------------------------------------------------- #
class TestSellAtCurrentFx(ArthaBackendTest):
    def test_sell_uses_current_rate_and_realizes_in_inr(self):
        self.buy("TSLA", 1)
        cash_after_buy = self.cash()
        self.assertAlmostEqual(cash_after_buy, 100_000 - 32_667.80, places=2)

        # The rupee weakens after purchase: 1 USD = 96.50
        self.provider.fx_rate = 96.5
        cache.clear()

        out = self.buy("TSLA", 1, side="SELL")
        proceeds = round(341.0 * 96.5, 2)          # 32,906.50 INR
        self.assertAlmostEqual(self.cash(), cash_after_buy + proceeds, places=2)
        # Realized P&L in INR = current proceeds - stored INR cost basis.
        self.assertAlmostEqual(out.realized_pnl, proceeds - 32_667.80, places=2)
        self.assertIsNone(self.holding("TSLA"))


# --------------------------------------------------------------------------- #
# E + F. Historical cost basis frozen; valuation on current FX
# --------------------------------------------------------------------------- #
class TestCostBasisAndValuation(ArthaBackendTest):
    def test_cost_basis_frozen_valuation_uses_current_fx(self):
        self.buy("TSLA", 1)
        h = self.holding("TSLA")
        self.assertAlmostEqual(h["average_buy_price_inr"], 32_667.80, places=2)

        # FX moves AFTER the purchase...
        self.provider.fx_rate = 97.0
        cache.clear()

        # ...the stored INR cost basis does not move (requirement E).
        h2 = self.holding("TSLA")
        self.assertAlmostEqual(h2["average_buy_price_inr"], 32_667.80, places=2)
        self.assertAlmostEqual(h2["average_buy_price"], 341.0, places=4)

        out = routes.get_portfolio(user=self.user)
        # invested = stored INR cost basis, NOT 341 x 97.
        self.assertAlmostEqual(out.totals.invested, 32_667.80, places=2)
        # Current value uses the CURRENT FX rate (requirement F).
        self.assertAlmostEqual(out.totals.value, 341.0 * 97.0, places=2)
        self.assertAlmostEqual(
            out.totals.unrealized_pnl, 341.0 * 97.0 - 32_667.80, places=2
        )

    def test_pnl_replay_uses_stored_execution_values(self):
        self.buy("TSLA", 1)
        out = routes.get_portfolio(user=self.user)
        # capital base = starting cash only; nothing fabricated.
        self.assertAlmostEqual(out.capital_base, 100_000.0, places=2)
        self.assertAlmostEqual(out.realized_pnl, 0.0, places=2)


# --------------------------------------------------------------------------- #
# G + H. Universal search and the clean no-match state
# --------------------------------------------------------------------------- #
class TestUniversalSearch(ArthaBackendTest):
    search_results = _SEARCH_FIXTURES

    EXPECTED = {
        "tesla": ("TSLA", "TSLA", "NASDAQ", "US", "USD"),
        "apple": ("AAPL", "AAPL", "NASDAQ", "US", "USD"),
        "nvidia": ("NVDA", "NVDA", "NASDAQ", "US", "USD"),
        "reliance": ("RELIANCE", "RELIANCE.NS", "NSE", "IN", "INR"),
        "tcs": ("TCS", "TCS.NS", "NSE", "IN", "INR"),
        "amazon": ("AMZN", "AMZN", "NASDAQ", "US", "USD"),
        "microsoft": ("MSFT", "MSFT", "NASDAQ", "US", "USD"),
        "infosys": ("INFY", "INFY.NS", "NSE", "IN", "INR"),
        "wipro": ("WIPRO", "WIPRO.NS", "NSE", "IN", "INR"),
        "alphabet": ("GOOGL", "GOOGL", "NASDAQ", "US", "USD"),
        "boeing": ("BA", "BA", "NYSE", "US", "USD"),
        "adani enterprises": ("ADANIENT", "ADANIENT.NS", "NSE", "IN", "INR"),
    }

    def test_search_finds_known_companies_with_identity(self):
        for query, expected in self.EXPECTED.items():
            with self.subTest(query=query):
                results = md.search_instruments(query, limit=5)
                self.assertTrue(results, f"'{query}' returned no results")
                first = results[0]
                self.assertEqual(
                    (
                        first["symbol"],
                        first["ticker"],
                        first["exchange"],
                        first["country"],
                        first["currency"],
                    ),
                    expected,
                )

    def test_search_endpoint_returns_expected_shape(self):
        out = app_main.search_stocks(q="tesla", limit=5)
        self.assertEqual(out.query, "tesla")
        self.assertTrue(out.results)
        top = out.results[0]
        self.assertEqual(top.symbol, "TSLA")
        self.assertEqual(top.ticker, "TSLA")
        self.assertEqual(top.exchange, "NASDAQ")
        self.assertEqual(top.country, "US")
        self.assertEqual(top.currency, "USD")

    def test_futures_and_crypto_are_not_offered(self):
        results = md.search_instruments("tesla", limit=10)
        tickers = {r["ticker"] for r in results}
        self.assertNotIn("XTSLA=F", tickers)
        self.assertNotIn("BTC-USD", tickers)
        self.assertTrue(all(r["quote_type"] in ("EQUITY", "ETF") for r in results))

    def test_invalid_company_is_a_clean_empty_state(self):
        self.assertEqual(md.search_instruments("qqqzzxyw", limit=5), [])
        out = app_main.search_stocks(q="qqqzzxyw")
        self.assertEqual(list(out.results), [])
        with self.assertRaises(md.SymbolNotFoundError) as ctx:
            md.resolve_symbol("QQQZZXYW")
        self.assertIn("No matching company found", str(ctx.exception))

    def test_resolution_is_not_presumed_indian(self):
        # A US name the registry does not know stays US/USD (old code: .NS/INR).
        entry = md.resolve_symbol("GOOGL")
        self.assertEqual(entry["ticker"], "GOOGL")
        self.assertEqual(entry["currency"], "USD")
        self.assertEqual(entry["country"], "US")
        # A genuine NSE name resolves to .NS / INR via the PROVIDER, not a guess.
        entry2 = md.resolve_symbol("ADANIENT")
        self.assertEqual(entry2["ticker"], "ADANIENT.NS")
        self.assertEqual(entry2["currency"], "INR")

    def test_registry_and_explicit_tickers_still_work(self):
        for symbol, ticker, currency in (
            ("RELIANCE", "RELIANCE.NS", "INR"),
            ("TCS", "TCS.NS", "INR"),
            ("AAPL", "AAPL", "USD"),
            ("TSLA", "TSLA", "USD"),
            ("RELIANCE.NS", "RELIANCE.NS", "INR"),
            ("TCS.NS", "TCS.NS", "INR"),
        ):
            with self.subTest(symbol=symbol):
                entry = md.resolve_symbol(symbol)
                self.assertEqual(entry["ticker"], ticker)
                self.assertEqual(entry["currency"], currency)


# --------------------------------------------------------------------------- #
# I. Quote refresh is independent from historical data
# --------------------------------------------------------------------------- #
class TestQuoteRefreshIndependence(ArthaBackendTest):
    def test_quote_endpoint_refreshes_without_touching_history(self):
        q1 = quote_service.get_quote("TSLA")
        self.assertTrue(q1["available"])
        self.assertEqual(self.provider.calls.get("quotes", 0), 1)
        self.assertEqual(self.provider.calls.get("history:TSLA:1y:1d", 0), 0)

        # Inside the quote TTL nothing refetches.
        quote_service.get_quote("TSLA")
        self.assertEqual(self.provider.calls.get("quotes", 0), 1)

        # After the TTL the quote refreshes by itself; research history stays
        # on its own (much longer) TTL and is never re-fetched here.
        self.provider.prices["TSLA"] = 350.0
        cache.clear()
        q3 = quote_service.get_quote("TSLA")
        self.assertAlmostEqual(q3["price"], 350.0, places=2)
        self.assertEqual(self.provider.calls.get("quotes", 0), 2)
        self.assertEqual(self.provider.calls.get("history:TSLA:1y:1d", 0), 0)

        # Quote cache TTL is deliberately shorter than the history TTL.
        self.assertLess(md.QUOTE_TTL, md.YahooFinanceProvider.HISTORY_TTL_DAILY)

    def test_quote_and_quotes_endpoints(self):
        single = app_main.stock_quote("TSLA")
        self.assertEqual(single.currency, "USD")
        self.assertAlmostEqual(single.fx_rate, 95.8, places=4)
        self.assertIsNotNone(single.timestamp)

        batch = app_main.stock_quotes(symbols="TSLA,RELIANCE,NOTREALCO")
        by_symbol = {q["symbol"]: q for q in batch["quotes"]}
        self.assertTrue(by_symbol["TSLA"]["available"])
        self.assertTrue(by_symbol["RELIANCE"]["available"])
        self.assertFalse(by_symbol["NOTREALCO"]["available"])
        self.assertIn("No matching company found", by_symbol["NOTREALCO"]["error"])

    def test_unknown_symbol_quote_raises_not_found(self):
        with self.assertRaises(md.SymbolNotFoundError):
            app_main.stock_quote("TOTALLYFAKECO")


# --------------------------------------------------------------------------- #
# FX service itself
# --------------------------------------------------------------------------- #
class TestFxService(ArthaBackendTest):
    def test_usd_to_inr_from_provider_and_cached(self):
        self.assertAlmostEqual(fx_service.get_rate("USD", "INR"), 95.8, places=4)
        fx_service.get_rate("USD", "INR")            # cached — no second fetch
        self.assertEqual(self.provider.calls.get("history:USDINR=X:5d:1d", 0), 1)

    def test_inr_identity_never_touches_provider(self):
        self.assertEqual(fx_service.get_rate("INR", "INR"), 1.0)
        self.assertEqual(self.provider.calls.get("history:USDINR=X:5d:1d", 0), 0)

    def test_unsupported_pair_raises_rather_than_guessing(self):
        with self.assertRaises(fx_service.FxRateUnavailable):
            fx_service.get_rate("JPY", "INR")


# --------------------------------------------------------------------------- #
# J. Schema migration + legacy data
# --------------------------------------------------------------------------- #
_LEGACY_SCHEMA_AND_ROWS = """
CREATE TABLE users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    username             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    email                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash        TEXT    NOT NULL,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    country              TEXT    NOT NULL DEFAULT 'India',
    currency             TEXT    NOT NULL DEFAULT 'INR',
    pref_price_alerts    INTEGER NOT NULL DEFAULT 1,
    pref_daily_digest    INTEGER NOT NULL DEFAULT 1,
    pref_monthly_report  INTEGER NOT NULL DEFAULT 0,
    pref_product_updates INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT    NOT NULL
);
CREATE TABLE portfolios (
    user_id        INTEGER PRIMARY KEY,
    mode           TEXT    NOT NULL,
    virtual_cash   REAL    NOT NULL,
    initial_capital REAL   NOT NULL,
    created_at     TEXT    NOT NULL
);
CREATE TABLE holdings (
    user_id            INTEGER NOT NULL,
    symbol             TEXT    NOT NULL,
    quantity           REAL    NOT NULL,
    average_buy_price  REAL    NOT NULL,
    updated_at         TEXT    NOT NULL,
    PRIMARY KEY (user_id, symbol)
);
CREATE TABLE transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    symbol          TEXT    NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('BUY', 'SELL')),
    quantity        REAL    NOT NULL,
    execution_price REAL    NOT NULL,
    source          TEXT    NOT NULL DEFAULT 'trade',
    timestamp       TEXT    NOT NULL
);
INSERT INTO users (username, email, password_hash, created_at)
    VALUES ('legacy', 'legacy@test.local', 'unused', '2025-01-01T00:00:00+00:00');
INSERT INTO portfolios (user_id, mode, virtual_cash, initial_capital, created_at)
    VALUES (1, 'virtual', 100000, 100000, '2025-01-01T00:00:00+00:00');
INSERT INTO holdings (user_id, symbol, quantity, average_buy_price, updated_at)
    VALUES (1, 'RELIANCE', 2, 1500, '2025-01-05T00:00:00+00:00');
INSERT INTO transactions (user_id, symbol, type, quantity, execution_price, source, timestamp)
    VALUES (1, 'TSLA', 'BUY', 1, 341, 'trade', '2025-01-02T00:00:00+00:00');
INSERT INTO transactions (user_id, symbol, type, quantity, execution_price, source, timestamp)
    VALUES (1, 'RELIANCE', 'BUY', 2, 1500, 'trade', '2025-01-05T00:00:00+00:00');
INSERT INTO transactions (user_id, symbol, type, quantity, execution_price, source, timestamp)
    VALUES (1, 'TSLA', 'SELL', 1, 350, 'trade', '2025-02-01T00:00:00+00:00');
"""


class TestLegacyMigration(unittest.TestCase):
    """A pre-multi-currency database must migrate safely and keep working."""

    def setUp(self):
        cache.clear()
        self._orig_provider = md._provider
        self.provider = FakeProvider({"TSLA": 341.0, "RELIANCE.NS": 1500.0}, 95.8)
        md._provider = self.provider
        routes._ENTRY_MEMO.clear()
        patcher = mock.patch("services.universe.get_universe_snapshots", return_value={})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(lambda: setattr(md, "_provider", self._orig_provider))
        self.addCleanup(cache.clear)

    def test_migration_adds_columns_and_legacy_rows_behave(self):
        legacy_path = _TMP_DIR / "legacy.db"
        if legacy_path.exists():
            legacy_path.unlink()
        conn = sqlite3.connect(legacy_path)
        conn.executescript(_LEGACY_SCHEMA_AND_ROWS)
        conn.close()

        original_path = db_module.DB_PATH
        db_module.DB_PATH = legacy_path
        try:
            db_module.init_db()   # CREATE IF NOT EXISTS + additive ALTERs

            with db_module.db() as c:
                tx_cols = {r[1] for r in c.execute("PRAGMA table_info(transactions)")}
                h_cols = {r[1] for r in c.execute("PRAGMA table_info(holdings)")}
            self.assertLessEqual({"currency", "fx_rate", "amount_inr"}, tx_cols)
            self.assertLessEqual({"currency", "average_buy_price_inr"}, h_cols)

            routes._ENTRY_MEMO.clear()
            txns = routes.list_transactions(user={"id": 1})
            by_key = {(t.symbol, t.type): t for t in txns}

            # Legacy INR row: amount identical to the old qty x price meaning.
            rel = by_key[("RELIANCE", "BUY")]
            self.assertEqual(rel.currency, "INR")
            self.assertAlmostEqual(rel.amount, 3000.0, places=2)

            # Legacy foreign row (no stored rate): documented approximation —
            # face value converted at the current rate, never left mislabelled.
            tsla_buy = by_key[("TSLA", "BUY")]
            self.assertAlmostEqual(tsla_buy.amount, round(341.0 * 95.8, 2), places=2)

            # P&L replay: both TSLA legs at the same rate -> (350-341) x 95.8.
            pnl = routes._pnl_breakdown(1)
            self.assertAlmostEqual(pnl["capital_base"], 100_000.0, places=2)
            self.assertAlmostEqual(pnl["realized_pnl"], 9.0 * 95.8, places=2)

            # Legacy INR holding keeps its stored INR cost basis exactly.
            out = routes.get_portfolio(user={"id": 1})
            invested = {h.symbol: h.invested for h in out.holdings}
            self.assertAlmostEqual(invested["RELIANCE"], 3000.0, places=2)
            self.assertAlmostEqual(out.totals.value, 3000.0, places=2)
        finally:
            db_module.DB_PATH = original_path


if __name__ == "__main__":
    unittest.main()
