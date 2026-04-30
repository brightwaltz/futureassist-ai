"""
ROI・人的資本指標 API v3.0

管理者向けROI算出・ダッシュボード集計エンドポイント。
Basic Auth必須（admin.pyのverify_adminを再利用）。
"""
import logging
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.routers.admin import verify_admin, _resolve_tenant
from api.services.roi_calculator import RoiCalculator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/roi", tags=["roi"])


# ─── Request schemas ───

class RoiCalculateRequest(BaseModel):
    tenant_slug: str
    period_start: date
    period_end: date
    avg_daily_wage_jpy: float = Field(..., gt=0, description="平均日給（円）")
    intervention_cost_jpy: float = Field(..., ge=0, description="介入コスト（円）")
    headcount_override: Optional[int] = Field(None, gt=0, description="対象人数（省略時はDBから自動取得）")
    before_period_start: Optional[date] = Field(None, description="介入前期間の開始日")
    before_period_end: Optional[date] = Field(None, description="介入前期間の終了日")


# ─── Endpoints ───

@router.get("/summary")
async def get_roi_summary(
    tenant_slug: str = Query(..., description="テナントスラッグ"),
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    テナントの最新ROI記録を取得する。
    """
    tenant_id = await _resolve_tenant(tenant_slug, db)
    calc = RoiCalculator(db)
    roi = await calc.get_latest_roi(tenant_id)

    if not roi:
        return {
            "message": "ROIデータがまだありません。/roi/calculate で算出してください。",
            "data": None,
        }

    return {"data": roi}


@router.post("/calculate")
async def calculate_roi(
    body: RoiCalculateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    ROIを算出してDBに保存する（管理者専用）。

    Life Abilityスコア履歴からプレゼンティーイズム・アブセンティーイズム損失を推定し、
    介入ROIを算出する。
    """
    tenant_id = await _resolve_tenant(body.tenant_slug, db)

    try:
        calc = RoiCalculator(db)
        roi = await calc.calculate_and_save(
            tenant_id=tenant_id,
            period_start=body.period_start,
            period_end=body.period_end,
            avg_daily_wage_jpy=body.avg_daily_wage_jpy,
            intervention_cost_jpy=body.intervention_cost_jpy,
            headcount_override=body.headcount_override,
            before_period_start=body.before_period_start,
            before_period_end=body.before_period_end,
        )
        await db.commit()
        return {
            "message": "ROI算出完了",
            "data": roi.to_dict(),
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"ROI calculation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-analytics")
async def get_dashboard_analytics(
    tenant_slug: str = Query(..., description="テナントスラッグ"),
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    K-匿名化済みダッシュボード集計データを取得する（K=5）。

    5人未満のセグメントは自動的に除外されプライバシーを保護。
    """
    tenant_id = await _resolve_tenant(tenant_slug, db)

    result = await db.execute(
        text("""
            SELECT
                age_group, department,
                headcount,
                avg_s1, avg_s2, avg_s3, avg_s4, avg_s5,
                avg_composite, avg_ema,
                latest_score_at
            FROM dashboard_analytics
            WHERE tenant_id = :tenant_id
            ORDER BY avg_composite DESC NULLS LAST
        """),
        {"tenant_id": str(tenant_id)},
    )
    rows = result.fetchall()

    return {
        "tenant_id": str(tenant_id),
        "k_anonymity_threshold": 5,
        "segments": [
            {
                "age_group": r[0],
                "department": r[1],
                "headcount": r[2],
                "avg_s1_info_org": r[3],
                "avg_s2_decision": r[4],
                "avg_s3_action": r[5],
                "avg_s4_stability": r[6],
                "avg_s5_resource": r[7],
                "avg_composite": r[8],
                "avg_ema": r[9],
                "latest_score_at": r[10].isoformat() if r[10] else None,
            }
            for r in rows
        ],
        "note": "5人未満のセグメントは個人特定防止のため除外されています",
    }


@router.post("/refresh-analytics")
async def refresh_dashboard_analytics(
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    dashboard_analyticsマテリアライズドビューを手動でリフレッシュする。
    """
    try:
        await db.execute(
            text("REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_analytics")
        )
        await db.commit()
        return {"message": "ダッシュボード集計ビューをリフレッシュしました"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Materialized view refresh failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/life-ability/user/{user_id}")
async def get_user_la_score(
    user_id: int,
    limit: int = Query(default=30, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """
    ユーザーのLife Abilityスコア履歴を取得する（管理者向け）。
    external_idベースで参照するため内部IDは露出しない。
    """
    from api.services.life_ability_scorer import LifeAbilityScorer

    scorer = LifeAbilityScorer(db)
    history = await scorer.get_score_history(user_id, limit=limit)
    latest = await scorer.get_latest_score(user_id)

    return {
        "latest": latest.to_dict() if latest else None,
        "history": history,
    }
