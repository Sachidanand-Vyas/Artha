"""
News aggregation — REAL headlines from trusted publishers' official RSS feeds.

Architecture (owned by the backend; the frontend never hardcodes articles):

    trusted RSS feeds  ->  parallel fetch (per-source failure isolated)
    ->  normalize (title / source / original URL / publishedAt / category)
    ->  validate URLs (must belong to the publishing domain)
    ->  drop undated or stale items (no fabricated or recycled dates)
    ->  dedupe (URL + headline)  ->  sort newest first
    ->  cache (5 min)  ->  GET /api/news

Only each publisher's own published RSS feed is used (no scraping, no
third-party mirror). If EVERY source fails, `get_news_bundle()` raises
NewsUnavailableError so the API can answer 503 — there is no path where a
failed fetch silently returns sample articles.

Verified feed allowlist (probed live on 2026-09-23; every feed below was
returning fresh items hours old):

  - Economic Times   top stories + markets   rssfeedstopstories.cms,
                                             rssfeeds/1977021501.cms
  - Mint             news + markets + companies   livemint.com/rss/*
  - Business Standard  markets               rss/markets-106.rss

Deliberately NOT included, after checking (never claim what isn't wired):
  - Reuters        : no public RSS/API feed is offered anymore.
  - CNBC-TV18      : /rss paths return HTML, not feeds.
  - Moneycontrol   : its RSS feeds are abandoned (newest items 2016 / 2024).
  - NSE / RBI      : no working public RSS endpoint reachable programmatically.
"""

from __future__ import annotations

import email.utils
import hashlib
import html as html_lib
import logging
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests

from utils import cache

logger = logging.getLogger("artha.news")

NEWS_TTL = 300.0          # seconds — short cache so "Updated …" stays honest
FETCH_TIMEOUT = (5, 10)   # (connect, read) seconds per feed
MAX_AGE = timedelta(days=10)      # drop recycling: feeds serving ancient items
MAX_FUTURE_SKEW = timedelta(days=1)

IST = timezone(timedelta(hours=5, minutes=30))

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
}


class NewsUnavailableError(RuntimeError):
    """Every configured source failed or produced nothing usable."""


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    domain: str              # article links must belong to this domain
    category: Optional[str]  # None => mixed feed, classify per article


SOURCES: tuple[Source, ...] = (
    Source(
        "Economic Times",
        "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
        "economictimes.indiatimes.com",
        None,
    ),
    Source(
        "Economic Times",
        "https://economictimes.indiatimes.com/rssfeeds/1977021501.cms",
        "economictimes.indiatimes.com",
        "Market",
    ),
    Source("Mint", "https://www.livemint.com/rss/news", "livemint.com", None),
    Source("Mint", "https://www.livemint.com/rss/markets", "livemint.com", "Market"),
    Source("Mint", "https://www.livemint.com/rss/companies", "livemint.com", "Company"),
    Source(
        "Business Standard",
        "https://www.business-standard.com/rss/markets-106.rss",
        "business-standard.com",
        "Market",
    ),
)

CATEGORIES = ("Market", "Company", "Economy", "Global")

# ---------------------------------------------------------------------------
# Category classification for MIXED feeds (top stories / general news).
# Deterministic keyword match over the real headline + description, checked in
# priority order. Unmatched business-paper stories fall back to "Economy".
# ---------------------------------------------------------------------------
_GLOBAL = re.compile(
    r"\b(federal reserve|\bfed\b|wall street|nasdaq|dow jones|\bs&p\b|trump|"
    r"american|europe|european|china|chinese|beijing|japan|tokyo|britain|"
    r"london|new york|crude|brent|\bdollar\b|\beuro\b|iran|ukraine|oil price|"
    r"\bimf\b|world bank|global|overseas)\b",
    re.IGNORECASE,
)
_GLOBAL_CASE = re.compile(r"\b(US|UK|EU)\b")  # short tokens: uppercase only
_ECONOMY = re.compile(
    r"\b(rbi|repo rate|gdp|inflation|cpi|iip|wpi|gst|fiscal|budget|monetary|"
    r"rate cut|interest rate|banking|banks?|\bnpa|liquidity|economy|economic|"
    r"government|govt|\btax|tariff|duty|duties|customs|deficit|stimulus|"
    r"trade deal|recession|jobs data|unemployment)\b",
    re.IGNORECASE,
)
_COMPANY = re.compile(
    r"\b(q[1-4]|results?|earnings|profit|revenue|dividend|ipos?|acquisition|"
    r"merger|stake|allot|subsidiary|buyback|guidance|order win|bags|wins|"
    r"to raise|filed)\b",
    re.IGNORECASE,
)
_MARKET = re.compile(
    r"\b(sensex|nifty|stocks?|shares?|markets?|equity|trading|traders|indices|"
    r"index|investors?|fii|dii|sebi|mutual funds?|\bsip\b|brokers?|brokerage|"
    r"listing|portfolio)\b",
    re.IGNORECASE,
)


