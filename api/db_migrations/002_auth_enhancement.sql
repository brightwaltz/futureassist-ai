-- ────────────────────────────────────────────────────────────────────────
-- 002_auth_enhancement.sql
--
-- 認証強化マイグレーション (P0/P1/P2 対応):
--   - users: password_hash, email_verified, totp_secret, mfa_enabled,
--            google_id, auth_provider, last_login_at
--   - refresh_tokens テーブル新規 (JWT refresh token rotation)
--   - email_verification_tokens テーブル新規 (登録時メール確認)
--   - password_reset_tokens テーブル新規 (パスワードリセット)
--
-- 全文 IF NOT EXISTS / IF NOT EXISTS DO NOTHING で冪等。
-- 起動時 lifespan で各 ALTER/CREATE を try/except で適用するため、
-- このファイルは「人間が読むためのドキュメント」として保持し、
-- 実適用は api/main.py にインライン化する。
-- ────────────────────────────────────────────────────────────────────────

-- ─── users テーブル拡張 ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id          TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider      TEXT NOT NULL DEFAULT 'password';
  -- 'password' | 'google' | 'legacy_passwordless'
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at      TIMESTAMPTZ;

-- ─── refresh_tokens (JWT refresh token store) ───────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,         -- SHA-256 hash; never store raw
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,                  -- nullable; non-null = revoked
    rotated_to   INT REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    user_agent   TEXT,
    ip_address   TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- ─── email_verification_tokens ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id           SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_verification_user
    ON email_verification_tokens(user_id, expires_at DESC);

-- ─── password_reset_tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id           SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens(user_id, expires_at DESC);

-- ─── 既存ユーザーの後方互換: 既存 user は legacy_passwordless 扱い ──
-- ALTER で auth_provider のデフォルトを password にしたため、
-- 既存ユーザーは新規追加時点で password になっている。
-- email_verified=FALSE と password_hash=NULL なので、初回ログイン時に
-- パスワードリセットフローへ案内される。
UPDATE users
   SET auth_provider = 'legacy_passwordless'
 WHERE password_hash IS NULL
   AND google_id IS NULL
   AND auth_provider = 'password'
   AND created_at < NOW();
