"""
HEROIC Data Integration Service.
Handles encryption, storage, and transmission of data to HEROIC platform.
"""
import logging
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.models.orm import HeroicData, User, Survey, MetricsLogEntry
from api.utils.encryption import get_encryptor

logger = logging.getLogger(__name__)
settings = get_settings()


class HeroicService:
    """Service for HEROIC data collection and transmission."""

    def __init__(self, db: AsyncSession):
        self.db = db
        if settings.heroic_encryption_key:
            self.encryptor = get_encryptor(settings.heroic_encryption_key)
        else:
            self.encryptor = None

    async def prepare_user_payload(self, user_id: int) -> dict:
        """
        Collect and aggregate user data for HEROIC transmission.
        Anonymizes identifiable data before encryption.
        """
        # Fetch user (anonymized)
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")

        if not user.consent_status:
            raise PermissionError("User has not consented to HEROIC data sharing")

        # Fetch latest survey data
        surveys_result = await self.db.execute(
            select(Survey)
            .where(Survey.user_id == user_id)
            .order_by(Survey.created_at.desc())
            .limit(5)
        )
        surveys = surveys_result.scalars().all()

        # Fetch latest metrics
        metrics_result = await self.db.execute(
            select(MetricsLogEntry)
            .where(MetricsLogEntry.user_id == user_id)
            .order_by(MetricsLogEntry.updated_at.desc())
            .limit(1)
        )
        latest_metrics = metrics_result.scalar_one_or_none()

        # Build anonymized payload
        payload = {
            "anonymous_id": str(user.external_id),
            "age_group": user.age_group,
            "collection_date": datetime.utcnow().isoformat(),
            "surveys": [
                {
                    "type": s.survey_type,
                    "life_ability_score": s.life_ability_score,
                    "satisfaction_score": s.satisfaction_score,
                    "date": s.created_at.isoformat() if s.created_at else None,
                }
                for s in surveys
            ],
            "metrics": {
                "chat_frequency": latest_metrics.chat_frequency if latest_metrics else None,
                "stress_level": latest_metrics.stress_level if latest_metrics else None,
                "energy_level": latest_metrics.energy_level if latest_metrics else None,
                "disposable_income": latest_metrics.disposable_income if latest_metrics else None,
                "disposable_time": latest_metrics.disposable_time if latest_metrics else None,
            } if latest_metrics else {},
        }

        return payload

    async def encrypt_and_store(self, user_id: int) -> int:
        """
        Encrypt user payload and store for transmission.
        Returns the heroic_data record ID.
        """
        if not self.encryptor:
            raise RuntimeError("HEROIC encryption key not configured")

        payload = await self.prepare_user_payload(user_id)
        encrypted_bytes, salt = self.encryptor.encrypt(payload)

        record = HeroicData(
            user_id=user_id,
            payload_encrypted=encrypted_bytes,
            salt=salt,
            transmitted=False,
        )
        self.db.add(record)
        await self.db.flush()

        return record.id

    async def transmit_pending(self) -> dict:
        """
        Transmit all pending (untransmitted) HEROIC data records.
        Returns summary of transmission results.
        """
        result = await self.db.execute(
            select(HeroicData)
            .where(HeroicData.transmitted == False)
            .where(HeroicData.retry_count < 3)
        )
        pending = result.scalars().all()

        transmitted = 0
        errors = []

        for record in pending:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{settings.heroic_api_url}/upload",
                        headers={
                            "Authorization": f"Bearer {settings.heroic_api_key}",
                            "Content-Type": "application/octet-stream",
                        },
                        content=record.payload_encrypted,
                    )
                    response.raise_for_status()

                record.transmitted = True
                record.transmitted_at = datetime.utcnow()
                transmitted += 1

            except Exception as e:
                record.retry_count += 1
                record.error_message = str(e)
                errors.append(f"Record {record.id}: {str(e)}")
                logger.error(f"HEROIC transmission failed for record {record.id}: {e}")

        await self.db.flush()

        return {
            "success": len(errors) == 0,
            "records_transmitted": transmitted,
            "errors": errors,
        }
