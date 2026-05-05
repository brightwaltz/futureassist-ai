"""
/api/auth/* — password認証 + JWT (P0)
                + email verification (P0)
                + password reset (P0 — 既存ユーザー移行用も兼ねる)
                + MFA (P1, 別ファイル: auth_mfa.py で追加)
                + Google OAuth (P2, 別ファイル: auth_oauth.py で追加)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.database import get_db
from api.dependencies import get_current_user, get_request_meta
from api.models.orm import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshToken,
    User,
)
from api.models.schemas import (
    AuthEmailVerify,
    AuthLogin,
    AuthMfaChallenge,
    AuthMfaRequiredResponse,
    AuthPasswordResetConfirm,
    AuthPasswordResetRequest,
    AuthRefresh,
    AuthRegister,
    AuthSimpleMessage,
    AuthTokenResponse,
    UserResponse,
)
from api.services import auth_service, email_service, totp_service
from api.services.rate_limit import (
    LIMIT_EMAIL_VERIFY,
    LIMIT_LOGIN,
    LIMIT_MFA_CHALLENGE,
    LIMIT_PASSWORD_RESET,
    LIMIT_REGISTER,
    LIMITER,
)
from api.models.schemas import (
    AuthMfaSetupResponse,
    AuthMfaVerify,
)
import jwt as _pyjwt  # for MFA challenge token decoding

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Helpers ──────────────────────────────────────────────────────────────

async def _build_token_response(
    db: AsyncSession,
    user: User,
    *,
    request_meta: dict,
    rotated_from_id: int | None = None,
) -> AuthTokenResponse:
    """Issue a fresh access+refresh token pair for a user."""
    access_token, expires_in = auth_service.issue_access_token(user.id)
    refresh_token = await auth_service.issue_refresh_token(
        db, user.id,
        user_agent=request_meta.get("user_agent"),
        ip_address=request_meta.get("ip_address"),
        rotated_from_id=rotated_from_id,
    )
    await auth_service.update_last_login(db, user.id)

    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


# ─── /auth/register ───────────────────────────────────────────────────────

@router.post("/register", response_model=AuthSimpleMessage, status_code=201)
@LIMITER.limit(LIMIT_REGISTER)
async def register(
    request: Request,
    data: AuthRegister,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user with email + password.
    Sends verification email. The user can log in immediately but their
    `email_verified` flag stays False until they click the link.
    """
    email_norm = data.email.strip().lower()
    existing = await auth_service.get_user_by_email(db, email_norm)
    if existing:
        # Don't leak account existence beyond the obvious /register endpoint.
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=data.name,
        email=email_norm,
        age_group=data.age_group,
        company=data.company,
        department=data.department,
        position=data.position,
        password_hash=auth_service.hash_password(data.password),
        auth_provider="password",
        email_verified=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Send verification email
    raw = auth_service.generate_url_safe_token(32)
    db.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=auth_service.hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    await db.flush()

    verify_url = f"{settings.frontend_url.rstrip('/')}/auth/verify-email?token={raw}"
    await email_service.send_email_verification(email_norm, user.name, verify_url)

    logger.info(f"[auth] registered user_id={user.id} email={email_norm}")
    return AuthSimpleMessage(
        ok=True,
        message="登録が完了しました。確認メールを送信しましたのでご確認ください。",
    )


# ─── /auth/login ──────────────────────────────────────────────────────────