def classify(title: str, description: str, fallback: str = "Economy") -> str:
    text = f"{title} {description}"
    if _GLOBAL.search(text) or _GLOBAL_CASE.search(text):
        return "Global"
    if _ECONOMY.search(text):
        return "Economy"
    if _COMPANY.search(text):
        return "Company"
    if _MARKET.search(text):
        return "Market"
    return fallback


# ---------------------------------------------------------------------------
# XML parsing (RSS 2.0 + Atom) with the standard library — no extra deps.
# ---------------------------------------------------------------------------
def _local(tag: str) -> str:
    return tag.split("}", 1)[-1]


def _child_text(el: ET.Element, names: tuple[str, ...]) -> str:
    for child in el:
        if _local(child.tag) in names and child.text and child.text.strip():
            return child.text.strip()
    return ""


def _parse_date(raw: str) -> Optional[datetime]:
    if not raw:
        return None
    s = raw.strip()
    s = re.sub(r"(?i)\bSept\b", "Sep", s)  # Mint writes "Sept"
    try:
        dt = email.utils.parsedate_to_datetime(s)
    except Exception:
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _strip_html(raw: str, limit: int = 280) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html_lib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > 40 else cut).rstrip() + "…"


def _valid_http_url(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    return parts.scheme in ("http", "https") and bool(parts.netloc)


def _domain_ok(url: str, domain: str) -> bool:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return False
    return host == domain or host.endswith("." + domain)


def _item_image(item: ET.Element) -> Optional[str]:
    for child in item:
        local = _local(child.tag)
        if local in ("enclosure", "content", "thumbnail"):
            url = child.get("url") or child.get("href") or ""
            if url.startswith("http"):
                return url
    return None


def _parse_feed(content: bytes) -> list[ET.Element]:
    root = ET.fromstring(content)
    items = [el for el in root.iter() if _local(el.tag) in ("item", "entry")]
    return items


def _extract(item: ET.Element) -> dict[str, Any]:
    title = _strip_html(_child_text(item, ("title",)), 400)
    link = _child_text(item, ("link",))
    if not link:  # Atom uses <link href=…/>
        for child in item:
            if _local(child.tag) == "link" and child.get("href"):
                link = child.get("href", "")
                break
    if not link:
        guid = _child_text(item, ("guid", "id"))
        if guid.startswith("http"):
            link = guid
    description = _strip_html(
        _child_text(item, ("description", "summary", "content"))
    )
    published_raw = _child_text(
        item, ("pubDate", "published", "updated", "date", "dc:date")
    )
    return {
        "title": title,
        "url": link.strip(),
        "description": description,
        "image": _item_image(item),
        "published_raw": published_raw,
    }


# ---------------------------------------------------------------------------
# Headline -> ticker association (best effort, only when certain).
# Matches the tracked universe's full company name or exact symbol as whole
# words — nothing invented when there is no confident match.
# ---------------------------------------------------------------------------
_symbol_patterns: Optional[list[tuple[str, re.Pattern]]] = None


def _ticker_patterns() -> list[tuple[str, re.Pattern]]:
    global _symbol_patterns
    if _symbol_patterns is None:
        patterns: list[tuple[str, re.Pattern]] = []
        try:
            from services.universe import list_universe

            for row in list_universe():
                symbol = str(row.get("symbol", "")).upper()
                name = str(row.get("name", "")).strip().rstrip(" .,")
                if not symbol:
                    continue
                if name and len(name) >= 5:
                    patterns.append(
                        (symbol, re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE))
                    )
                if len(symbol) >= 3:
                    patterns.append((symbol, re.compile(rf"\b{re.escape(symbol)}\b")))
        except Exception:  # universe unavailable -> no ticker hints, still honest
            logger.warning("news: universe unavailable for ticker association")
        _symbol_patterns = patterns
    return _symbol_patterns


