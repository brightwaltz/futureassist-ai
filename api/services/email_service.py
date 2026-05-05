"""
Email service: send verification / password-reset emails via SMTP.

設定:
  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (Settings)
  - 未設定の場合は STDOUT へログ出力（開発用フォールバック）
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import Optional

import aiosmtplib

from api.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def _send_smtp(to: str, subject: str, body_text: str, body_html: Optional[str] = None) -> bool:
    """
    Sends a plain-text + optional HTML email via SMTP STARTTLS.
    Returns True on success. Falls back to logging if SMTP not configured.
    """
    if not settings.smtp_enabled:
        logger.warning(
            "[email_service] SMTP not configured; logging email instead.\n"
            f"To: {to}\nSubject: {subject}\n\n{body_text}"
        )
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=settings.smtp_use_tls,
        )
        logger.info(f"[email_service] sent: subject='{subject}' to={to}")
        return True
    except Exception as e:
        logger.error(f"[email_service] SMTP send failed to={to}: {e}")
        return False


# ─── Concrete email templates ─────────────────────────────────────────────

async def send_email_verification(to: str, name: str, verify_url: str) -> bool:
    subject = "【未来アシストAI】メールアドレス確認のお願い"
    body_text = (
        f"{name} 様\n\n"
        "未来アシストAI にご登録いただきありがとうございます。\n"
        "以下のリンクをクリックしてメールアドレスを確認してください（24時間有効）:\n\n"
        f"{verify_url}\n\n"
        "心当たりがない場合はこのメールを破棄してください。\n\n"
        "— 未来アシストAI 運営チーム"
    )
    body_html = f"""\
<!DOCTYPE html>
<html><body style="font-family: sans-serif; color: #333; max-width: 560px;">
  <p>{name} 様</p>
  <p>未来アシストAI にご登録いただきありがとうございます。<br>
  以下のボタンをクリックしてメールアドレスを確認してください（24時間有効）:</p>
  <p style="margin: 24px 0;">
    <a href="{verify_url}" style="display:inline-block;background:#0078c6;color:#fff;
       padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
      メールアドレスを確認する
    </a>
  </p>
  <p style="font-size: 12px; color: #666;">
    ボタンが動作しない場合は、以下のURLをコピーしてブラウザで開いてください:<br>
    <code>{verify_url}</code>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #999;">
    心当たりがない場合はこのメールを破棄してください。<br>
    — 未来アシストAI 運営チーム
  </p>
</body></html>
"""
    return await _send_smtp(to, subject, body_text, body_html)


async def send_password_reset(to: str, name: str, reset_url: str) -> bool:
    subject = "【未来アシストAI】パスワード再設定のご案内"
    body_text = (
        f"{name} 様\n\n"
        "パスワード再設定のリクエストを受け付けました。\n"
        "以下のリンクをクリックして新しいパスワードを設定してください（1時間有効）:\n\n"
        f"{reset_url}\n\n"
        "心当たりがない場合はこのメールを破棄してください。あなたのアカウントは安全です。\n\n"
        "— 未来アシストAI 運営チーム"
    )
    body_html = f"""\
<!DOCTYPE html>
<html><body style="font-family: sans-serif; color: #333; max-width: 560px;">
  <p>{name} 様</p>
  <p>パスワード再設定のリクエストを受け付けました。<br>
  以下のボタンをクリックして新しいパスワードを設定してください（1時間有効）:</p>
  <p style="margin: 24px 0;">
    <a href="{reset_url}" style="display:inline-block;background:#0078c6;color:#fff;
       padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
      パスワードを再設定する
    </a>
  </p>
  <p style="font-size: 12px; color: #666;">
    ボタンが動作しない場合は、以下のURLをコピーしてブラウザで開いてください:<br>
    <code>{reset_url}</code>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #999;">
    心当たりがない場合はこのメールを破棄してください。あなたのアカウントは安全です。<br>
    — 未来アシストAI 運営チーム
  </p>
</body></html>
"""
    return await _send_smtp(to, subject, body_text, body_html)


async def send_legacy_user_setup(to: str, name: str, reset_url: str) -> bool:
    """
    既存パスワードレスユーザー向け：パスワード設定の案内メール。
    """
    subject = "【未来アシストAI】パスワード設定のお願い（重要）"
    body_text = (
        f"{name} 様\n\n"
        "未来アシストAI のセキュリティ強化に伴い、ログイン方式が\n"
        "メールアドレス + パスワードに変更されました。\n\n"
        "お手数ですが、以下のリンクからパスワードを設定してください（1時間有効）:\n\n"
        f"{reset_url}\n\n"
        "— 未来アシストAI 運営チーム"
    )
    return await _send_smtp(to, subject, body_text)
