"""
Authentication primitives: password hashing + session tokens.

Passwords are NEVER stored in plaintext. We use PBKDF2-HMAC-SHA256 from the
standard library (no extra dependency, no plaintext anywhere):

    pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>

Sessions are opaque random bearer tokens stored server-side, so a stolen
token can be revoked and an expired/unknown token simply fails auth.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from db import db, utcnow

KDF = "pbkdf2_sha256"
ITERATIONS = 260_000
SESSION_TTL = timedelta(days=30)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 with a fresh random salt per password."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"{KDF}${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verification. Any malformed hash fails closed."""
    try:
        algo, iterations, salt_hex, digest_hex = stored.split("$")
        if algo != KDF:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------
def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with db() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, utcnow()),
        )
    return token


def revoke_session(token: str) -> None:
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _expired(created_at: str) -> bool:
    try:
        created = datetime.fromisoformat(created_at)
    except ValueError:
        return True
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - created > SESSION_TTL


def get_user_for_token(token: str):
    """The user row for a valid, unexpired session — or None."""
    with db() as conn:
        sess = conn.execute(
            "SELECT user_id, created_at FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if sess is None:
            return None
        if _expired(sess["created_at"]):
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?", (sess["user_id"],)
        ).fetchone()
        return user
