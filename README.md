# 未来アシストAI (FutureAssist AI)

コンシェルジュ・コーチング統合AIシステム — 対話を通じて公的情報へ案内する

柴田研究室 Service Informatics Lab | 玉川大学

## アーキテクチャ

**Single-service構成** (Render.com Free Tier向け)

```
FastAPI (Python)
├── /api/*        REST API endpoints
├── /ws/chat      WebSocket (リアルタイムチャット)
└── /*            React SPA (静的ファイル配信)
```

- **Backend**: FastAPI + SQLAlchemy (asyncpg) + PostgreSQL
- **Frontend**: React + Vite + Tailwind CSS
- **AI**: OpenAI GPT-4 Turbo (交換可能)

## Render.comへのデプロイ

### 1. Blueprint (自動)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

`render.yaml` を使って自動セットアップ:
- Web Service (Python 3.11 + Node.js 20)
- PostgreSQL データベース

### 2. 環境変数の設定

Render Dashboard → Environment で以下を設定:

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `DATABASE_URL` | 自動設定 (Blueprint) | ✅ |
| `OPENAI_API_KEY` | OpenAI APIキー | ✅ |
| `AI_BACKEND` | `openai` or `anthropic` | |
| `AI_MODEL` | `gpt-4-turbo` (default) | |
| `HEROIC_API_URL` | HEROIC連携URL | |
| `HEROIC_API_KEY` | HEROIC APIキー | |
| `HEROIC_ENCRYPTION_KEY` | HEROIC暗号化キー (AES-256) | |

### 3. データベース初期化

初回デプロイ時、テーブルはSQLAlchemyが自動作成します。
会話テンプレート等のシードデータは `data/` ディレクトリに格納されています。

## ローカル開発

```bash
# Python環境
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt

# フロントエンド
cd frontend && npm install && cd ..

# PostgreSQLを起動してDATABASE_URLを.envに設定
cp .env.example .env  # 編集してください

# 起動
uvicorn api.main:app --reload --port 10000
cd frontend && npm run dev  # 別ターミナルで
```

## API ドキュメント

デプロイ後: `https://<your-app>.onrender.com/api/docs`

## ライセンス

研究目的 — 柴田研究室 内部利用
