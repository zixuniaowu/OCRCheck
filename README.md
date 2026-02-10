# OCRCheck — 書類スキャン・OCR・AI管理システム

書類をスキャンし、OCRとAIで自動的にデータ化・分類・管理するWebシステムのPOC（概念実証）です。

---

## 概要

大量の事務書類（契約書、請求書、報告書など）をスキャンし、OCR/AIを使って読み取り・構造化・検索・共有を可能にするシステムです。

### 主要機能

| # | 機能 | 説明 |
|---|------|------|
| ① | **書類スキャン・格納** | スキャンした書類（PDF/画像）をS3ストレージに格納 |
| ② | **OCR・AIデータ化** | PaddleOCR + Claude Vision APIで文字認識・分類・要約 |
| ③ | **検索・分類** | OpenSearch（kuromoji日本語解析）による全文検索、AI自動分類 |
| ④ | **修正・コメント・共有** | OCRテキスト手動修正、コメント追加、URL共有リンク |

---

## アーキテクチャ

```
[ユーザー] → [Next.js フロントエンド] → [FastAPI バックエンド] → [インフラストラクチャ]
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              [MinIO / S3]           [OCR処理ワーカー]           [PostgreSQL]
              ファイル格納                  │                    メタデータ
                            ┌──────────────┼──────────────┐
                            ▼              ▼              ▼
                      [PaddleOCR]    [PP-Structure]  [Claude Vision]
                      文字認識        表抽出          文書理解・分類
                            │              │              │
                            └──────────────┼──────────────┘
                                           ▼
                                    [OpenSearch]
                                    全文検索インデックス
```

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 + TypeScript + Tailwind CSS v4 |
| バックエンドAPI | FastAPI (Python 3.12) |
| OCRエンジン | PaddleOCR PP-OCRv5 (日本語最適化) |
| 表抽出 | PP-Structure |
| AI文書理解 | Claude Vision API (Anthropic) |
| データベース | PostgreSQL 16 |
| 全文検索 | OpenSearch 2.18 (kuromoji日本語形態素解析) |
| キャッシュ/キュー | Redis 7 |
| ファイルストレージ | MinIO (ローカル) / Amazon S3 (本番) |
| コンテナ | Docker Compose |

---

## クイックスタート

### 前提条件

- Docker / Docker Compose
- Node.js 18+ (フロントエンド単体開発時)
- Python 3.12+ (バックエンド単体開発時)

### 1. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY を設定（AI分析を有効にする場合）
```

### 2. Docker Composeで全サービスを起動

```bash
docker compose up --build
```

### 3. アクセス

起動後、以下のURLでアクセスできます：

| サービス | URL | 説明 |
|---------|-----|------|
| **フロントエンド** | http://localhost:9000 | メインUI |
| **バックエンドAPI** | http://localhost:9001 | REST APIサーバー |
| **APIドキュメント** | http://localhost:9001/docs | Swagger UI |
| **PostgreSQL** | `localhost:9002` | メタデータDB |
| **Redis** | `localhost:9003` | キャッシュ/ジョブキュー |
| **MinIO API** | http://localhost:9004 | S3互換ストレージ |
| **MinIO管理画面** | http://localhost:9005 | ストレージ管理UI |
| **OpenSearch** | http://localhost:9006 | 全文検索エンジン |

---

## 開発コマンド

### Docker Compose（全サービス一括）

```bash
docker compose up --build          # 全サービス起動
docker compose down                # 全サービス停止
docker compose logs -f backend     # バックエンドログ確認
docker compose logs -f ocr-worker  # OCRワーカーログ確認
```

### フロントエンド（単体開発）

```bash
cd frontend
npm install
npm run dev                        # 開発サーバー (http://localhost:3000)
npm run build                      # 本番ビルド
npm run lint                       # ESLint
```

### バックエンド（単体開発）

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash)
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### OCRワーカー（単体実行）

```bash
cd backend
python -m app.workers.ocr_worker   # Redisキューからジョブを取得して処理
```

---

## APIエンドポイント一覧

### 書類管理

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/api/documents/upload` | 書類アップロード（単体） |
| `POST` | `/api/documents/upload-batch` | 書類一括アップロード |
| `GET` | `/api/documents/` | 書類一覧取得 |
| `GET` | `/api/documents/{id}` | 書類詳細取得 |
| `DELETE` | `/api/documents/{id}` | 書類削除 |
| `POST` | `/api/documents/{id}/reprocess` | OCR再処理 |

### OCR結果

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/documents/{id}/ocr` | 全ページOCR結果取得 |
| `GET` | `/api/documents/{id}/ocr/{page}` | 特定ページOCR結果 |
| `PATCH` | `/api/documents/{id}/ocr/{page}` | OCRテキスト手動修正 |

### コメント

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/documents/{id}/comments/` | コメント一覧 |
| `POST` | `/api/documents/{id}/comments/` | コメント追加 |
| `PUT` | `/api/documents/{id}/comments/{cid}` | コメント更新 |
| `DELETE` | `/api/documents/{id}/comments/{cid}` | コメント削除 |

### 共有

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/api/documents/{id}/share` | 共有リンク生成 |
| `DELETE` | `/api/documents/{id}/share` | 共有リンク取消 |
| `GET` | `/api/shared/{token}` | 公開共有ビュー |

### 検索

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/search/` | 全文検索（q, category, tags, date_from, date_to） |

