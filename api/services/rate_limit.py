"""
slowapi-based rate limiter, configured for the auth router.

Limits (per spec):
  - /auth/login    : 5回/分    (per IP)
  - /auth/register : 3回/時間  (per IP)
  - /auth/password-reset : 3回/時間 (per IP)
  - /auth/mfa/challenge  : 10回/分 (per IP)
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared Limiter instance. Routers import LIMITER and apply
# .limit("...") decorators. main.py registers the exception handler.
LIMITER = Limiter(key_func=get_remote_address)

# Limit strings (centralized so they're easy to tune)
LIMIT_LOGIN          = "5/minute"
LIMIT_REGISTER       = "3/hour"
LIMIT_PASSWORD_RESET = "3/hour"
LIMIT_MFA_CHALLENGE  = "10/minute"
LIMIT_EMAIL_VERIFY   = "10/hour"
