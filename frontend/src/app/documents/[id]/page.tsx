"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getDocument,
  getOCRResults,
  reprocessDocument,
  listComments,
  createComment,
  deleteComment,
  correctOCRText,
  createShareLink,
  revokeShareLink,
  type DocumentData,
  type Entities,
  type OCRPageData,
  type CommentData,
} from "@/lib/api";

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [ocrPages, setOcrPages] = useState<OCRPageData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [activeTab, setActiveTab] = useState<"preview" | "ocr" | "tables">("preview");
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getDocument(id),
      getOCRResults(id).catch(() => []),
      listComments(id).catch(() => []),
    ])
      .then(([docData, pages, commentsData]) => {
        setDoc(docData);
        setOcrPages(pages);
        setComments(commentsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const refreshComments = () => {
    listComments(id)
      .then(setComments)
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    // Auto-refresh while processing
    if (doc?.status === "processing" || doc?.status === "uploaded") {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [doc?.status]);

  const handleReprocess = async () => {
    if (!confirm("OCR処理を再実行しますか？")) return;
    await reprocessDocument(id);
    fetchData();
  };

  if (loading) return <p className="text-gray-500">読み込み中...</p>;
  if (!doc) return <p className="text-red-500">書類が見つかりません</p>;

  const currentOcrPage = ocrPages.find((p) => p.page_number === activePage);
  const isImage = doc.content_type.startsWith("image/");
  const isPdf = doc.content_type === "application/pdf";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/documents" className="text-gray-400 hover:text-gray-600">
            ← 一覧
          </Link>
          <h2 className="text-2xl font-bold">{doc.original_filename}</h2>
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowShareDialog(true)}
            className="text-sm border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50"
          >
            共有
          </button>
          <button
            onClick={handleReprocess}
            className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            再処理
          </button>
        </div>
      </div>

      {/* Processing indicator */}
      {(doc.status === "processing" || doc.status === "uploaded") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-blue-700 text-sm">
            {doc.status === "uploaded" ? "OCR処理待ち..." : "OCR処理中...（自動更新されます）"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {(["preview", "ocr", "tables"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "preview" ? "プレビュー" : tab === "ocr" ? "OCRテキスト" : "表データ"}
              </button>
            ))}
          </div>

          {/* Page navigation (if multi-page) */}
          {(doc.page_count ?? 0) > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="px-2 py-1 border rounded text-xs disabled:opacity-40"
              >
                前ページ
              </button>
              <span className="text-sm text-gray-600">
                {activePage} / {doc.page_count} ページ
              </span>
              <button
                onClick={() => setActivePage((p) => Math.min(doc.page_count ?? 1, p + 1))}
                disabled={activePage >= (doc.page_count ?? 1)}
                className="px-2 py-1 border rounded text-xs disabled:opacity-40"
              >
                次ページ
              </button>
            </div>
          )}

          {/* Tab content */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 min-h-[400px]">
            {activeTab === "preview" && (
              <PreviewTab
                doc={doc}
                currentOcrPage={currentOcrPage}
                isImage={isImage}
                isPdf={isPdf}
              />
            )}
            {activeTab === "ocr" && (
              <OCRTextTab
                currentOcrPage={currentOcrPage}
                allPages={ocrPages}
                documentId={id}
                onCorrected={(updated) => {
                  setOcrPages((prev) =>
                    prev.map((p) => (p.id === updated.id ? updated : p))
                  );
                }}
              />
            )}
            {activeTab === "tables" && <TablesTab currentOcrPage={currentOcrPage} />}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Document info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">書類情報</h3>
            <dl className="space-y-2 text-sm">
              <InfoRow label="ファイル名" value={doc.original_filename} />
              <InfoRow label="形式" value={doc.content_type} />
              <InfoRow label="サイズ" value={formatSize(doc.file_size)} />
              <InfoRow label="ページ数" value={doc.page_count ? `${doc.page_count}` : "-"} />
              <InfoRow
                label="アップロード日"
                value={new Date(doc.created_at).toLocaleString("ja-JP")}
              />
            </dl>
          </div>

          {/* AI Classification */}
          {doc.category && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold mb-3">AI分類</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={doc.category} />
                  {doc.category_confidence != null && (
                    <span className="text-xs text-gray-400">
                      {(doc.category_confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {doc.document_date && (
                  <div className="text-sm">
                    <span className="text-gray-500">書類日付: </span>
                    <span className="font-medium">{doc.document_date}</span>
                  </div>
                )}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          {doc.summary && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold mb-3">要約</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{doc.summary}</p>
            </div>
          )}

          {/* Key Points */}
          {doc.key_points && doc.key_points.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold mb-3">重要ポイント</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                {doc.key_points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-500 shrink-0">-</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities */}
          {doc.entities && <EntitiesCard entities={doc.entities} />}

          {/* OCR stats */}
          {ocrPages.length > 0 && (
            <details className="bg-white rounded-lg border border-gray-200 p-4">
              <summary className="font-semibold cursor-pointer">OCR詳細</summary>
              <dl className="space-y-2 text-sm mt-3">
                <InfoRow
                  label="平均信頼度"
                  value={`${(
                    (ocrPages.reduce((sum, p) => sum + (p.confidence ?? 0), 0) /
                      ocrPages.length) *
                    100
                  ).toFixed(1)}%`}
                />
                <InfoRow
                  label="テキストブロック"
                  value={`${ocrPages.reduce(
                    (sum, p) => sum + (p.blocks?.length ?? 0),
                    0
                  )}`}
                />
                <InfoRow
                  label="テーブル"
                  value={`${ocrPages.reduce(
                    (sum, p) => sum + (p.tables?.length ?? 0),
                    0
                  )}`}
                />
              </dl>
            </details>
          )}

          {/* Comment panel */}
          <CommentPanel
            documentId={id}
            comments={comments}
            onRefresh={refreshComments}
          />

          {doc.download_url && (
            <a
              href={doc.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              原本ダウンロード
            </a>
          )}
        </div>
      </div>

      {/* Share dialog */}
      {showShareDialog && (
        <ShareDialog
          doc={doc}
          onClose={() => setShowShareDialog(false)}
          onUpdate={(updated) => setDoc(updated)}
        />
      )}
    </div>
  );
}

function PreviewTab({
  doc,
  currentOcrPage,
  isImage,
  isPdf,
}: {
  doc: DocumentData;
  currentOcrPage: OCRPageData | undefined;
  isImage: boolean;
  isPdf: boolean;
}) {
  // If we have a page image from OCR, show that (with optional bbox overlay)
  const imageUrl = currentOcrPage?.page_image_url ?? doc.download_url;

  if (isPdf && !currentOcrPage?.page_image_url && doc.download_url) {
    return (
      <iframe
        src={doc.download_url}
        className="w-full h-[600px] rounded border"
        title="PDF Preview"
      />
    );
  }

  if (imageUrl) {
    return (
      <div className="relative">
        <img src={imageUrl} alt={doc.original_filename} className="max-w-full rounded" />
      </div>
    );
  }

  return <p className="text-gray-500">プレビューを表示できません</p>;
}

function OCRTextTab({
  currentOcrPage,
  allPages,
  documentId,
  onCorrected,
}: {
  currentOcrPage: OCRPageData | undefined;
  allPages: OCRPageData[];
  documentId: string;
  onCorrected: (updated: OCRPageData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  if (allPages.length === 0) {
    return <p className="text-gray-500">OCR結果がまだありません</p>;
  }

  const text = currentOcrPage?.full_text;
  if (!text && !editing) {
    return <p className="text-gray-500">このページにはテキストがありません</p>;
  }

  const handleStartEdit = () => {
    setEditText(text || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!currentOcrPage) return;
    setSaving(true);
    try {
      const updated = await correctOCRText(
        documentId,
        currentOcrPage.page_number,
        editText
      );
      onCorrected(updated);
      setEditing(false);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button
              onClick={() => setEditing(false)}
              className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </>
        ) : (
          <button
            onClick={handleStartEdit}
            className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50"
          >
            テキスト修正
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="w-full h-80 text-sm text-gray-800 leading-relaxed font-sans p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      ) : (
        <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">
          {text}
        </pre>
      )}

      {/* Block-level detail with confidence */}
      {!editing && currentOcrPage?.blocks && currentOcrPage.blocks.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            ブロック詳細 ({currentOcrPage.blocks.length} 件)
          </summary>
          <div className="mt-2 space-y-1 max-h-80 overflow-y-auto">
            {currentOcrPage.blocks.map((block, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs px-2 py-1 rounded hover:bg-gray-50"
              >
                <span
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    block.confidence >= 0.9
                      ? "bg-green-100 text-green-700"
                      : block.confidence >= 0.7
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {(block.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-gray-700">{block.text}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function TablesTab({ currentOcrPage }: { currentOcrPage: OCRPageData | undefined }) {
  if (!currentOcrPage?.tables || currentOcrPage.tables.length === 0) {
    return <p className="text-gray-500">このページには表データがありません</p>;
  }

  return (
    <div className="space-y-6">
      {currentOcrPage.tables.map((table, i) => (
        <div key={i} className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600">テーブル {i + 1}</h4>
          <div
            className="overflow-x-auto text-sm border rounded [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50"
            dangerouslySetInnerHTML={{ __html: table.html }}
          />
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    uploaded: { label: "アップロード済", cls: "bg-gray-100 text-gray-600" },
    processing: { label: "処理中", cls: "bg-yellow-100 text-yellow-700 animate-pulse" },
    completed: { label: "完了", cls: "bg-green-100 text-green-700" },
    failed: { label: "失敗", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    "契約書": "bg-purple-100 text-purple-700 border-purple-200",
    "請求書": "bg-orange-100 text-orange-700 border-orange-200",
    "見積書": "bg-cyan-100 text-cyan-700 border-cyan-200",
    "納品書": "bg-teal-100 text-teal-700 border-teal-200",
    "報告書": "bg-blue-100 text-blue-700 border-blue-200",
    "議事録": "bg-indigo-100 text-indigo-700 border-indigo-200",
    "通知書": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "申請書": "bg-green-100 text-green-700 border-green-200",
    "証明書": "bg-pink-100 text-pink-700 border-pink-200",
    "履歴書": "bg-rose-100 text-rose-700 border-rose-200",
  };
  const cls = colorMap[category] || "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`px-2.5 py-1 rounded-lg text-sm font-medium border ${cls}`}>
      {category}
    </span>
  );
}

function EntitiesCard({ entities }: { entities: Entities }) {
  const sections: { key: keyof Entities; label: string; icon: string }[] = [
    { key: "people", label: "人名", icon: "👤" },
    { key: "organizations", label: "組織名", icon: "🏢" },
    { key: "dates", label: "日付", icon: "📅" },
    { key: "amounts", label: "金額", icon: "💰" },
    { key: "addresses", label: "住所", icon: "📍" },
    { key: "references", label: "参照番号", icon: "🔗" },
  ];

  const hasAny = sections.some(
    (s) => entities[s.key] && entities[s.key].length > 0
  );
  if (!hasAny) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold mb-3">抽出エンティティ</h3>
      <div className="space-y-2">
        {sections.map((s) => {
          const items = entities[s.key];
          if (!items || items.length === 0) return null;
          return (
            <div key={s.key} className="text-sm">
              <span className="text-gray-500">{s.icon} {s.label}: </span>
              <span className="text-gray-800">{items.join(", ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommentPanel({
  documentId,
  comments,
  onRefresh,
}: {
  documentId: string;
  comments: CommentData[];
  onRefresh: () => void;
}) {
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState("anonymous");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await createComment(documentId, {
        content: newComment,
        author: author || "anonymous",
      });
      setNewComment("");
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("このコメントを削除しますか？")) return;
    try {
      await deleteComment(documentId, commentId);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold mb-3">コメント ({comments.length})</h3>

      {/* Comment list */}
      <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
        {comments.length === 0 && (
          <p className="text-xs text-gray-400">コメントはまだありません</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="border-b border-gray-100 pb-2 last:border-0">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-gray-600">{c.author}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(c.created_at).toLocaleString("ja-JP")}
                </span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-700 mt-1">{c.content}</p>
            {c.page_number && (
              <span className="text-xs text-gray-400">ページ {c.page_number}</span>
            )}
          </div>
        ))}
      </div>

      {/* New comment form */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="名前"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <textarea
          placeholder="コメントを入力..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          className="w-full text-xs bg-blue-600 text-white py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "送信中..." : "コメント追加"}
        </button>
      </div>
    </div>
  );
}

function ShareDialog({
  doc,
  onClose,
  onUpdate,
}: {
  doc: DocumentData;
  onClose: () => void;
  onUpdate: (doc: DocumentData) => void;
}) {
  const [shareUrl, setShareUrl] = useState(doc.share_token ? `${window.location.origin}/shared/${doc.share_token}` : "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const data = await createShareLink(doc.id);
      const url = `${window.location.origin}${data.share_url}`;
      setShareUrl(url);
      onUpdate({ ...doc, share_token: data.share_token, is_public: data.is_public });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await revokeShareLink(doc.id);
      setShareUrl("");
      onUpdate({ ...doc, share_token: null, is_public: false });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">書類を共有</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &times;
          </button>
        </div>

        {shareUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">共有リンクが生成されました:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-sm border border-gray-200 rounded px-3 py-2 bg-gray-50"
              />
              <button
                onClick={handleCopy}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {copied ? "コピー済!" : "コピー"}
              </button>
            </div>
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              共有を取り消す
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              共有リンクを作成すると、リンクを知っている人がこの書類を閲覧できます。
            </p>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loading ? "作成中..." : "共有リンクを作成"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
