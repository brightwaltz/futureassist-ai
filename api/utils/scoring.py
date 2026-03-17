"""
Scoring algorithms for Life Ability and Satisfaction indices.
"""
from typing import Optional


# ─── Life Ability 5-Element Weights ───

LIFE_ABILITY_WEIGHTS = {
    "information_organizing": 0.20,   # ① 情報整理力
    "decision_satisfaction": 0.25,    # ② 意思決定納得度（中核指標）
    "action_bridging": 0.20,          # ③ 行動移行力
    "life_stability": 0.20,           # ④ 生活運用安定性
    "resource_optimization": 0.15,    # ⑤ 可処分リソース創出力
}


def compute_life_ability_5elements(answers: list[dict]) -> dict:
    """
    Compute 5-element Life Ability scores and weighted total.
    Each element: 0-100, total: weighted average 0-100.

    Each answer dict should have:
      - "element": one of the LIFE_ABILITY_WEIGHTS keys
      - "value": numeric value (Likert 1-5)
    """
    element_scores = {}
    for element_key in LIFE_ABILITY_WEIGHTS:
        element_answers = [a for a in answers if a.get("element") == element_key]
        if element_answers:
            total = sum(float(a["value"]) for a in element_answers if isinstance(a.get("value"), (int, float)))
            max_possible = len(element_answers) * 5
            element_scores[element_key] = round((total / max_possible) * 100, 2) if max_possible > 0 else None
        else:
            element_scores[element_key] = None

    # Compute weighted total
    available = {k: v for k, v in element_scores.items() if v is not None}
    if available:
        total_weight = sum(LIFE_ABILITY_WEIGHTS[k] for k in available)
        weighted_sum = sum(v * LIFE_ABILITY_WEIGHTS[k] for k, v in available.items())
        element_scores["total"] = round(weighted_sum / total_weight, 2)
    else:
        element_scores["total"] = None

    return element_scores


def compute_life_ability_score(answers: list[dict]) -> Optional[float]:
    """
    Compute Life Ability score from survey answers.

    Likert scale: 1 (strongly disagree) to 5 (strongly agree).
    Score normalized to 0-100 range.

    Categories weighted:
    - 判断力 (Decision-making): 25%
    - 情報活用力 (Information utilization): 25%
    - 対人関係力 (Interpersonal skills): 20%
    - 計画実行力 (Planning & execution): 15%
    - 健康管理力 (Health management): 15%
    """
    if not answers:
        return None

    # Extract numeric values from life_ability questions
    la_answers = [
        a for a in answers
        if isinstance(a.get("value"), (int, float))
    ]

    if not la_answers:
        return None

    total = sum(float(a["value"]) for a in la_answers)
    max_possible = len(la_answers) * 5  # Maximum Likert score

    return round((total / max_possible) * 100, 2) if max_possible > 0 else None


def compute_satisfaction_score(answers: list[dict]) -> Optional[float]:
    """
    Compute overall satisfaction index from survey answers.

    Uses weighted average of:
    - 生活満足度 (Life satisfaction): 30%
    - ワークライフバランス (Work-life balance): 20%
    - ストレス (Stress, inverse): 20%
    - ポジティブ感情 (Positive emotions): 15%
    - エネルギー (Energy level): 15%

    Score normalized to 0-100 range.
    """
    if not answers:
        return None

    sat_answers = [
        a for a in answers
        if isinstance(a.get("value"), (int, float))
    ]

    if not sat_answers:
        return None

    total = sum(float(a["value"]) for a in sat_answers)
    max_possible = len(sat_answers) * 5

    return round((total / max_possible) * 100, 2) if max_possible > 0 else None


def compute_wellbeing_index(
    life_ability: Optional[float],
    satisfaction: Optional[float],
    stress_level: Optional[float] = None,
    energy_level: Optional[float] = None,
) -> Optional[float]:
    """
    Composite well-being index combining multiple dimensions.
    Returns a score from 0-100.
    """
    components = []
    weights = []

    if life_ability is not None:
        components.append(life_ability)
        weights.append(0.35)

    if satisfaction is not None:
        components.append(satisfaction)
        weights.append(0.35)

    if stress_level is not None:
        # Invert stress (0=no stress → 100, 10=max stress → 0)
        components.append((10 - stress_level) * 10)
        weights.append(0.15)

    if energy_level is not None:
        components.append(energy_level * 10)
        weights.append(0.15)

    if not components:
        return None

    # Normalize weights
    total_weight = sum(weights)
    weighted_sum = sum(c * w for c, w in zip(components, weights))

    return round(weighted_sum / total_weight, 2)
