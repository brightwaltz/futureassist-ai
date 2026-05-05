"""
Authentication service: password hashing, JWT issue/verify, refresh token rotation.

セキュリティ方針:
  - パスワード: bcrypt (cost=12)
  - JWT: HS256 with settings.jwt_signing_key
  - access_token: 15分（settings.jwt_access_ttl_min）
  - refresh_token: 7日（settings.jwt_refresh_ttl_days）、使用時にローテーション
  - refresh_token は DB に SHA-256 ハッシュで保存。生のトークンは戻り値のみ。
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import uuid4

import bcrypt
import jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.models.orm import RefreshToken, User

settings = get_settings()


# ─── Password hashing ─────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """bcrypt hash. Cost=12 default."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ─── Generic random token (URL-safe, 32 bytes) ───────────────────────────

def generate_url_safe_token(num_bytes: int = 32) -> str:
    """Cryptographically random URL-safe token."""
    return secrets.token_urlsafe(num_bytes)


def hash_token(raw_token: str) -> str:
    """SHA-256 hex of a token. For storing refresh / verify / reset tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ─── JWT (access token) ──────────────────────────────────────────────────

def issue_access_token(user_id: int, *, extra_claims: Optional[dict] = None) -> Tuple[str, int]:
    """
    Returns (access_token, expires_in_seconds).
    Subject = user_id (int).
    """
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_access_ttl_min)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "type": "access",
        "jti": str(uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.jwt_signing_key, algorithm=settings.jwt_algorithm)
    return token, settings.jwt_access_ttl_min * 60


def decode_access_token(token: str) -> dict:
    """Returns the JWT payload. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.jwt_signing_key, algorithms=[settings.jwt_algorithm])


# ─── Refresh tokens (DB-backed, rotated on use) ──────────────────────────

async def issue_refresh_token(
    db: AsyncSession,
    user_id: int,
    *,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
    rotated_from_id: Optional[int] = None,
) -> str:
    """
    Generate a refresh token, store hash in DB, return the raw token.
    """
    raw = generate_url_safe_token(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_ttl_days)
    rec = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw),
        expires_at=expires_at,
        user_agent=(user_agent or "")[:500],
        ip_address=(ip_address or "")[:64],
    )
    db.add(rec)
    await db.flush()

    if rotated_from_id is not None:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.id == rotated_from_id)
            .values(rotated_to=rec.id, revoked_at=datetime.now(timezone.utc))
        )

    return raw


async def consume_refresh_token(
    db: AsyncSession,
    raw_token: str,
) -> Optional[RefreshToken]:
    """
    Validate a raw refresh token. Returns the matching DB row or None.
    Does NOT revoke — caller decides (typically rotates immediately).
    """
    th = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == th)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        return None
    if rec.revoked_at is not None:
        return None
    if rec.expires_at < datetime.now(timezone.utc):
        return None
    return rec


async def revoke_refresh_token(db: AsyncSession, token_id: int) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == token_id)
        .values(revoked_at=datetime.now(timezone.utc))
    )


async def revoke_all_user_refresh_tokens(db: AsyncSession, user_id: int) -> int:
    """Used on logout-all / password change. Returns rows revoked."""
    result = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    return result.rowcount or 0


# ─── User lookup helper ──────────────────────────────────────────────────

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def update_last_login(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(last_login_at=datetime.now(timezone.utc))
    )


# ─── Short-lived MFA challenge token (signed, no DB) ─────────────────────

def issue_mfa_challenge_token(user_id: int, ttl_seconds: int = 300) -> str:
    """
    A short-lived JWT-signed token used between password verify and MFA verify.
    Type='mfa_challenge', expires in 5 minutes.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "type": "mfa_challenge",
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_signing_key, algorithm=settings.jwt_algorithm)


def decode_mfa_challenge_token(token: str) -> dict:
    payload = jwt.decode(token, settings.jwt_signing_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "mfa_challenge":
        raise jwt.InvalidTokenError("not a mfa_challenge token")
    return payload
