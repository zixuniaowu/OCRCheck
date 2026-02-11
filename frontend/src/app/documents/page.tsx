"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDocuments, deleteDocument, type DocumentData } from "@/lib/api";
import { formatSize, formatDate } from "@/lib/format";
import StatusBadge from "../_components/StatusBadge";
import ConfirmDialog from "../_components/ConfirmDialog";
import { useToast } from "../_components/Toast";

const statusTabs = [
  { key: "all", label: "すべて" },
  { key: "completed", label: "完了" },
  { key: "processing", label: "処理中" },
  { key: "uploaded", label: "アップロード済" },
  { key: "failed", label: "失敗" },
] as const;

type StatusFilter = (typeof statusTabs)[number]["key"];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id);
      toast("書類を削除しました", "success");
      fetchDocuments();
    } catch {
      toast("削除に失敗しました", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredDocs =
    statusFilter === "all"
      ? documents
      : documents.filter((d) => d.status === statusFilter);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">書類一覧</h2>
        <Link
          href="/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          アップロード
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              statusFilter === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-gray-100 animate-pulse flex gap-4">
              <div className="h-4 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm">
          <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 mb-4">
            {statusFilter === "all" ? "書類がありません" : "該当する書類がありません"}
          </p>
          {statusFilter === "all" ? (
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              書類をアップロード
            </Link>
          ) : (
            <button
              onClick={() => setStatusFilter("all")}
              className="text-blue-600 hover:underline text-sm"
            >
              すべて表示
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-200/60">
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
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-gray-100 hover:bg-blue-50/30 transition"
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
                      {formatDate(doc.created_at)}
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
                            setDeleteTarget({ id: doc.id, name: doc.original_filename })
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-medium text-sm text-blue-600 hover:underline truncate"
                  >
                    {doc.original_filename}
                  </Link>
                  <StatusBadge status={doc.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {doc.content_type.split("/")[1].toUpperCase()} &middot; {formatSize(doc.file_size)}
                    {doc.category && ` &middot; ${doc.category}`}
                  </span>
                  <span>{formatDate(doc.created_at)}</span>
                </div>
                <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100">
                  {doc.download_url && (
                    <a
                      href={doc.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 text-xs"
                    >
                      ダウンロード
                    </a>
                  )}
                  <button
                    onClick={() =>
                      setDeleteTarget({ id: doc.id, name: doc.original_filename })
                    }
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
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

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="書類の削除"
        message={`「${deleteTarget?.name}」を削除しますか？この操作は取り消せません。`}
        confirmLabel="削除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
