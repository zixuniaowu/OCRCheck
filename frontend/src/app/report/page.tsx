"use client";

import { useState } from "react";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold text-gray-800 mt-12 mb-4 pb-2 border-b-2 border-blue-200 scroll-mt-6"
    >
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-3">
      {children}
    </h3>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border border-gray-200 text-sm">
        <thead>
          <tr className="bg-blue-50">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left font-semibold text-gray-700 border-b border-gray-200"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-4 py-2 border-b border-gray-100 text-gray-600"
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-gray-800 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto text-sm leading-relaxed">
      {children}
    </pre>
  );
}

const tocItems = [
  { id: "overview", label: "1. プロジェクト概要" },
  { id: "tech-survey", label: "2. 技術調査: OCR精度比較" },
  { id: "architecture", label: "3. システムアーキテクチャ" },
  { id: "implementation", label: "4. 各要件の実現方法" },
  { id: "poc-plan", label: "5. POC実施計画" },
  { id: "cost", label: "6. コスト概算" },
  { id: "risk", label: "7. リスクと対策" },
  { id: "conclusion", label: "8. 結論・推奨" },
];

export default function ReportPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar TOC */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex-shrink-0 transition-all duration-200 overflow-hidden`}
      >
        <div className="w-64 fixed top-0 left-0 h-screen bg-white border-r border-gray-200 pt-16 overflow-y-auto z-40">
          <div className="px-4 py-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              目次
            </h3>
            <nav className="space-y-1">
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="px-4 pb-6 mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400">2026年2月作成</p>
            <p className="text-xs text-gray-400">OCRCheck POC</p>
          </div>
        </div>
      </aside>

      {/* Toggle sidebar button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-4 left-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title={sidebarOpen ? "目次を閉じる" : "目次を開く"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          )}
        </svg>
      </button>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 mb-10 text-white">
            <h1 className="text-3xl font-bold mb-2">
              OCRCheck 可行性調査報告書
            </h1>
            <p className="text-blue-100 text-lg">
              書類スキャン・OCR・AI管理システム POC
            </p>
            <div className="flex gap-6 mt-4 text-sm text-blue-200">
              <span>作成日: 2026年2月9日</span>
              <span>
                ステータス:{" "}
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  POC検討段階
                </span>
              </span>
            </div>
          </div>

          {/* 1. Overview */}
          <SectionTitle id="overview">1. プロジェクト概要</SectionTitle>

          <SubTitle>1.1 背景</SubTitle>
          <p className="text-gray-600 leading-relaxed mb-4">
            大量の事務書類をスキャンし、OCRやAIを使って読み取り・データ化・管理する処理システムの開発を検討。
            書類には多様なフォーマット（テキスト、表、写真添付など）が混在しており、統一的なデジタル管理基盤が求められている。
          </p>

          <SubTitle>1.2 要件概要</SubTitle>
          <Table
            headers={["#", "要件", "概要"]}
            rows={[
              ["①", "書類スキャン・格納", "スキャンした書類をS3等のクラウドストレージに格納"],
              ["②", "OCR・AIによるデータ化", "各書類をOCR/AIで読み取り、可能な範囲で情報化"],
              ["③", "検索・分類", "読み取った情報で書類を検索・分類できる仕組み"],
              ["④", "修正・コメント・共有", "OCR結果の手動修正、コメント追加、URL共有、協働編集"],
            ]}
          />

          {/* 2. Tech Survey */}
          <SectionTitle id="tech-survey">2. 技術調査: OCRモデルの精度比較</SectionTitle>

          <SubTitle>2.1 クラウドOCRサービス比較</SubTitle>
          <Table
            headers={["サービス", "テキスト精度", "日本語対応", "表抽出", "手書き", "価格 (1,000p)"]}
            rows={[
              ["<strong>Google Cloud Vision</strong>", "~98%", "<span class='text-green-600 font-bold'>◎ 優秀</span>", "○ 良好", "○", "$1.50"],
              ["<strong>Azure Document Intelligence</strong>", "~99.8% (活字)", "○ 対応", "<span class='text-green-600 font-bold'>◎ 最良</span>", "△", "$1.50"],
              ["<strong>AWS Textract</strong>", "~97-98%", "○ 対応", "○ 良好", "○", "$1.50"],
            ]}
          />

          <SubTitle>2.2 オープンソースOCRエンジン比較</SubTitle>
          <Table
            headers={["エンジン", "精度", "日本語対応", "表抽出", "特徴"]}
            rows={[
              ["<strong>PaddleOCR PP-OCRv5</strong>", "<span class='text-green-600 font-bold'>◎ 96.58%</span>", "<span class='text-green-600 font-bold'>◎ 最良</span>", "○", "日本語に特化した最適化、縦書き対応"],
              ["<strong>Surya</strong>", "<span class='text-green-600 font-bold'>◎ 97.70%</span>", "○ 対応", "○", "90+言語、高速処理"],
              ["<strong>MinerU2.5</strong>", "<span class='text-green-600 font-bold'>◎ SOTA</span>", "○ 対応", "<span class='text-green-600 font-bold'>◎ 最良</span>", "表抽出に特化、1.2Bパラメータ"],
              ["<strong>Tesseract</strong>", "△", "△ 基本的", "×", "単純文書向け、複雑レイアウトに弱い"],
              ["<strong>EasyOCR</strong>", "○", "○ 対応", "△", "プロトタイプ向け"],
            ]}
          />

          <SubTitle>2.3 Vision LLM (文書理解)</SubTitle>
          <Table
            headers={["モデル", "OCR精度", "文書理解", "日本語", "コスト"]}
            rows={[
              ["<strong>Gemini 2.5 Pro / 3 Pro</strong>", "<span class='text-green-600 font-bold'>◎</span>", "<span class='text-green-600 font-bold'>◎ 最良</span>", "<span class='text-green-600 font-bold'>◎</span>", "中"],
              ["<strong>Claude Opus 4.5 / Sonnet 4.5</strong>", "<span class='text-green-600 font-bold'>◎</span>", "<span class='text-green-600 font-bold'>◎</span>", "<span class='text-green-600 font-bold'>◎</span>", "中〜高"],
              ["<strong>GPT-4o / GPT-5</strong>", "○", "<span class='text-green-600 font-bold'>◎</span>", "<span class='text-green-600 font-bold'>◎</span>", "高"],
              ["<strong>MiniCPM-o 2.6</strong> (OSS)", "<span class='text-green-600 font-bold'>◎ OCRBench1位</span>", "○", "○", "無料 (自己ホスト)"],
            ]}
          />

          <SubTitle>2.4 推奨構成</SubTitle>
          <div className="bg-blue-50 rounded-lg p-6 my-4 border border-blue-200">
            <p className="font-bold text-blue-800 mb-2">ハイブリッドパイプライン方式を推奨</p>
            <CodeBlock>{`専用OCRエンジン (文字認識精度重視)
  + Vision LLM (文書理解・構造化・分類)`}</CodeBlock>
          </div>

          <Table
            headers={["役割", "推奨技術", "理由"]}
            rows={[
              ["テキストOCR", "<strong>PaddleOCR PP-OCRv5</strong>", "日本語最適化、縦書き対応、OSS無料"],
              ["表抽出", "<strong>MinerU2.5</strong>", "テーブル抽出SOTA、OSS"],
              ["レイアウト解析", "<strong>PP-DocLayout</strong>", "PaddleOCRと統合、高精度"],
              ["文書理解・分類", "<strong>Claude Vision</strong> or <strong>Gemini Pro</strong>", "文脈理解、構造化出力に優れる"],
              ["全文検索", "<strong>Elasticsearch (OpenSearch)</strong>", "日本語形態素解析対応"],
            ]}
          />

          {/* 3. Architecture */}
          <SectionTitle id="architecture">3. システムアーキテクチャ</SectionTitle>

          <SubTitle>3.1 全体構成</SubTitle>
          <CodeBlock>{`[ユーザー] → [Web App (Next.js)] → [API (FastAPI)] → [AWS Infrastructure]
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              [S3 Storage]      [Processing Pipeline]   [PostgreSQL]
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              [PaddleOCR]      [MinerU2.5]     [Vision LLM]
                    │                │                │
                    └────────────────┼────────────────┘
                                     ▼
                              [Elasticsearch]
                              (全文検索インデックス)`}</CodeBlock>

          <SubTitle>3.2 コンポーネント一覧</SubTitle>
          <Table
            headers={["レイヤー", "コンポーネント", "技術"]}
            rows={[
              ["フロントエンド", "Webアプリ", "Next.js 15 + TypeScript"],
              ["フロントエンド", "ドキュメントビューア", "PDF.js + Canvas"],
              ["フロントエンド", "注釈・コメント", "Collaborative annotation (WebSocket)"],
              ["バックエンド", "REST API", "FastAPI (Python)"],
              ["バックエンド", "認証", "AWS Cognito / NextAuth.js"],
              ["処理パイプライン", "ジョブキュー", "Redis (ElastiCache) / SQS"],
              ["処理パイプライン", "OCR処理", "PaddleOCR PP-OCRv5"],
              ["処理パイプライン", "表抽出", "MinerU2.5"],
              ["処理パイプライン", "AI文書理解", "Claude API / Gemini API"],
              ["データストア", "ファイルストレージ", "Amazon S3"],
              ["データストア", "メタデータDB", "PostgreSQL (RDS)"],
              ["データストア", "全文検索", "OpenSearch (Elasticsearch互換)"],
              ["インフラ", "コンテナ実行", "ECS Fargate"],
              ["インフラ", "GPU処理", "ECS Fargate (GPU) / SageMaker"],
            ]}
          />

          {/* 4. Implementation */}
          <SectionTitle id="implementation">4. 各要件の実現方法</SectionTitle>

          <SubTitle>4.1 ① 書類スキャン・格納</SubTitle>
          <Table
            headers={["項目", "内容"]}
            rows={[
              ["実現方法", "S3バケットへの直接アップロード (Webアプリ経由)"],
              ["対応フォーマット", "PDF, TIFF, JPEG, PNG, BMP"],
              ["追加機能", "バッチアップロード、ドラッグ&ドロップ、フォルダ監視"],
              ["開発難易度", "★☆☆☆☆ (低)"],
            ]}
          />

          <SubTitle>4.2 ② OCR・AIによるデータ化</SubTitle>
          <Table
            headers={["項目", "内容"]}
            rows={[
              ["実現方法", "ハイブリッドパイプライン (PaddleOCR + MinerU + Vision LLM)"],
              ["処理フロー", "レイアウト解析 → 領域別OCR → AI統合理解 → 構造化"],
              ["日本語精度 (活字)", "期待精度: 95-99% (文書品質による)"],
              ["日本語精度 (手書き)", "期待精度: 70-85% (要実測検証)"],
              ["表抽出精度", "期待精度: 90-97% (MinerU2.5使用)"],
              ["処理時間目安", "1ページあたり 3-10秒 (GPU使用時)"],
              ["開発難易度", "★★★★☆ (高)"],
            ]}
          />

          <SubTitle>4.3 ③ 検索・分類</SubTitle>
          <Table
            headers={["項目", "内容"]}
            rows={[
              ["全文検索", "OpenSearch + 日本語形態素解析 (kuromoji)"],
              ["分類方法", "Vision LLMによる自動分類 + ルールベース補完"],
              ["分類カテゴリ例", "契約書、請求書、報告書、通知書、申請書、その他"],
              ["検索機能", "キーワード検索、日付範囲、分類フィルタ、タグ"],
              ["開発難易度", "★★★☆☆ (中)"],
            ]}
          />

          <SubTitle>4.4 ④ 修正・コメント・共有</SubTitle>
          <Table
            headers={["項目", "内容"]}
            rows={[
              ["OCR修正UI", "インライン編集 (文書画像上にオーバーレイ)"],
              ["コメント機能", "領域選択 + コメント追加 (Google Docs風)"],
              ["共有機能", "URL共有 (公開/限定公開/パスワード付き)"],
              ["協働編集", "WebSocketによるリアルタイム同期"],
              ["開発難易度", "★★★★☆ (高)"],
            ]}
          />

          {/* 5. POC Plan */}
          <SectionTitle id="poc-plan">5. POC実施計画</SectionTitle>

          <SubTitle>5.1 POCスコープ</SubTitle>
          <Table
            headers={["Phase", "内容", "期間目安"]}
            rows={[
              ["<strong>Phase 1</strong>", "環境構築 + ファイルアップロード + S3格納", "1週間"],
              ["<strong>Phase 2</strong>", "OCRパイプライン (PaddleOCR + MinerU)", "2週間"],
              ["<strong>Phase 3</strong>", "AI文書理解・分類 (Claude/Gemini連携)", "1週間"],
              ["<strong>Phase 4</strong>", "検索UI + 全文検索 (OpenSearch)", "1週間"],
              ["<strong>Phase 5</strong>", "修正・コメント・共有UI", "2週間"],
              ["<strong>Phase 6</strong>", "結合テスト・精度検証・デモ準備", "1週間"],
            ]}
          />
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 my-4">
            <p className="font-bold text-yellow-800">POC合計期間目安: 約8週間</p>
          </div>

          <SubTitle>5.2 POC技術スタック</SubTitle>
          <CodeBlock>{`フロントエンド:  Next.js 15 + TypeScript + Tailwind CSS
