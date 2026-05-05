"""
Life Ability 5要素スコアリングサービス v3.0

アンケート回答と対話履歴から5要素スコアを算出し、
EMA（指数移動平均）で平滑化してDBに保存する。

5要素:
  S1: 情報整理力         (information_organizing)
  S2: 意思決定納得度     (decision_satisfaction)
  S3: 行動移行力         (action_bridging)
  S4: 生活運用安定性     (life_stability)
  S5: 可処分リソース創出力 (resource_optimization)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.orm import User

logger = logging.getLogger(__name__)

# ─── 質問ID → 5要素マッピング ───
# question_bankのdisplay_orderに基づく（001_init.sqlのSEED参照）
# 各質問は対応する要素に寄与する（複数要素に寄与する質問もある）
QUESTION_ELEMENT_MAP: dict[int, list[str]] = {
    # common category (Q1-Q7)
    1:  ["s2_decision"],         # 生活全体満足度 → 意思決定納得度
    2:  ["s4_stability"],        # 仕事と私生活バランス → 生活運用安定性
    3:  ["s4_stability"],        # ストレス（逆転）→ 生活運用安定性
    4:  ["s5_resource"],         # ポジティブ感情 → 可処分リソース
    5:  ["s5_resource"],         # エネルギー → 可処分リソース
    6:  ["s4_stability"],        # 健康診断改善 → 生活運用安定性
    7:  ["s3_action"],           # HEROIC利用 → 行動移行力
    # satisfaction category (Q8-Q9)
    8:  ["s5_resource"],         # 可処分所得増加 → 可処分リソース
    9:  ["s5_resource"],         # 可処分時間増加 → 可処分リソース
    # life_ability category (Q10-Q14)
    10: ["s1_info_org"],         # 困難状況での冷静判断 → 情報整理力
    11: ["s1_info_org", "s3_action"],  # 情報収集・行動 → 情報整理力+行動移行力
    12: ["s2_decision"],         # 良好な人間関係 → 意思決定納得度
    13: ["s3_action"],           # 将来計画実行 → 行動移行力
    14: ["s4_stability"],        # 健康管理 → 生活運用安定性
}

# 5要素の重みづけ（合計1.0）
ELEMENT_WEIGHTS = {
    "s1_info_org":  0.20,
    "s2_decision":  0.25,
    "s3_action":    0.20,
    "s4_stability": 0.20,
    "s5_resource":  0.15,
}

# EMA平滑化係数
EMA_ALPHA = 0.3

# ストレス・エネルギーレベルを5要素に反映する質問ID
STRESS_QUESTION_ID = 3    # Likert 1(低)-5(高) → 高い方がストレス大
ENERGY_QUESTION_ID = 5    # Likert 1(低)-5(高) → 高い方がエネルギー大


@dataclass
class LifeAbilityScore:
    s1_info_org: Optional[float]
    s2_decision: Optional[float]
    s3_action: Optional[float]
    s4_stability: Optional[float]
    s5_resource: Optional[float]
    composite_score: Optional[float]
    ema_score: Optional[float]

    def to_dict(self) -> dict:
        return asdict(self)


def _normalize_likert(value: float, max_val: float = 5.0, inverse: bool = False) -> float:
    """Likertスコア(1-5)を0-100に正規化。inverse=Trueで逆転。"""
    pct = (value - 1.0) / (max_val - 1.0) * 100.0
    return round(100.0 - pct if inverse else pct, 2)


def compute_5elements(
    answers: list[dict],
    stress_override: Optional[float] = None,
    energy_override: Optional[float] = None,
) -> LifeAbilityScore:
    """
    アンケート回答から5要素スコアを算出する。

    answers: [{"question_id": int, "value": float|int}, ...]
    stress_override: metrics_logのstress_level(0-10)があれば追加反映
    energy_override: metrics_logのenergy_level(0-10)があれば追加反映

    各要素スコアは0-100。
    """
    # 要素別に回答値を収集
    element_values: dict[str, list[float]] = {k: [] for k in ELEMENT_WEIGHTS}

    for answer in answers:
        qid = answer.get("question_id")
        val = answer.get("value")

        if qid is None or val is None:
            continue
        try:
            val = float(val)
        except (TypeError, ValueError):
            continue

        elements = QUESTION_ELEMENT_MAP.get(qid, [])
        for elem in elements:
            if elem not in element_values:
                continue
            # ストレス質問(Q3)は逆転スコア
            if qid == STRESS_QUESTION_ID:
                element_values[elem].append(_normalize_likert(val, inverse=True))
            else:
                element_values[elem].append(_normalize_likert(val))

    # metrics_logのstress/energy情報をs4・s5に追加反映（0-10スケール）
    if stress_override is not None:
        stress_pct = (10.0 - stress_override) / 10.0 * 100.0  # 逆転
        element_values["s4_stability"].append(round(stress_pct, 2))
    if energy_override is not None:
        energy_pct = energy_override / 10.0 * 100.0
        element_values["s5_resource"].append(round(energy_pct, 2))

    # 各要素の平均スコア算出
    scores: dict[str, Optional[float]] = {}
    for elem, values in element_values.items():
        if values:
            scores[elem] = round(sum(values) / len(values), 2)
        else:
            scores[elem] = None

    # 加重合成スコア
    available = {k: v for k, v in scores.items() if v is not None}
    if available:
        total_w = sum(ELEMENT_WEIGHTS[k] for k in available)
        composite = sum(v * ELEMENT_WEIGHTS[k] for k, v in available.items()) / total_w
        composite = round(composite, 2)
    else:
        composite = None

    return LifeAbilityScore(
        s1_info_org=scores.get("s1_info_org"),
        s2_decision=scores.get("s2_decision"),
        s3_action=scores.get("s3_action"),
        s4_stability=scores.get("s4_stability"),
        s5_resource=scores.get("s5_resource"),
        composite_score=composite,
        ema_score=None,  # DB保存時にEMAを計算
    )


class LifeAbilityScorer:
    """Life Ability スコアを算出してDBに保存するサービス。"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_prev_ema(self, user_ext_id: UUID) -> Optional[float]:
        """直近のEMAスコアを取得（EMA計算に使用）。"""
        result = await self.db.execute(
            text(
                "SELECT ema_score FROM life_ability_scores "
                "WHERE user_ext_id = :uid AND ema_score IS NOT NULL "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"uid": str(user_ext_id)},
        )
        row = result.fetchone()
        return float(row[0]) if row and row[0] is not None else None

    async def _get_tenant_id(self, user_id: int) -> Optional[UUID]:
        """ユーザーのtenant_idを取得。"""
        result = await self.db.execute(
            select(User.tenant_id, User.external_id).where(User.id == user_id)
        )
        row = result.fetchone()
        return row[0] if row else None

    async def _get_user_external_id(self, user_id: int) -> Optional[UUID]:
        """ユーザーのexternal_id(UUID)を取得。"""
        result = await self.db.execute(
            select(User.external_id).where(User.id == user_id)
        )
        row = result.fetchone()
        return row[0] if row else None

    async def compute_and_save(
        self,
        user_id: int,
        answers: list[dict],
        survey_id: Optional[UUID] = None,
        stress_level: Optional[float] = None,
        energy_level: Optional[float] = None,
        source: str = "survey",
    ) -> LifeAbilityScore:
        """
        スコア算出 → EMA計算 → life_ability_scoresに保存。

        Parameters
        ----------
        user_id: 内部ユーザーID（DB保存にはexternal_idに変換）
        answers: [{"question_id": int, "value": float|str}, ...]
        survey_id: 紐付けるsurvey UUID（任意）
        stress_level: metrics_logのstress_level(0-10)
        energy_level: metrics_logのenergy_level(0-10)
        source: 'survey' | 'chat' | 'manual'
        """
        user_ext_id = await self._get_user_external_id(user_id)
        if user_ext_id is None:
            logger.warning(f"LifeAbilityScorer: user_id={user_id} not found")
            raise ValueError(f"User {user_id} not found")

        tenant_id = await self._get_tenant_id(user_id)

        # 5要素スコア算出
        score = compute_5elements(answers, stress_level, energy_level)

        # EMA平滑化
        prev_ema = await self._get_prev_ema(user_ext_id)
        if score.composite_score is not None:
            if prev_ema is not None:
                score.ema_score = round(
                    EMA_ALPHA * score.composite_score + (1 - EMA_ALPHA) * prev_ema, 2
                )
            else:
                score.ema_score = score.composite_score
        else:
            score.ema_score = prev_ema

        # DB保存（SQLAlchemy coreで直接INSERT）
        await self.db.execute(
            text("""
                INSERT INTO life_ability_scores
                    (user_ext_id, tenant_id, s1_info_org, s2_decision, s3_action,
                     s4_stability, s5_resource, composite_score, ema_score, source, survey_id)
                VALUES
                    (:user_ext_id, :tenant_id, :s1, :s2, :s3, :s4, :s5, :composite, :ema, :source, :survey_id)
            """),
            {
                "user_ext_id": str(user_ext_id),
                "tenant_id": str(tenant_id) if tenant_id else None,
                "s1": score.s1_info_org,
                "s2": score.s2_decision,
                "s3": score.s3_action,
                "s4": score.s4_stability,
                "s5": score.s5_resource,
                "composite": score.composite_score,
                "ema": score.ema_score,
                "source": source,
                "survey_id": str(survey_id) if survey_id else None,
            },
        )

        logger.info(
            f"LifeAbilityScore saved: user_ext_id={user_ext_id}, "
            f"composite={score.composite_score}, ema={score.ema_score}"
        )
        return score

    async def get_latest_score(self, user_id: int) -> Optional[LifeAbilityScore]:
        """ユーザーの最新Life Abilityスコアを取得。"""
        user_ext_id = await self._get_user_external_id(user_id)
        if not user_ext_id:
            return None

        result = await self.db.execute(
            text("""
                SELECT s1_info_org, s2_decision, s3_action, s4_stability, s5_resource,
                       composite_score, ema_score
                FROM life_ability_scores
                WHERE user_ext_id = :uid
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"uid": str(user_ext_id)},
        )
        row = result.fetchone()
        if not row:
            return None

        return LifeAbilityScore(
            s1_info_org=row[0],
            s2_decision=row[1],
            s3_action=row[2],
            s4_stability=row[3],
            s5_resource=row[4],
            composite_score=row[5],
            ema_score=row[6],
        )

    async def get_score_history(
        self, user_id: int, limit: int = 30
    ) -> list[dict]:
        """ユーザーのLife Abilityスコア履歴を取得（新しい順）。"""
        user_ext_id = await self._get_user_external_id(user_id)
        if not user_ext_id:
            return []

        result = await self.db.execute(
            text("""
                SELECT s1_info_org, s2_decision, s3_action, s4_stability, s5_resource,
                       composite_score, ema_score, source, created_at
                FROM life_ability_scores
                WHERE user_ext_id = :uid
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            {"uid": str(user_ext_id), "limit": limit},
        )
        rows = result.fetchall()
        return [
            {
                "s1_info_org": r[0],
                "s2_decision": r[1],
                "s3_action": r[2],
                "s4_stability": r[3],
                "s5_resource": r[4],
                "composite_score": r[5],
                "ema_score": r[6],
                "source": r[7],
                "created_at": r[8].isoformat() if r[8] else None,
            }
            for r in rows
        ]
