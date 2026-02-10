"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDocuments, type DocumentData } from "@/lib/api";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDocuments(0, 5)
      .then((res) => {
        setDocuments(res.documents);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = {
    uploaded: documents.filter((d) => d.status === "uploaded").length,
    processing: documents.filter((d) => d.status === "processing").length,
    completed: documents.filter((d) => d.status === "completed").length,
    failed: documents.filter((d) => d.status === "failed").length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ダッシュボード</h2>
        <Link
          href="/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          書類をアップロード
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="総書類数" value={total} color="blue" />
        <StatCard label="アップロード済" value={statusCounts.uploaded} color="gray" />
        <StatCard label="処理中" value={statusCounts.processing} color="yellow" />
        <StatCard label="処理完了" value={statusCounts.completed} color="green" />
      </div>

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">最近の書類</h3>
          <Link href="/documents" className="text-blue-600 hover:underline text-sm">
            すべて表示 →
          </Link>
        </div>
        {loading ? (
          <p className="text-gray-500">読み込み中...</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 mb-4">書類がまだアップロードされていません</p>
            <Link
              href="/upload"
              className="text-blue-600 hover:underline"
            >
              最初の書類をアップロード
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">ファイル名</th>
                  <th className="text-left px-4 py-3 font-medium">種類</th>
                  <th className="text-left px-4 py-3 font-medium">サイズ</th>
                  <th className="text-left px-4 py-3 font-medium">ステータス</th>
                  <th className="text-left px-4 py-3 font-medium">アップロード日</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline">
                        {doc.original_filename}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.content_type.split("/")[1]}</td>
                    <td className="px-4 py-3 text-gray-500">{formatSize(doc.file_size)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
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
