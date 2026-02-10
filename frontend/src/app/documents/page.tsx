"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDocuments, deleteDocument, type DocumentData } from "@/lib/api";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchDocuments = () => {
    setLoading(true);
    listDocuments(page * limit, limit)
      .then((res) => {
        setDocuments(res.documents);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocuments();
  }, [page]);

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`「${filename}」を削除しますか？`)) return;
    try {
      await deleteDocument(id);
      fetchDocuments();
    } catch (e) {
      alert("削除に失敗しました");
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">書類一覧</h2>
        <Link
          href="/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
        >
          アップロード
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">書類がありません</p>
          <Link href="/upload" className="text-blue-600 hover:underline">
            書類をアップロード
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">ファイル名</th>
                  <th className="text-left px-4 py-3 font-medium">種類</th>
                  <th className="text-left px-4 py-3 font-medium">サイズ</th>
                  <th className="text-left px-4 py-3 font-medium">ステータス</th>
                  <th className="text-left px-4 py-3 font-medium">分類</th>
                  <th className="text-left px-4 py-3 font-medium">アップロード日</th>
                  <th className="text-left px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {doc.original_filename}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {doc.content_type.split("/")[1].toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {doc.category || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {doc.download_url && (
                          <a
                            href={doc.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 text-xs"
                          >
                            DL
                          </a>
                        )}
                        <button
                          onClick={() =>
                            handleDelete(doc.id, doc.original_filename)
                          }
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              >
                前へ
              </button>
              <span className="text-sm text-gray-600">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    uploaded: { label: "アップロード済", cls: "bg-gray-100 text-gray-600" },
    processing: { label: "処理中", cls: "bg-yellow-100 text-yellow-700" },
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
