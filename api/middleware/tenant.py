"""
Tenant resolution middleware.
Resolves tenant from URL path /t/{slug}/... or subdomain, falls back to 'default'.
"""
import logging
import re
from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy import select

from api.database import async_session
from api.models.orm import Tenant, DEFAULT_TENANT_ID

logger = logging.getLogger(__name__)

# Match /t/{slug}/... pattern at the start of the path
_TENANT_PATH_RE = re.compile(r"^/t/([a-zA-Z0-9_-]+)(/.*)?$")


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_id = None
        tenant_slug = None

        # 1. Try path-based resolution: /t/{slug}/...
        match = _TENANT_PATH_RE.match(request.url.path)
        if match:
            tenant_slug = match.group(1)

        # 2. Try subdomain-based resolution
        if not tenant_slug:
            host = request.headers.get("host", "")
            parts = host.split(".")
            if len(parts) >= 3:
                candidate = parts[0]
                if candidate not in ("www", "api"):
                    tenant_slug = candidate

        # 3. Resolve slug → tenant_id
        if tenant_slug:
            try:
                async with async_session() as db:
                    result = await db.execute(
                        select(Tenant.id).where(Tenant.slug == tenant_slug)
                    )
                    row = result.scalar_one_or_none()
                    if row:
                        tenant_id = row
            except Exception:
                logger.warning(f"Failed to resolve tenant slug: {tenant_slug}")

        # 4. Fallback to default tenant
        if not tenant_id:
            tenant_id = UUID(DEFAULT_TENANT_ID)
            tenant_slug = "default"

        request.state.tenant_id = tenant_id
        request.state.tenant_slug = tenant_slug

        response = await call_next(request)
        return response
