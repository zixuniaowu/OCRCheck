# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリのコードを扱う際のガイドです。

## プロジェクト概要

OCRCheckは書類スキャン・OCR・AI管理システムのPOC。スキャンされた事務書類（テキスト・表・写真混在）をOCRとAIで読み取り・データ化し、検索・分類・コメント・共有を可能にするシステム。

**対象書類**: 日本語のビジネス書類（契約書、請求書、報告書、申請書など）

## アーキテクチャ

ハイブリッドパイプライン方式：
- **フロントエンド**: Next.js 15 + TypeScript + Tailwind CSS v4
- **バックエンドAPI**: FastAPI (Python 3.12)
- **OCRエンジン**: PaddleOCR PP-OCRv5 (日本語最適化)
- **表抽出**: PP-Structure
- **AI文書理解**: Claude Vision API
- **データベース**: PostgreSQL 16 (メタデータ), OpenSearch (全文検索), Redis (キャッシュ/キュー)
- **ファイルストレージ**: MinIO (ローカル) / Amazon S3 (本番)
- **インフラ**: Docker Compose (ローカル) / AWS ECS Fargate (本番)

### 処理パイプライン

```
アップロード → S3 → ジョブキュー → [テキストOCR | 表抽出]
→ Vision LLM (分類・要約・エンティティ抽出) → PostgreSQL + OpenSearch → Web UI
```

## 主要ディレクトリ

```
backend/              — FastAPIバックエンド (Python 3.12)
backend/app/          — アプリケーションコード (main.py, config, API routes, models, services)
backend/app/workers/  — OCR処理ワーカー (PaddleOCR + PP-Structure + PyMuPDF)
frontend/             — Next.js 15 フロントエンド (TypeScript + Tailwind CSS v4)
frontend/src/app/     — App Routerページ (/, /upload, /search, /documents, /documents/[id], /shared/[token])
frontend/src/lib/     — APIクライアント
docs/                 — アーキテクチャ図 (PlantUML) + 可行性調査報告書
```

## 開発コマンド

```bash
# 全サービス一括 (Docker)
docker compose up --build          # 全サービス起動
docker compose down                # 全サービス停止

# バックエンド（単体）
cd backend
source .venv/Scripts/activate      # Windows (Git Bash)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# フロントエンド（単体）
cd frontend
npm run dev                        # 開発サーバー (:3000)
npm run build                      # 本番ビルド
npm run lint                       # ESLint

# OCRワーカー（単体、PaddleOCR依存が必要）
cd backend
python -m app.workers.ocr_worker   # ワーカープロセス起動

# バックエンドリント
cd backend
ruff check .                       # Lint
ruff format .                      # Format
```

## APIエンドポイント

- `GET  /api/health` — ヘルスチェック
- `POST /api/documents/upload` — 書類アップロード（単体）
- `POST /api/documents/upload-batch` — 書類一括アップロード
- `GET  /api/documents/` — 書類一覧（クエリ: skip, limit, status）
- `GET  /api/documents/{id}` — 書類詳細（署名付きダウンロードURL付き）
- `DELETE /api/documents/{id}` — 書類削除
- `GET  /api/documents/{id}/ocr` — 全ページOCR結果取得
- `GET  /api/documents/{id}/ocr/{page}` — 特定ページOCR結果
- `POST /api/documents/{id}/reprocess` — OCR再処理キュー投入
- `PATCH /api/documents/{id}/ocr/{page}` — OCRテキスト手動修正
- `POST /api/documents/{id}/share` — 共有リンク生成
- `DELETE /api/documents/{id}/share` — 共有リンク取消
- `GET  /api/documents/{id}/comments/` — コメント一覧（クエリ: page_number）
- `POST /api/documents/{id}/comments/` — コメント追加
- `PUT  /api/documents/{id}/comments/{cid}` — コメント更新
- `DELETE /api/documents/{id}/comments/{cid}` — コメント削除
- `GET  /api/shared/{token}` — 公開共有ビュー
- `GET  /api/search/?q=&category=&tags=&date_from=&date_to=` — 全文検索（ファセット付き）

## ローカルサービス (Docker Compose)

| サービス | ポート | URL | 用途 |
|---------|-------|-----|------|
| フロントエンド | 9000 | http://localhost:9000 | Next.js UI |
| バックエンド | 9001 | http://localhost:9001 | FastAPI (Swagger: /docs) |
| PostgreSQL | 9002 | `localhost:9002` | メタデータDB |
| Redis | 9003 | `localhost:9003` | キャッシュ/ジョブキュー |
| MinIO API | 9004 | http://localhost:9004 | S3互換ストレージ |
| MinIO管理画面 | 9005 | http://localhost:9005 | ストレージ管理UI |
| OpenSearch | 9006 | http://localhost:9006 | 全文検索 (kuromoji日本語解析) |
| OCRワーカー | — | — | PaddleOCR処理 (Redisキューポーリング) |

## 言語規約

- ドキュメント・UI・レポートは全て日本語
- コード内の変数名・関数名は英語
- コメントは英語

## 設計方針

- PaddleOCR PP-OCRv5を採用：日本語精度96.58%、縦書き対応でTesseract/EasyOCRより優位
- ハイブリッドOCR + Vision LLM方式：専用OCRで文字精度、LLMで文書理解・分類
- OpenSearch + kuromoji形態素解析器で日本語全文検索
- 非同期ジョブキュー（Redis）でアップロードとOCR処理を分離
- Claude Vision APIで文書理解：分類、エンティティ抽出、要約、タグ付け
- AI分析はOCR後にワーカーパイプラインで実行、APIキー未設定時はスキップ
- AI応答は構造化JSON（カテゴリ、エンティティ、要約、タグ）

## 環境変数

`.env` に `ANTHROPIC_API_KEY` を設定するとAI文書分析が有効になります。未設定でもOCRは動作しますが、分類・要約・エンティティ抽出はスキップされます。全変数は `.env.example` を参照。