@router.post("/login", response_model=None)
@LIMITER.limit(LIMIT_LOGIN)
async def login(
    request: Request,
    data: AuthLogin,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify email + password.
      - If MFA enabled:  return AuthMfaRequiredResponse
      - If MFA disabled: return AuthTokenResponse with JWT pair
    """
    email_norm = data.email.strip().lower()
    user = await auth_service.get_user_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=401, detail="メールまたはパスワードが正しくありません")

    # Existing legacy passwordless users: instruct them to use /auth/password-reset
    if user.auth_provider == "legacy_passwordless" or not user.password_hash:
        raise HTTPException(
            status_code=403,
            detail=(
                "このアカウントはパスワード設定が未完了です。"
                "パスワード再設定メールから設定を完了してください。"
            ),
        )

    if not auth_service.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="メールまたはパスワードが正しくありません")

    if user.mfa_enabled and user.totp_secret:
        return AuthMfaRequiredResponse(
            mfa_required=True,
            mfa_challenge_token=auth_service.issue_mfa_challenge_token(user.id),
        )

    return await _build_token_response(db, user, request_meta=get_request_meta(request))


# ─── /auth/refresh — rotation ─────────────────────────────────────────────

@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh(
    request: Request,
    data: AuthRefresh,
    db: AsyncSession = Depends(get_db),
):
    """
    Validate refresh token, rotate (revoke + issue new), return new pair.
    """
    rec = await auth_service.consume_refresh_token(db, data.refresh_token)
    if not rec:
        raise HTTPException(status_code=401, detail="invalid or expired refresh token")

    user = await auth_service.get_user_by_id(db, rec.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="user not found")

    return await _build_token_response(
        db, user,
        request_meta=get_request_meta(request),
        rotated_from_id=rec.id,
    )


# ─── /auth/logout ─────────────────────────────────────────────────────────

@router.post("/logout", response_model=AuthSimpleMessage)
async def logout(
    data: AuthRefresh,
    db: AsyncSession = Depends(get_db),
):
    """Revoke the supplied refresh token (idempotent)."""
    rec = await auth_service.consume_refresh_token(db, data.refresh_token)
    if rec:
        await auth_service.revoke_refresh_token(db, rec.id)
    return AuthSimpleMessage(ok=True, message="ログアウトしました。")


# ─── /auth/me ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


# ─── /auth/verify-email ───────────────────────────────────────────────────

@router.post("/verify-email", response_model=AuthSimpleMessage)
@LIMITER.limit(LIMIT_EMAIL_VERIFY)
async def verify_email(
    request: Request,
    data: AuthEmailVerify,
    db: AsyncSession = Depends(get_db),
):
    """
    Consume an email-verification token (single-use).
    """
    th = auth_service.hash_token(data.token)
    result = await db.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == th)
    )
    rec = result.scalar_one_or_none()

    if not rec or rec.consumed_at is not None or rec.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="無効または期限切れのトークンです")

    rec.consumed_at = datetime.now(timezone.utc)
    await db.execute(
        update(User).where(User.id == rec.user_id).values(email_verified=True)
    )
    await db.flush()

    return AuthSimpleMessage(ok=True, message="メールアドレスが確認されました。")


# ─── /auth/password-reset (request) ───────────────────────────────────────

@router.post("/password-reset", response_model=AuthSimpleMessage)
@LIMITER.limit(LIMIT_PASSWORD_RESET)
async def password_reset_request(
    request: Request,
    data: AuthPasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Always returns 200 to prevent user enumeration.
    Sends reset email if account exists.
    """
    email_norm = data.email.strip().lower()
    user = await auth_service.get_user_by_email(db, email_norm)

    if user:
        raw = auth_service.generate_url_safe_token(32)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=auth_service.hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ))
        await db.flush()

        reset_url = f"{settings.frontend_url.rstrip('/')}/auth/password-reset?token={raw}"
        # Use the legacy template for legacy users (more friendly wording)
        if user.auth_provider == "legacy_passwordless":
            await email_service.send_legacy_user_setup(email_norm, user.name, reset_url)
        else:
            await email_service.send_password_reset(email_norm, user.name, reset_url)
        logger.info(f"[auth] password reset issued user_id={user.id}")

    return AuthSimpleMessage(
        ok=True,
        message="メールアドレスが登録されている場合、パスワード再設定リンクを送信しました。",
    )


# ─── /auth/password-reset/confirm ────────────────────────────────────────

@router.post("/password-reset/confirm", response_model=AuthSimpleMessage)
async def password_reset_confirm(
    data: AuthPasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    th = auth_service.hash_token(data.token)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == th)
    )
    rec = result.scalar_one_or_none()

    if not rec or rec.consumed_at is not None or rec.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="無効または期限切れのトークンです")

    user = await auth_service.get_user_by_id(db, rec.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="ユーザーが見つかりません")

    user.password_hash = auth_service.hash_password(data.new_password)
    user.auth_provider = "password"  # promote legacy_passwordless to password
    user.email_verified = True       # confirming via email link is sufficient proof
    rec.consumed_at = datetime.now(timezone.utc)

    # Revoke all existing refresh tokens (security: force re-login on all devices)
    await auth_service.revoke_all_user_refresh_tokens(db, user.id)

    await db.flush()
    logger.info(f"[auth] password reset confirmed user_id={user.id}")

    return AuthSimpleMessage(ok=True, message="パスワードを再設定しました。再度ログインしてください。")


# ════════════════════════════════════════════════════════════════════════
# MFA (TOTP) — P1
# ════════════════════════════════════════════════════════════════════════

