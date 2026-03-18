-- ==============================================
-- FutureAssist AI - Database Schema v1.0
-- 柴田研究室 命名規則準拠
-- ==============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    external_id     UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE,
    age_group       TEXT CHECK (age_group IN (
        '10代', '20代', '30代', '40代', '50代', '60代', '70代以上'
    )),
    consent_status  BOOLEAN DEFAULT FALSE,
    consent_date    TIMESTAMPTZ,
    privacy_version TEXT DEFAULT '1.0',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sessions (Coaching Conversations) ───
CREATE TABLE IF NOT EXISTS sessions (
    session_id      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE CASCADE,
    topic           TEXT NOT NULL CHECK (topic IN (
        '相続終活', '介護と健康', '家庭問題', '仕事と生活',
        'お金と資産', '健康管理', 'その他'
    )),
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    latest_state    JSONB DEFAULT '{}'::jsonb,
    message_count   INT DEFAULT 0,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_topic ON sessions(topic);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);

-- ─── Conversation Messages ───
CREATE TABLE IF NOT EXISTS messages (
    id              SERIAL PRIMARY KEY,
    session_id      UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    suggested_links JSONB DEFAULT '[]'::jsonb,
    emotion_label   TEXT,
    emotion_score   FLOAT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ─── Surveys (Life Ability Evaluation) ───
CREATE TABLE IF NOT EXISTS surveys (
    survey_id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id             INT REFERENCES users(id) ON DELETE CASCADE,
    survey_type         TEXT DEFAULT 'life_ability' CHECK (survey_type IN (
        'life_ability', 'satisfaction', 'roleplay', '360_feedback'
    )),
    responses           JSONB NOT NULL DEFAULT '[]'::jsonb,
    roleplay_data       JSONB DEFAULT '{}'::jsonb,
    life_ability_score  FLOAT,
    satisfaction_score  FLOAT,
    feedback_source     TEXT,  -- for 360-degree: 'self', 'peer', 'supervisor'
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_surveys_user_id ON surveys(user_id);
CREATE INDEX idx_surveys_type ON surveys(survey_type);

-- ─── Metrics Log (Behavioral Tracking) ───
CREATE TABLE IF NOT EXISTS metrics_log (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id) ON DELETE CASCADE,
    chat_frequency      INT DEFAULT 0,          -- 1分Chat頻度
    consultation_trend  TEXT,                    -- 相談傾向（text summary）
    stress_level        FLOAT CHECK (stress_level >= 0 AND stress_level <= 10),
    disposable_income   FLOAT,                  -- 可処分所得 (自由選択)
    disposable_time     FLOAT,                  -- 可処分時間 (自由選択)
    energy_level        FLOAT CHECK (energy_level >= 0 AND energy_level <= 10),
    health_improvement  JSONB DEFAULT '[]'::jsonb,  -- 健康診断改善項目
    period_start        DATE,
    period_end          DATE,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metrics_user_id ON metrics_log(user_id);
CREATE INDEX idx_metrics_updated_at ON metrics_log(updated_at DESC);

-- ─── HEROIC Data (Encrypted Payloads) ───
CREATE TABLE IF NOT EXISTS heroic_data (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id) ON DELETE CASCADE,
    payload_encrypted   BYTEA NOT NULL,
    encryption_version  TEXT DEFAULT 'AES256-v1',
    salt                BYTEA,
    transmitted         BOOLEAN DEFAULT FALSE,
    transmitted_at      TIMESTAMPTZ,
    error_message       TEXT,
    retry_count         INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heroic_user_id ON heroic_data(user_id);
CREATE INDEX idx_heroic_transmitted ON heroic_data(transmitted);

-- ─── Consent Log (Audit Trail) ───
CREATE TABLE IF NOT EXISTS consent_log (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE CASCADE,
    action          TEXT NOT NULL CHECK (action IN ('granted', 'revoked', 'updated')),
    scope           TEXT NOT NULL,  -- e.g., 'heroic_sharing', 'data_collection', 'all'
    privacy_version TEXT NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_user_id ON consent_log(user_id);

-- ─── Public Sites Dictionary ───
CREATE TABLE IF NOT EXISTS public_sites (
    id              SERIAL PRIMARY KEY,
    topic           TEXT NOT NULL,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    description     TEXT,
    prefecture      TEXT,  -- NULL for national resources
    category        TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_public_sites_topic ON public_sites(topic);

-- ─── Question Bank ───
CREATE TABLE IF NOT EXISTS question_bank (
    id              SERIAL PRIMARY KEY,
    category        TEXT NOT NULL,  -- 'common', 'life_ability', 'satisfaction', 'roleplay'
    question_text   TEXT NOT NULL,
    question_type   TEXT DEFAULT 'likert' CHECK (question_type IN (
        'likert', 'free_text', 'multiple_choice', 'yes_no', 'numeric'
    )),
    options         JSONB,  -- for multiple_choice: ["option1", "option2", ...]
    display_order   INT DEFAULT 0,
    is_required     BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed: Initial Question Bank ───
INSERT INTO question_bank (category, question_text, question_type, display_order) VALUES
    ('common', '現在の生活全体にどの程度満足していますか?', 'likert', 1),
    ('common', '仕事と私生活のバランスに満足していますか?', 'likert', 2),
    ('common', '最近のストレスの程度を教えてください', 'likert', 3),
    ('common', '最近、ポジティブな気持ちで過ごした時間はどれくらいありましたか?', 'likert', 4),
    ('common', '今のエネルギー・活力のレベルを教えてください', 'likert', 5),
    ('common', '今年の健康診断で改善が見られた項目はありましたか?', 'yes_no', 6),
    ('common', 'MY HEROIC を利用したことはありますか?', 'yes_no', 7),
    ('satisfaction', '先月よりも自由に使えるお金が増えましたか？', 'likert', 8),
    ('satisfaction', '先月よりも自由に使える時間が増えましたか？', 'likert', 9),
    ('life_ability', '困難な状況でも冷静に判断できると思いますか？', 'likert', 10),
    ('life_ability', '必要な情報を自分で調べて行動できますか？', 'likert', 11),
    ('life_ability', '周囲の人と良好な関係を保てていますか？', 'likert', 12),
    ('life_ability', '将来の計画を立てて実行できていますか？', 'likert', 13),
    ('life_ability', '自分の健康管理に積極的に取り組んでいますか？', 'likert', 14)
ON CONFLICT DO NOTHING;

-- ─── Seed: Public Sites ───
INSERT INTO public_sites (topic, title, url, description, category) VALUES
    ('相続終活', '法務局 - 相続登記手続き', 'https://houmukyoku.moj.go.jp/homu/page7_000001_00014.html', '不動産の相続登記に関する手続き案内', '法務'),
    ('相続終活', '国税庁 - 相続税の申告', 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/souzokunavi.htm', '相続税に関する情報', '税務'),
    ('相続終活', '日本公証人連合会 - 遺言', 'https://www.koshonin.gr.jp/notary/ow01', '公正証書遺言の作成について', '法務'),
    ('相続終活', '法テラス - 無料法律相談', 'https://www.houterasu.or.jp/', '法的トラブルの総合案内所', '相談'),
    ('介護と健康', '厚生労働省 - 介護保険制度', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/index.html', '介護保険制度の概要', '制度'),
    ('介護と健康', '地域包括支援センター', 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/chiiki-houkatsu/', '高齢者の総合相談窓口', '相談'),
    ('介護と健康', 'WAM NET - 介護サービス情報', 'https://www.wam.go.jp/content/wamnet/pcpub/kaigo/', '介護サービス事業所の検索', 'サービス'),
    ('家庭問題', 'よりそいホットライン', 'https://www.since2011.net/yorisoi/', '24時間無料相談電話', '相談'),
    ('家庭問題', '配偶者暴力相談支援センター', 'https://www.gender.go.jp/policy/no_violence/e-vaw/soudankikan/01.html', 'DV相談窓口一覧', '相談'),
    ('お金と資産', '金融庁 - 資産形成', 'https://www.fsa.go.jp/policy/nisa2/', 'NISA制度の概要', '資産形成'),
    ('健康管理', 'e-ヘルスネット', 'https://www.e-healthnet.mhlw.go.jp/', '厚生労働省 健康情報サイト', '健康')
ON CONFLICT DO NOTHING;

-- ─── Updated_at trigger function ───
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_metrics_updated_at
    BEFORE UPDATE ON metrics_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Migration: Add worry_target and guidance fields to public_sites ───
ALTER TABLE public_sites ADD COLUMN IF NOT EXISTS worry_target VARCHAR(100);
ALTER TABLE public_sites ADD COLUMN IF NOT EXISTS guidance_reason TEXT;
ALTER TABLE public_sites ADD COLUMN IF NOT EXISTS skip_info TEXT;

-- Index for worry_target lookup
CREATE INDEX IF NOT EXISTS idx_public_sites_worry_target
  ON public_sites(topic, worry_target)
  WHERE is_active = TRUE;
