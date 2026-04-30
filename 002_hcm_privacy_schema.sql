-- ==============================================
-- FutureAssist AI - HCM Privacy Schema v3.0
-- Phase 1: プライバシー設計・Life Ability定量化基盤
-- ==============================================

-- pgvector拡張（Phase2のハイブリッド検索で使用、今回は有効化のみ）
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Life Ability 5要素スコア履歴 ───
-- user_ext_id: external_id(UUID)のみ使用し内部IDを露出しない
CREATE TABLE IF NOT EXISTS life_ability_scores (
    id              SERIAL PRIMARY KEY,
    user_ext_id     UUID NOT NULL,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
    s1_info_org     FLOAT CHECK (s1_info_org    BETWEEN 0 AND 100),  -- ①情報整理力
    s2_decision     FLOAT CHECK (s2_decision    BETWEEN 0 AND 100),  -- ②意思決定納得度
    s3_action       FLOAT CHECK (s3_action      BETWEEN 0 AND 100),  -- ③行動移行力
    s4_stability    FLOAT CHECK (s4_stability   BETWEEN 0 AND 100),  -- ④生活運用安定性
    s5_resource     FLOAT CHECK (s5_resource    BETWEEN 0 AND 100),  -- ⑤可処分リソース創出力
    composite_score FLOAT CHECK (composite_score BETWEEN 0 AND 100),
    ema_score       FLOAT CHECK (ema_score      BETWEEN 0 AND 100),  -- 指数移動平均(α=0.3)
    source          TEXT DEFAULT 'survey' CHECK (source IN ('survey', 'chat', 'manual')),
    survey_id       UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_la_scores_user
    ON life_ability_scores(user_ext_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_la_scores_tenant
    ON life_ability_scores(tenant_id, created_at DESC);

-- ─── ROI・損失コスト記録 ───
CREATE TABLE IF NOT EXISTS roi_records (
    id                    SERIAL PRIMARY KEY,
    tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE,
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    presenteeism_loss_jpy FLOAT,         -- プレゼンティーイズム損失（円）
    absenteeism_loss_jpy  FLOAT,         -- アブセンティーイズム損失（円）
    estimated_roi_jpy     FLOAT,         -- 推定財務リターン（円）
    roi_ratio             FLOAT,         -- ROI倍率（estimated_roi / intervention_cost）
    affected_headcount    INT,
    avg_daily_wage_jpy    FLOAT,         -- 想定平均日給（円）
    avg_la_score_before   FLOAT,         -- 介入前平均Life Abilityスコア
    avg_la_score_after    FLOAT,         -- 介入後平均Life Abilityスコア
    intervention_cost_jpy FLOAT,         -- 介入コスト（円）
    metadata              JSONB DEFAULT '{}',
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_roi_records_tenant
    ON roi_records(tenant_id, period_start DESC);

-- ─── メッセージ埋め込みベクトル（Phase2で本格活用） ───
CREATE TABLE IF NOT EXISTS message_embeddings (
    id           SERIAL PRIMARY KEY,
    message_id   INT REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
    tenant_id    UUID REFERENCES tenants(id) ON DELETE SET NULL,
    embedding    vector(1536),            -- text-embedding-3-small次元数
    content_text TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlatインデックス（コサイン距離）
CREATE INDEX IF NOT EXISTS idx_msg_emb_cosine
    ON message_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ─── K-匿名化ダッシュボード集計ビュー（K=5） ───
-- 少人数セグメント（5人未満）は集計から除外してプライバシーを保護
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_analytics AS
SELECT
    las.tenant_id,
    u.age_group,
    u.department,
    COUNT(DISTINCT las.user_ext_id)  AS headcount,
    ROUND(AVG(las.s1_info_org)::NUMERIC, 2)     AS avg_s1,
    ROUND(AVG(las.s2_decision)::NUMERIC, 2)     AS avg_s2,
    ROUND(AVG(las.s3_action)::NUMERIC, 2)       AS avg_s3,
    ROUND(AVG(las.s4_stability)::NUMERIC, 2)    AS avg_s4,
    ROUND(AVG(las.s5_resource)::NUMERIC, 2)     AS avg_s5,
    ROUND(AVG(las.composite_score)::NUMERIC, 2) AS avg_composite,
    ROUND(AVG(las.ema_score)::NUMERIC, 2)       AS avg_ema,
    MAX(las.created_at)                          AS latest_score_at
FROM life_ability_scores las
JOIN users u ON u.external_id = las.user_ext_id
WHERE las.created_at >= NOW() - INTERVAL '90 days'
GROUP BY las.tenant_id, u.age_group, u.department
HAVING COUNT(DISTINCT las.user_ext_id) >= 5;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_analytics_pk
    ON dashboard_analytics(tenant_id, age_group, department);
