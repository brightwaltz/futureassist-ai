"""
HEROIC data integration endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.schemas import HeroicUploadResponse
from api.services.heroic_service import HeroicService

router = APIRouter(prefix="/api/heroic", tags=["heroic"])


@router.post("/prepare/{user_id}", status_code=201)
async def prepare_heroic_data(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Encrypt and store user data for HEROIC transmission.
    Requires user consent to be granted.
    """
    service = HeroicService(db)
    try:
        record_id = await service.encrypt_and_store(user_id)
        return {"success": True, "record_id": record_id}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=HeroicUploadResponse)
async def transmit_heroic_data(
    db: AsyncSession = Depends(get_db),
):
    """
    Transmit all pending encrypted data records to HEROIC.
    Retries up to 3 times per record on failure.
    """
    service = HeroicService(db)
    result = await service.transmit_pending()
    return HeroicUploadResponse(**result)
