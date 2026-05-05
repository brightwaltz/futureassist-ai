"""
TOTP (RFC 6238) MFA service via pyotp.

- secret は base32 で users.totp_secret に保存
- otpauth URI を生成し QR コードを data:URL で返す
- 30秒ステップ、6桁、SHA-1（pyotp default）
- 検証時は前後1ステップを許容（時計ずれ対策）
"""
from __future__ import annotations

import base64
import io
from typing import Tuple

import pyotp
import qrcode

ISSUER = "未来アシストAI"


def generate_secret() -> str:
    """Random base32 secret. 160 bits."""
    return pyotp.random_base32()


def make_provisioning_uri(secret: str, account_name: str) -> str:
    """otpauth://totp/...?secret=...&issuer=... — feed into authenticator app."""
    return pyotp.TOTP(secret).provisioning_uri(name=account_name, issuer_name=ISSUER)


def make_qr_data_url(otpauth_uri: str) -> str:
    """Return a base64 data:image/png;base64,... QR for the otpauth URI."""
    img = qrcode.make(otpauth_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def setup(account_name: str) -> Tuple[str, str, str]:
    """
    Returns (secret, otpauth_uri, qr_data_url).
    Caller must persist `secret` to users.totp_secret only AFTER verification.
    """
    secret = generate_secret()
    uri = make_provisioning_uri(secret, account_name)
    qr = make_qr_data_url(uri)
    return secret, uri, qr


def verify_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify a TOTP code with ±valid_window 30s steps tolerance."""
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit() or len(code) not in (6, 7, 8):
        return False
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=valid_window)
    except Exception:
        return False