バックエンド:    FastAPI (Python 3.12)
OCRエンジン:    PaddleOCR PP-OCRv5
表抽出:         MinerU2.5
AI理解:         Claude API (Anthropic) / Gemini API (Google)
データベース:    PostgreSQL 16
検索エンジン:    OpenSearch 2.x
キャッシュ:      Redis 7
ストレージ:      Amazon S3
コンテナ:       Docker + Docker Compose (ローカル開発)`}</CodeBlock>

          <SubTitle>5.3 POCで検証すべき項目</SubTitle>
          <Table
            headers={["#", "検証項目", "判定基準"]}
            rows={[
              ["1", "日本語OCR精度 (活字)", "95%以上の文字認識精度"],
              ["2", "日本語OCR精度 (手書き)", "70%以上 (参考値)"],
              ["3", "表抽出精度", "90%以上のセル認識精度"],
              ["4", "処理速度", "1ページあたり10秒以内"],
              ["5", "自動分類精度", "80%以上の正分類率"],
              ["6", "全文検索の適合率", "検索結果上位10件の適合率80%以上"],
              ["7", "システム安定性", "100ページ連続処理でエラーなし"],
            ]}
          />

          {/* 6. Cost */}
          <SectionTitle id="cost">6. コスト概算</SectionTitle>

          <SubTitle>6.1 POCフェーズ (月額)</SubTitle>
          <Table
            headers={["項目", "サービス", "月額概算"]}
            rows={[
              ["コンピュート", "ECS Fargate (2vCPU, 4GB) x 2", "~$150"],
              ["GPU処理", "ECS Fargate GPU (推論時のみ)", "~$200"],
              ["ストレージ", "S3 (100GB)", "~$3"],
              ["DB", "RDS PostgreSQL (db.t3.medium)", "~$70"],
              ["検索", "OpenSearch (t3.small.search)", "~$50"],
              ["キャッシュ", "ElastiCache Redis (t3.micro)", "~$15"],
              ["AI API", "Claude API / Gemini API (1000ページ/月)", "~$50-100"],
              ["その他", "ALB, CloudWatch, データ転送", "~$50"],
              ["<strong>合計</strong>", "", "<strong>~$590-640/月</strong>"],
            ]}
          />

          <SubTitle>6.2 本番運用フェーズ (月額概算)</SubTitle>
          <p className="text-gray-600 mb-2">月間処理量10,000ページの場合：</p>
          <Table
            headers={["項目", "月額概算"]}
            rows={[
              ["コンピュート (スケールアップ)", "~$500"],
              ["GPU処理", "~$800"],
              ["ストレージ (1TB)", "~$25"],
              ["DB (db.r6g.large)", "~$250"],
              ["OpenSearch (m6g.large.search)", "~$200"],
              ["AI API (10,000ページ)", "~$500-1,000"],
              ["その他", "~$200"],
              ["<strong>合計</strong>", "<strong>~$2,475-2,975/月</strong>"],
            ]}
          />

          {/* 7. Risk */}
          <SectionTitle id="risk">7. リスクと対策</SectionTitle>

          <Table
            headers={["#", "リスク", "影響度", "対策"]}
            rows={[
              ["1", "日本語OCR精度が期待を下回る", "<span class='text-red-600 font-bold'>高</span>", "POCで実文書で検証。複数エンジン併用で補完"],
              ["2", "手書き文字の認識精度が低い", "<span class='text-yellow-600 font-bold'>中</span>", "スコープを活字優先に。手書きは将来対応"],
              ["3", "多様なフォーマットへの対応", "<span class='text-yellow-600 font-bold'>中</span>", "レイアウト解析を充実させ、フォーマット別処理"],
              ["4", "GPU処理コストの増大", "<span class='text-yellow-600 font-bold'>中</span>", "SageMaker Serverless推論、バッチ処理で最適化"],
              ["5", "AI APIコストの増大", "<span class='text-yellow-600 font-bold'>中</span>", "ルールベース分類を併用し、API呼出を最適化"],
              ["6", "リアルタイム協働編集の複雑さ", "<span class='text-green-600 font-bold'>低</span>", "POCではシンプルな編集に留め、段階的に拡張"],
            ]}
          />

          {/* 8. Conclusion */}
          <SectionTitle id="conclusion">8. 結論・推奨</SectionTitle>

          <div className="bg-green-50 rounded-lg p-6 border border-green-200 my-6">
            <h3 className="text-lg font-bold text-green-800 mb-3">
              8.1 技術的実現可能性: 高い
            </h3>
            <ul className="space-y-2 text-green-700">
              <li>OCR技術（特にPaddleOCR PP-OCRv5）は日本語文書に対して十分な精度を持つ</li>
              <li>Vision LLM（Claude / Gemini）による文書理解・構造化は実用レベルに達している</li>
              <li>オープンソースの組み合わせにより、コストを抑えつつ高機能なシステム構築が可能</li>
            </ul>
          </div>

          <SubTitle>8.2 推奨アプローチ</SubTitle>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-6">
            <li>
              <strong>オープンソース中心のハイブリッド構成</strong> — PaddleOCR + MinerU (OSS)
              + Claude/Gemini API (文書理解)
            </li>
            <li>
              <strong>段階的な開発</strong> — POCで精度検証 → MVPで基本機能実装 → 本番で拡張
            </li>
            <li>
              <strong>クラウドネイティブ</strong> — AWS上でコンテナベースのスケーラブルな構成
            </li>
            <li>
              <strong>実文書での早期検証</strong> — 顧客の実際の書類サンプルを使ったPOCが最重要
            </li>
          </ol>

          <SubTitle>8.3 開発可能範囲</SubTitle>
          <Table
            headers={["要件", "開発可否", "備考"]}
            rows={[
              ["① S3環境構築・ファイル格納", "<span class='text-green-600 font-bold'>✅ 開発可能</span>", "AWS CDK/Terraformで構築"],
              ["② OCR・AIデータ化", "<span class='text-green-600 font-bold'>✅ 開発可能</span>", "OSS + API組合せで実現"],
              ["③ 検索・分類", "<span class='text-green-600 font-bold'>✅ 開発可能</span>", "OpenSearch + AI分類"],
              ["④ 修正・コメント・共有", "<span class='text-green-600 font-bold'>✅ 開発可能</span>", "Webアプリとして実装"],
            ]}
          />

          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 my-8 text-center">
            <p className="text-blue-800 font-bold text-lg">
              全ての要件について開発可能と判断する。POCにて技術的な精度検証を行い、
              本番開発への移行判断を行うことを推奨する。
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 mt-12 mb-8 text-sm text-gray-400 text-center">
            <p>OCRCheck 可行性調査報告書 | 2026年2月</p>
          </div>
        </div>
      </main>
    </div>
  );
}