@router.post("/mfa/setup", response_model=AuthMfaSetupResponse)
async def mfa_setup(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a fresh TOTP secret + QR. Secret is saved tentatively;
    user must call /mfa/verify with a valid code to actually enable MFA.
    """
    secret, uri, qr = totp_service.setup(account_name=user.email or user.name)
    user.totp_secret = secret
    user.mfa_enabled = False  # not enabled until verify confirms
    await db.flush()
    return AuthMfaSetupResponse(secret=secret, otpauth_uri=uri, qr_code_data_url=qr)


@router.post("/mfa/verify", response_model=AuthSimpleMessage)
async def mfa_verify(
    data: AuthMfaVerify,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm the TOTP code matches the pending secret and enable MFA."""
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA setup not initiated")
    if not totp_service.verify_code(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="無効なコードです")
    user.mfa_enabled = True
    # Revoke all existing refresh tokens for security
    await auth_service.revoke_all_user_refresh_tokens(db, user.id)
    await db.flush()
    logger.info(f"[auth] MFA enabled user_id={user.id}")
    return AuthSimpleMessage(ok=True, message="MFAを有効化しました。再度ログインしてください。")


@router.post("/mfa/disable", response_model=AuthSimpleMessage)
async def mfa_disable(
    data: AuthMfaVerify,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Require a valid TOTP code to disable MFA (prevents accidental disable)."""
    if not user.mfa_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="MFAは有効化されていません")
    if not totp_service.verify_code(user.totp_secret, data.code):
        raise HTTPException(status_code=400, detail="無効なコードです")
    user.mfa_enabled = False
    user.totp_secret = None
    await db.flush()
    logger.info(f"[auth] MFA disabled user_id={user.id}")
    return AuthSimpleMessage(ok=True, message="MFAを無効化しました。")


@router.post("/mfa/challenge", response_model=AuthTokenResponse)
@LIMITER.limit(LIMIT_MFA_CHALLENGE)
async def mfa_challenge(
    request: Request,
    data: AuthMfaChallenge,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 of MFA login: present the mfa_challenge_token from /auth/login
    along with a 6-digit TOTP code → receive JWT pair.
    """
    try:
        payload = auth_service.decode_mfa_challenge_token(data.mfa_challenge_token)
    except _pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="MFAチャレンジが期限切れです。再度ログインしてください。")
    except _pyjwt.PyJWTError:
        raise HTTPException(status_code=400, detail="無効なMFAチャレンジトークンです")

    user_id = int(payload["sub"])
    user = await auth_service.get_user_by_id(db, user_id)
    if not user or not user.mfa_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA設定が見つかりません")

    if not totp_service.verify_code(user.totp_secret, data.code):
        raise HTTPException(status_code=401, detail="無効なコードです")

    return await _build_token_response(db, user, request_meta=get_request_meta(request))


# ════════════════════════════════════════════════════════════════════════
# Google OAuth — P2
# ════════════════════════════════════════════════════════════════════════

from fastapi.responses import RedirectResponse
from api.services import oauth_service


@router.get("/google")
async def google_authorize():
    """Redirect to Google's OAuth consent page."""
    if not settings.google_oauth_enabled:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")
    url, _state = oauth_service.authorize_url()
    return RedirectResponse(url=url, status_code=302)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Google's redirect-back. Exchange code → userinfo → create/link user
    → issue JWT pair → redirect to frontend with tokens in URL fragment.
    """
    if error:
        return RedirectResponse(
            url=f"{settings.frontend_url.rstrip('/')}/login?oauth_error={error}",
            status_code=302,
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="missing code or state")
    if not oauth_service.consume_state(state):
        raise HTTPException(status_code=400, detail="invalid state (CSRF protection)")

    userinfo = await oauth_service.exchange_code_for_userinfo(code)
    if not userinfo:
        raise HTTPException(status_code=400, detail="failed to fetch Google profile")

    user = await oauth_service.upsert_google_user(db, userinfo)

    # Issue tokens, then redirect to frontend with them in the fragment
    # (fragments don't reach servers/logs).
    token_resp = await _build_token_response(
        db, user, request_meta=get_request_meta(request)
    )
    redirect_url = (
        f"{settings.frontend_url.rstrip('/')}/auth/google/finish"
        f"#access_token={token_resp.access_token}"
        f"&refresh_token={token_resp.refresh_token}"
        f"&expires_in={token_resp.expires_in}"
    )
    return RedirectResponse(url=redirect_url, status_code=302)
