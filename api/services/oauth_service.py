"""
Google OAuth 2.0 — authlib + httpx based.

Flow:
  GET  /auth/google           → server redirects to Google with state
  GET  /auth/google/callback  → exchange code → fetch userinfo → upsert user → JWT pair

Existing email-registered users are auto-linked by matching `email`.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.models.orm import User

logger = logging.getLogger(__name__)
settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ─── State token (CSRF防止用ワンタイム) ───────────────────────────────────
# 単一インスタンス前提なら in-memory set でOK。Render free tier 1 instance なので採用。
_pending_states: set[str] = set()


def generate_state() -> str:
    s = secrets.token_urlsafe(24)
    _pending_states.add(s)
    return s


def consume_state(state: str) -> bool:
    """Returns True if state was valid (and removes it)."""
    try:
        _pending_states.remove(state)
        return True
    except KeyError:
        return False


# ─── Authorization URL ────────────────────────────────────────────────────

def authorize_url() -> Tuple[str, str]:
    """Return (url, state) for redirecting user to Google's consent page."""
    if not settings.google_oauth_enabled:
        raise RuntimeError("Google OAuth is not configured")

    state = generate_state()
    params = {
        "client_id":     settings.google_client_id,
        "redirect_uri":  settings.google_redirect_url,
        "response_type": "code",
        "scope":         "openid email profile",
        "state":         state,
        "access_type":   "online",
        "prompt":        "select_account",
    }
    qs = "&".join(f"{k}={httpx.QueryParams({k: v}).get(k)}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{qs}", state


# ─── Code exchange + userinfo ────────────────────────────────────────────

async def exchange_code_for_userinfo(code: str) -> Optional[dict]:
    """
    Exchange auth code → access_token → userinfo.
    Returns userinfo dict {sub, email, email_verified, name, picture, ...} or None.
    """
    if not settings.google_oauth_enabled:
        return None

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            tok_res = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code":          code,
                    "client_id":     settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri":  settings.google_redirect_url,
                    "grant_type":    "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
            if tok_res.status_code != 200:
                logger.error(f"[oauth] token exchange failed: {tok_res.status_code} {tok_res.text[:200]}")
                return None
            access_token = tok_res.json().get("access_token")
            if not access_token:
                return None

            ui_res = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if ui_res.status_code != 200:
                logger.error(f"[oauth] userinfo failed: {ui_res.status_code}")
                return None
            return ui_res.json()
        except httpx.HTTPError as e:
            logger.error(f"[oauth] HTTP error: {e}")
            return None


# ─── Upsert user from Google profile ─────────────────────────────────────

async def upsert_google_user(db: AsyncSession, userinfo: dict) -> User:
    """
    Find or create a User from a Google userinfo dict.
    - If google_id matches → return existing
    - Else if email matches → link google_id + return
    - Else create new user with auth_provider='google'
    """
    google_id = userinfo.get("sub")
    email = (userinfo.get("email") or "").lower()
    name = userinfo.get("name") or email.split("@")[0] or "Google User"
    email_verified = bool(userinfo.get("email_verified", False))

    if not google_id:
        raise ValueError("Google userinfo missing 'sub'")

    # 1) match by google_id
    res = await db.execute(select(User).where(User.google_id == google_id))
    user = res.scalar_one_or_none()
    if user:
        user.last_login_at = datetime.now(timezone.utc)
        await db.flush()
        return user

    # 2) match by email (auto-link)
    if email:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if user:
            user.google_id = google_id
            if email_verified and not user.email_verified:
                user.email_verified = True
            user.last_login_at = datetime.now(timezone.utc)
            await db.flush()
            logger.info(f"[oauth] linked google_id to existing user_id={user.id}")
            return user

    # 3) create new
    user = User(
        name=name,
        email=email or None,
        company="",  # required by schema, but Google doesn't provide it
        google_id=google_id,
        email_verified=email_verified,
        auth_provider="google",
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    logger.info(f"[oauth] created google user_id={user.id} email={email}")
    return user
