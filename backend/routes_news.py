"""
GET /api/news — real aggregated financial news.

Pipeline (services/news.py): trusted RSS feeds -> normalize -> validate ->
dedupe -> sort newest first -> cached 5 min. Source failures are logged; if
every source fails the endpoint answers 503 instead of ever falling back to
sample articles.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from models.news import NewsFeedOut
from services.news import NewsUnavailableError, get_news_bundle

logger = logging.getLogger("artha.news")
router = APIRouter()


@router.get("/api/news", response_model=NewsFeedOut)
def get_news(
    category: str = Query(default="all", description="all | market | company | economy | global"),
    limit: int = Query(default=40, ge=1, le=100),
) -> NewsFeedOut:
    try:
        bundle = get_news_bundle()
    except NewsUnavailableError as exc:
        # All providers failed -> honest unavailable state, never mock news.
        detail = "Live news is temporarily unavailable."
        from services.news import last_success

        last = last_success()
        if last:
            detail += f" Last successfully updated: {last[:16].replace('T', ' ')} IST."
        logger.warning("GET /api/news -> 503 (%s)", exc)
        raise HTTPException(status_code=503, detail=detail)

    articles = bundle["articles"]
    cat = category.strip().lower()
    if cat and cat != "all":
        wanted = cat.capitalize()  # "market" -> "Market"
        articles = [a for a in articles if a["category"] == wanted]

    return NewsFeedOut(
        articles=articles[:limit],
        updated_at=bundle["updated_at"],
        sources=bundle["sources"],
        total=len(articles),
    )