### ヘルスチェック

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/health` | サーバー状態確認 |

---

## プロジェクト構成

```
OCRCheck/
├── backend/                          # FastAPIバックエンド
│   ├── app/
│   │   ├── main.py                   # FastAPIアプリケーション
│   │   ├── config.py                 # 環境設定 (pydantic-settings)
│   │   ├── db/
│   │   │   └── database.py           # SQLAlchemy非同期DB接続
│   │   ├── models/
│   │   │   ├── document.py           # 書類モデル
│   │   │   ├── ocr_result.py         # OCR結果モデル（ページ単位）
│   │   │   └── comment.py            # コメントモデル
│   │   ├── api/
│   │   │   ├── schemas.py            # Pydanticスキーマ
│   │   │   └── routes/
│   │   │       ├── health.py         # ヘルスチェック
│   │   │       ├── documents.py      # 書類CRUD・共有・OCR修正
│   │   │       ├── comments.py       # コメントCRUD
│   │   │       └── search.py         # 全文検索
│   │   ├── services/
│   │   │   ├── storage.py            # S3/MinIOストレージサービス
│   │   │   ├── queue.py              # Redisジョブキュー
│   │   │   ├── search.py             # OpenSearch検索サービス
│   │   │   └── ai_service.py         # Claude Vision AI分析
│   │   └── workers/
│   │       ├── ocr_worker.py         # OCR処理ワーカー（メインループ）
│   │       ├── ocr_processor.py      # PaddleOCRラッパー
│   │       └── pdf_processor.py      # PDF→画像変換 (PyMuPDF)
│   ├── Dockerfile                    # APIサーバー用Dockerfile
│   ├── Dockerfile.worker             # OCRワーカー用Dockerfile
│   └── pyproject.toml                # Python依存関係
├── frontend/                         # Next.jsフロントエンド
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # ルートレイアウト（ヘッダー・ナビ）
│   │   │   ├── page.tsx              # ダッシュボード
│   │   │   ├── upload/page.tsx       # アップロードページ
│   │   │   ├── documents/page.tsx    # 書類一覧ページ
│   │   │   ├── documents/[id]/page.tsx # 書類詳細（OCR・コメント・共有）
│   │   │   ├── search/page.tsx       # 検索ページ
│   │   │   └── shared/[token]/page.tsx # 公開共有ビュー
│   │   └── lib/
│   │       └── api.ts                # APIクライアント
│   ├── Dockerfile                    # フロントエンド用Dockerfile
│   └── package.json                  # Node.js依存関係
├── docs/
│   ├── feasibility-report.md         # 可行性調査報告書
│   ├── architecture.puml             # システムアーキテクチャ図
│   ├── processing-pipeline.puml      # OCR処理パイプライン図
│   └── deployment.puml               # AWSデプロイメント構成図
├── docker-compose.yml                # 開発環境定義
├── .env / .env.example               # 環境変数
├── CLAUDE.md                         # 開発ガイド
└── README.md                         # 本ファイル
```

---

## 処理パイプライン

```
1. アップロード
   ユーザーがPDF/画像をWeb UIからアップロード
       ↓
2. S3格納
   ファイルをMinIO/S3バケットに保存
       ↓
3. ジョブキュー
   Redis経由でOCRワーカーにジョブを投入
       ↓
4. OCR処理 (ワーカー)
   a. PDF → 画像変換 (PyMuPDF, 300 DPI)
   b. PaddleOCR でテキスト認識（ブロック単位、信頼度付き）
   c. PP-Structure で表抽出（HTML形式）
   d. 各ページの結果をDBに保存
       ↓
5. AI文書理解 (Claude Vision API)
   a. 書類の自動分類（契約書、請求書等）
   b. エンティティ抽出（人名、組織、金額、日付等）
   c. 要約生成
   d. タグ付け、重要ポイント抽出
       ↓
6. 検索インデックス
   OpenSearchにOCRテキスト・メタデータを登録
       ↓
7. 完了
   ステータスを「完了」に更新、Web UIに結果表示
```

---

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|------------|
| `POSTGRES_USER` | PostgreSQLユーザー名 | `ocrcheck` |
| `POSTGRES_PASSWORD` | PostgreSQLパスワード | `ocrcheck_dev` |
| `POSTGRES_DB` | データベース名 | `ocrcheck` |
| `DATABASE_URL` | DB接続URL | `postgresql+asyncpg://ocrcheck:ocrcheck_dev@db:5432/ocrcheck` |
| `S3_ENDPOINT_URL` | S3/MinIOエンドポイント | `http://minio:9000` |
| `S3_ACCESS_KEY` | S3アクセスキー | `minioadmin` |
| `S3_SECRET_KEY` | S3シークレットキー | `minioadmin` |
| `S3_BUCKET_NAME` | S3バケット名 | `ocrcheck-documents` |
| `REDIS_URL` | Redis接続URL | `redis://redis:6379/0` |
| `OPENSEARCH_URL` | OpenSearch接続URL | `http://opensearch:9200` |
| `ANTHROPIC_API_KEY` | Anthropic APIキー（AI分析用） | *(未設定時はAI分析スキップ)* |
| `AI_MODEL` | 使用するAIモデル | `claude-sonnet-4-5-20250929` |
| `AI_ENABLED` | AI分析の有効/無効 | `true` |
| `NEXT_PUBLIC_API_URL` | フロントエンドからのAPI URL | `http://localhost:9001` |

---

## 関連ドキュメント

- [可行性調査報告書](docs/feasibility-report.md) — 技術調査、OCR精度比較、コスト概算、リスク分析
- [システムアーキテクチャ図](docs/architecture.puml) — PlantUML
- [処理パイプライン図](docs/processing-pipeline.puml) — PlantUML
- [AWSデプロイメント構成図](docs/deployment.puml) — PlantUML

---

## ライセンス

本プロジェクトはPOC（概念実証）として開発されています。
