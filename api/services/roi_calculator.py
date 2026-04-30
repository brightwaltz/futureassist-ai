"""
ROI・損失コスト算出サービス v3.0

プレゼンティーイズム（出勤しているが生産性が低下している状態）と
アブセンティーイズム（欠勤・休職）による財務損失を算出し、
HCM介入のROIを推定する。

参考式:
  プレゼンティーイズム損失 = 平均日給 × パフォーマンス阻害率 × 対象人数 × 稼働日数
  アブセンティーイズム損失 = 平均日給 × 推定欠勤日数 × 対象人数
  ROI推定 = (損失削減額) / 介入コスト
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# デフォルト稼働日数（年間営業日）
DEFAULT_WORKING_DAYS_PER_YEAR = 240
# プレゼンティーイズムの基準パフォーマンス阻害率（厚生労働省調査参考値）
# Life Abilityスコアが低いほど阻害率が高い仮定
BASE_PRESENTEEISM_RATE = 0.20  # 20% (スコア50基準)
# アブセンティーイズム推定式: ストレス高=年間欠勤日数多
# composite_score 50 → 年7日欠勤の基準
BASE_ABSENTEEISM_DAYS = 7.0


@dataclass
class RoiResult:
    tenant_id: Optional[UUID]
    period_start: date
    period_end: date
    presenteeism_loss_jpy: float
    absenteeism_loss_jpy: float
    total_loss_jpy: float
    intervention_cost_jpy: float
    estimated_roi_jpy: float      # 損失削減額（= 損失改善分）
    roi_ratio: float               # estimated_roi / intervention_cost
    affected_headcount: int
    avg_daily_wage_jpy: float
    avg_la_score_before: Optional[float]
    avg_la_score_after: Optional[float]

    def to_dict(self) -> dict:
        d = asdict(self)
        d["tenant_id"] = str(d["tenant_id"]) if d["tenant_id"] else None
        d["period_start"] = str(d["period_start"])
        d["period_end"] = str(d["period_end"])
        return d


def _presenteeism_rate_from_score(composite_score: Optional[float]) -> float:
    """
    Life Abilityスコア(0-100)からプレゼンティーイズム阻害率(0-1)を推定。
    スコア100 → 阻害率5%, スコア0 → 阻害率35%（線形補間）
    """
    if composite_score is None:
        return BASE_PRESENTEEISM_RATE
    # 線形: rate = 0.35 - (0.30 * score / 100)
    rate = 0.35 - (0.30 * composite_score / 100.0)
    return max(0.05, min(0.50, round(rate, 4)))


def _absenteeism_days_from_score(composite_score: Optional[float]) -> float:
    """
    Life Abilityスコア(0-100)から年間推定欠勤日数を推定。
    スコア100 → 2日, スコア0 → 15日（線形補間）
    """
    if composite_score is None:
        return BASE_ABSENTEEISM_DAYS
    days = 15.0 - (13.0 * composite_score / 100.0)
    return max(1.0, min(20.0, round(days, 1)))


def calculate_roi(
    avg_daily_wage_jpy: float,
    affected_headcount: int,
    period_days: int,
    avg_la_score_before: Optional[float],
    avg_la_score_after: Optional[float],
    intervention_cost_jpy: float,
    tenant_id: Optional[UUID] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> RoiResult:
    """
    ROIを算出する（DB非依存のピュア計算関数）。

    Parameters
    ----------
    avg_daily_wage_jpy: 平均日給（円）
    affected_headcount: 対象人数
    period_days: 算出対象日数
    avg_la_score_before: 介入前平均Life Abilityスコア
    avg_la_score_after: 介入後平均Life Abilityスコア（Noneの場合は改善なし）
    intervention_cost_jpy: 介入コスト（円）
    """
    working_days = min(period_days, DEFAULT_WORKING_DAYS_PER_YEAR)
    period_ratio = period_days / DEFAULT_WORKING_DAYS_PER_YEAR

    # ─── 介入前の損失 ───
    p_rate_before = _presenteeism_rate_from_score(avg_la_score_before)
    a_days_before = _absenteeism_days_from_score(avg_la_score_before)

    presenteeism_loss_before = (
        avg_daily_wage_jpy * p_rate_before * affected_headcount * working_days
    )
    absenteeism_loss_before = (
        avg_daily_wage_jpy * a_days_before * affected_headcount * period_ratio
    )
    total_loss_before = presenteeism_loss_before + absenteeism_loss_before

    # ─── 介入後の損失（after scoreがある場合のみ改善を算出） ───
    score_after = avg_la_score_after if avg_la_score_after is not None else avg_la_score_before
    p_rate_after = _presenteeism_rate_from_score(score_after)
    a_days_after = _absenteeism_days_from_score(score_after)

    presenteeism_loss_after = (
        avg_daily_wage_jpy * p_rate_after * affected_headcount * working_days
    )
    absenteeism_loss_after = (
        avg_daily_wage_jpy * a_days_after * affected_headcount * period_ratio
    )
    total_loss_after = presenteeism_loss_after + absenteeism_loss_after

    # ─── ROI算出 ───
    loss_reduction = total_loss_before - total_loss_after  # 損失削減額
    roi_ratio = (
        round(loss_reduction / intervention_cost_jpy, 3)
        if intervention_cost_jpy > 0 else 0.0
    )

    return RoiResult(
        tenant_id=tenant_id,
        period_start=period_start or date.today(),
        period_end=period_end or date.today(),
        presenteeism_loss_jpy=round(presenteeism_loss_before, 0),
        absenteeism_loss_jpy=round(absenteeism_loss_before, 0),
        total_loss_jpy=round(total_loss_before, 0),
        intervention_cost_jpy=round(intervention_cost_jpy, 0),
        estimated_roi_jpy=round(loss_reduction, 0),
        roi_ratio=roi_ratio,
        affected_headcount=affected_headcount,
        avg_daily_wage_jpy=round(avg_daily_wage_jpy, 0),
        avg_la_score_before=avg_la_score_before,
        avg_la_score_after=score_after,
    )


class RoiCalculator:
    """ROI算出とDB保存を担うサービスクラス。"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_avg_la_score(
        self,
        tenant_id: UUID,
        period_start: date,
        period_end: date,
    ) -> tuple[Optional[float], int]:
        """
        期間内のテナント平均Life Abilityスコアと対象人数を取得。
        Returns (avg_composite_score, headcount)
        """
        result = await self.db.execute(
            text("""
                SELECT
                    AVG(composite_score) AS avg_score,
                    COUNT(DISTINCT user_ext_id) AS headcount
                FROM life_ability_scores
                WHERE tenant_id = :tenant_id
                  AND created_at >= :start
                  AND created_at < :end
                  AND composite_score IS NOT NULL
            """),
            {
                "tenant_id": str(tenant_id),
                "start": period_start.isoformat(),
                "end": period_end.isoformat(),
            },
        )
        row = result.fetchone()
        avg_score = float(row[0]) if row and row[0] is not None else None
        headcount = int(row[1]) if row and row[1] is not None else 0
        return avg_score, headcount

    async def calculate_and_save(
        self,
        tenant_id: UUID,
        period_start: date,
        period_end: date,
        avg_daily_wage_jpy: float,
        intervention_cost_jpy: float,
        headcount_override: Optional[int] = None,
        before_period_start: Optional[date] = None,
        before_period_end: Optional[date] = None,
    ) -> RoiResult:
        """
        ROIを算出してroi_recordsに保存する。

        before_period_start/end が指定された場合は「介入前」のスコアを取得。
        """
        # 介入後（当期）のスコア取得
        avg_score_after, headcount_after = await self.get_avg_la_score(
            tenant_id, period_start, period_end
        )

        # 介入前スコア取得（指定がある場合）
        avg_score_before: Optional[float] = None
        if before_period_start and before_period_end:
            avg_score_before, _ = await self.get_avg_la_score(
                tenant_id, before_period_start, before_period_end
            )

        headcount = headcount_override if headcount_override else headcount_after
        period_days = (period_end - period_start).days or 1

        roi = calculate_roi(
            avg_daily_wage_jpy=avg_daily_wage_jpy,
            affected_headcount=headcount,
            period_days=period_days,
            avg_la_score_before=avg_score_before,
            avg_la_score_after=avg_score_after,
            intervention_cost_jpy=intervention_cost_jpy,
            tenant_id=tenant_id,
            period_start=period_start,
            period_end=period_end,
        )

        # DB保存（競合時はUPDATE）
        await self.db.execute(
            text("""
                INSERT INTO roi_records (
                    tenant_id, period_start, period_end,
                    presenteeism_loss_jpy, absenteeism_loss_jpy,
                    estimated_roi_jpy, roi_ratio,
                    affected_headcount, avg_daily_wage_jpy,
                    avg_la_score_before, avg_la_score_after,
                    intervention_cost_jpy,
                    metadata
                ) VALUES (
                    :tenant_id, :period_start, :period_end,
                    :presenteeism_loss, :absenteeism_loss,
                    :estimated_roi, :roi_ratio,
                    :headcount, :avg_wage,
                    :score_before, :score_after,
                    :intervention_cost,
                    :metadata
                )
                ON CONFLICT (tenant_id, period_start, period_end)
                DO UPDATE SET
                    presenteeism_loss_jpy  = EXCLUDED.presenteeism_loss_jpy,
                    absenteeism_loss_jpy   = EXCLUDED.absenteeism_loss_jpy,
                    estimated_roi_jpy      = EXCLUDED.estimated_roi_jpy,
                    roi_ratio              = EXCLUDED.roi_ratio,
                    affected_headcount     = EXCLUDED.affected_headcount,
                    avg_daily_wage_jpy     = EXCLUDED.avg_daily_wage_jpy,
                    avg_la_score_before    = EXCLUDED.avg_la_score_before,
                    avg_la_score_after     = EXCLUDED.avg_la_score_after,
                    intervention_cost_jpy  = EXCLUDED.intervention_cost_jpy,
                    created_at             = NOW()
            """),
            {
                "tenant_id": str(tenant_id),
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "presenteeism_loss": roi.presenteeism_loss_jpy,
                "absenteeism_loss": roi.absenteeism_loss_jpy,
                "estimated_roi": roi.estimated_roi_jpy,
                "roi_ratio": roi.roi_ratio,
                "headcount": roi.affected_headcount,
                "avg_wage": roi.avg_daily_wage_jpy,
                "score_before": roi.avg_la_score_before,
                "score_after": roi.avg_la_score_after,
                "intervention_cost": roi.intervention_cost_jpy,
                "metadata": "{}",
            },
        )

        logger.info(
            f"ROI saved: tenant={tenant_id}, period={period_start}~{period_end}, "
            f"roi_ratio={roi.roi_ratio}, estimated_roi={roi.estimated_roi_jpy:,.0f}円"
        )
        return roi

    async def get_latest_roi(self, tenant_id: UUID) -> Optional[dict]:
        """テナントの最新ROI記録を取得。"""
        result = await self.db.execute(
            text("""
                SELECT
                    period_start, period_end,
                    presenteeism_loss_jpy, absenteeism_loss_jpy,
                    estimated_roi_jpy, roi_ratio,
                    affected_headcount, avg_daily_wage_jpy,
                    avg_la_score_before, avg_la_score_after,
                    intervention_cost_jpy, created_at
                FROM roi_records
                WHERE tenant_id = :tenant_id
                ORDER BY period_start DESC
                LIMIT 1
            """),
            {"tenant_id": str(tenant_id)},
        )
        row = result.fetchone()
        if not row:
            return None

        return {
            "period_start": str(row[0]),
            "period_end": str(row[1]),
            "presenteeism_loss_jpy": row[2],
            "absenteeism_loss_jpy": row[3],
            "estimated_roi_jpy": row[4],
            "roi_ratio": row[5],
            "affected_headcount": row[6],
            "avg_daily_wage_jpy": row[7],
            "avg_la_score_before": row[8],
            "avg_la_score_after": row[9],
            "intervention_cost_jpy": row[10],
            "created_at": row[11].isoformat() if row[11] else None,
        }
