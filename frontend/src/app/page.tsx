"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDocuments, type DocumentData } from "@/lib/api";
import { formatSize, formatDate } from "@/lib/format";
import StatusBadge from "./_components/StatusBadge";

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
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
          <p className="text-gray-400 text-sm mt-1">書類の処理状況と統計</p>
        </div>
        <Link
          href="/upload"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
        >
          書類をアップロード
        </Link>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-5 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="総書類数" value={total} icon="doc" color="blue" />
          <StatCard label="アップロード済" value={statusCounts.uploaded} icon="upload" color="gray" />
          <StatCard label="処理中" value={statusCounts.processing} icon="processing" color="yellow" />
          <StatCard label="処理完了" value={statusCounts.completed} icon="check" color="green" />
        </div>
      )}

      {/* Recent Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">最近の書類</h3>
          <Link href="/documents" className="text-blue-600 hover:underline text-sm">
            すべて表示 &rarr;
          </Link>
        </div>
        {loading ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 border-b border-gray-100 animate-pulse flex gap-4">
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
                <div className="h-4 w-20 bg-gray-100 rounded" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm">
            <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 mb-4">書類がまだアップロードされていません</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              最初の書類をアップロード
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-200/60">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">ファイル名</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">種類</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">サイズ</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">ステータス</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">アップロード日</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition">
                      <td className="px-5 py-3.5">
                        <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline">
                          {doc.original_filename}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{doc.content_type.split("/")[1]}</td>
                      <td className="px-5 py-3.5 text-gray-500">{formatSize(doc.file_size)}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{formatDate(doc.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="block bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate text-blue-600">{doc.original_filename}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {doc.content_type.split("/")[1]} &middot; {formatSize(doc.file_size)} &middot; {formatDate(doc.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, { border: string; iconColor: string }> = {
    blue: { border: "border-l-blue-500", iconColor: "text-blue-500" },
    gray: { border: "border-l-gray-400", iconColor: "text-gray-400" },
    yellow: { border: "border-l-yellow-500", iconColor: "text-yellow-500" },
    green: { border: "border-l-green-500", iconColor: "text-green-500" },
  };
  const c = colorMap[color] || colorMap.blue;

  const icons: Record<string, React.ReactNode> = {
    doc: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    upload: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    processing: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
    check: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 border-l-4 ${c.border} shadow-sm p-5 hover:shadow-md transition group`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${c.iconColor} opacity-40 group-hover:opacity-60 transition`}>
          {icons[icon]}
        </div>
      </div>
    </div>
  );
}
