"""Pydantic response models for GET /api/news (real aggregated RSS articles)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class NewsArticleOut(BaseModel):
    """One real headline pulled from a publisher's own RSS feed."""

    id: str
    title: str
    source: str
    url: str  # ORIGINAL article URL — the UI opens this
    published_at: str  # ISO 8601 with timezone, straight from the feed
    category: Literal["Market", "Company", "Economy", "Global"]
    description: str = ""  # publisher-provided excerpt, may be empty (never invented)
    image: Optional[str] = None  # feed-provided image when legitimately present
    tickers: list[str] = Field(default_factory=list)  # best-effort association


class NewsSourceStatus(BaseModel):
    """Per-source fetch outcome — failures stay visible (and are logged)."""

    name: str
    feed: str
    status: Literal["ok", "failed"]
    count: int
    detail: str = ""


class NewsFeedOut(BaseModel):
    articles: list[NewsArticleOut]
    updated_at: str  # ISO timestamp of the actual fetch behind this cache entry
    sources: list[NewsSourceStatus]
    total: int  # articles matching the requested category before `limit`
