"""Minimal in-memory TTL cache — enough to avoid re-hitting the provider
on every frontend render. Deliberately simple (single process, academic demo)."""

from __future__ import annotations

import time
from typing import Any, Callable, Hashable

_store: dict[Hashable, tuple[float, Any]] = {}


def cached(key: Hashable, ttl_seconds: float, producer: Callable[[], Any]) -> Any:
    """Return the cached value if fresh, otherwise call `producer()` and store it."""
    now = time.monotonic()
    hit = _store.get(key)
    if hit is not None and now - hit[0] < ttl_seconds:
        return hit[1]
    value = producer()
    _store[key] = (now, value)
    return value


def clear() -> None:
    _store.clear()
