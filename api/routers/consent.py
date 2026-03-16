"""
Privacy consent management endpoints.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.orm import User, ConsentLogEntry
from api.models.schemas import ConsentRequest, ConsentResponse

router = APIRouter(prefix="/consent", tags=["consent"])


@router.post("/", response_model=ConsentResponse)
async def manage_consent(
    data: ConsentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Grant, revoke, or update user consent.
    All consent actions are logged in an audit trail.
    """
    # Find user
    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update consent status
    if data.action == "granted":
        user.consent_status = True
        user.consent_date = datetime.utcnow()
    elif data.action == "revoked":
        user.consent_status = False
    # "updated" keeps current status but logs the update

    user.privacy_version = data.privacy_version

    # Create audit log entry
    log_entry = ConsentLogEntry(
        user_id=data.user_id,
        action=data.action,
        scope=data.scope,
        privacy_version=data.privacy_version,
        ip_address=str(request.client.host) if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(log_entry)
    await db.flush()

    return ConsentResponse(
        success=True,
        user_id=data.user_id,
        consent_status=user.consent_status,
        action=data.action,
        recorded_at=datetime.utcnow(),
    )


@router.get("/status/{user_id}")
async def get_consent_status(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Check current consent status for a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user_id,
        "consent_status": user.consent_status,
        "consent_date": user.consent_date,
        "privacy_version": user.privacy_version,
    }


@router.get("/log/{user_id}")
async def get_consent_log(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve consent audit trail for a user."""
    result = await db.execute(
        select(ConsentLogEntry)
        .where(ConsentLogEntry.user_id == user_id)
        .order_by(ConsentLogEntry.created_at.desc())
    )
    logs = result.scalars().all()
    return [
        {
            "action": log.action,
            "scope": log.scope,
            "privacy_version": log.privacy_version,
            "created_at": log.created_at,
        }
        for log in logs
    ]