def match_tickers(title: str, description: str) -> list[str]:
    text = f"{title} {description}"
    hits: list[str] = []
    for symbol, pattern in _ticker_patterns():
        if pattern.search(text) and symbol not in hits:
            hits.append(symbol)
        if len(hits) >= 6:
            break
    return hits


# ---------------------------------------------------------------------------
# Fetch + normalize one source
# ---------------------------------------------------------------------------
def _normalize_url(url: str) -> str:
    """Canonical form for dedupe: drop tracking params, keep real ones."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return url
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in ("fbclid", "gclid", "ref")
    ]
    return urlunsplit(
        (parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), urlencode(query), "")
    )


def _fetch_source(
    src: Source,
) -> tuple[Source, list[dict[str, Any]], Optional[str]]:
    try:
        resp = requests.get(src.url, headers=_HEADERS, timeout=FETCH_TIMEOUT)
        resp.raise_for_status()
        raw_items = _parse_feed(resp.content)
    except Exception as exc:  # network / HTTP / XML failure -> isolated here
        return src, [], f"{type(exc).__name__}: {exc}"

    now = datetime.now(timezone.utc)
    out: list[dict[str, Any]] = []
    for item in raw_items:
        data = _extract(item)
        title, url = data["title"], data["url"]
        if not title or not _valid_http_url(url) or not _domain_ok(url, src.domain):
            continue  # never emit an unvalidated / off-domain URL
        when = _parse_date(data["published_raw"])
        if when is None:
            continue  # no fabricated publication times
        age = now - when
        if age > MAX_AGE or age < -MAX_FUTURE_SKEW:
            continue  # stale or bogus date -> drop rather than recycle
        category = src.category or classify(title, data["description"])
        out.append(
            {
                "id": hashlib.sha1(url.encode("utf-8")).hexdigest()[:16],
                "title": title,
                "source": src.name,
                "url": url,
                "published_at": when.isoformat(),
                "_epoch": when.timestamp(),
                "category": category,
                "description": data["description"],
                "image": data["image"],
                "tickers": match_tickers(title, data["description"]),
            }
        )
    return src, out, None


# ---------------------------------------------------------------------------
# Aggregate: fetch all sources in parallel, dedupe, sort newest first
# ---------------------------------------------------------------------------
def _aggregate() -> dict[str, Any]:
    with ThreadPoolExecutor(max_workers=len(SOURCES)) as pool:
        results = list(pool.map(_fetch_source, SOURCES))

    articles: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    source_status: list[dict[str, Any]] = []
    failures: list[str] = []

    for src, items, error in results:
        if error is not None:
            logger.warning("news source failed: %s (%s) -> %s", src.name, src.url, error)
            failures.append(f"{src.name}: {error}")
            source_status.append(
                {"name": src.name, "feed": src.url, "status": "failed", "count": 0, "detail": error[:200]}
            )
            continue
        kept = 0
        for article in items:
            key_url = _normalize_url(article["url"])
            key_title = re.sub(r"[^a-z0-9]+", " ", article["title"].lower()).strip()
            if key_url in seen_urls or (key_title and key_title in seen_titles):
                continue
            seen_urls.add(key_url)
            if key_title:
                seen_titles.add(key_title)
            article.pop("_epoch", None)
            articles.append(article)
            kept += 1
        source_status.append(
            {"name": src.name, "feed": src.url, "status": "ok", "count": kept, "detail": ""}
        )
        if kept == 0:
            logger.warning("news source returned 0 usable items: %s (%s)", src.name, src.url)

    if not articles:
        reason = "; ".join(failures) or "all sources returned no usable articles"
        logger.error("news unavailable — no articles from any source: %s", reason)
        raise NewsUnavailableError(reason)

    articles.sort(key=lambda a: a["published_at"], reverse=True)
    return {
        "articles": articles,
        "updated_at": datetime.now(IST).isoformat(),
        "sources": source_status,
    }


_last_success: Optional[str] = None


def last_success() -> Optional[str]:
    """ISO timestamp of the last successful aggregation (for the 503 detail)."""
    return _last_success


def get_news_bundle() -> dict[str, Any]:
    """
    Cached aggregate. Successes are cached for NEWS_TTL seconds; failures are
    NEVER cached, so the frontend's Retry actually re-fetches.
    """
    global _last_success

    def produce() -> dict[str, Any]:
        global _last_success
        bundle = _aggregate()
        _last_success = bundle["updated_at"]
        return bundle

    return cache.cached(("news", "bundle"), NEWS_TTL, produce)
