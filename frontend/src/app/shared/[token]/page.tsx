"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSharedDocument, type DocumentData, type Entities } from "@/lib/api";

export default function SharedDocumentPage() {
  const params = useParams();
  const token = params.token as string;
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSharedDocument(token)
      .then(setDoc)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in mt-4">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-[500px] bg-gray-100 rounded-lg animate-pulse" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-4 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="text-center mt-20 animate-fade-in">
        <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        <p className="text-red-500 text-lg font-medium">共有書類が見つかりません</p>
        <p className="text-gray-400 text-sm mt-2">リンクが無効か、共有が取り消された可能性があります。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Share banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-blue-700 text-sm">この書類は共有リンクで閲覧しています</span>
      </div>

      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">{doc.original_filename}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Document preview */}
        <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          {doc.download_url ? (
            doc.content_type === "application/pdf" ? (
              <iframe
                src={doc.download_url}
                className="w-full h-[600px] rounded border"
                title="PDF Preview"
              />
            ) : (
              <img
                src={doc.download_url}
                alt={doc.original_filename}
                className="max-w-full rounded"
              />
            )
          ) : (
            <p className="text-gray-500">プレビューを表示できません</p>
          )}
        </div>

        {/* Info sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">書類情報</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">形式</dt>
                <dd className="font-medium">{doc.content_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">ページ数</dt>
                <dd className="font-medium">{doc.page_count ?? "-"}</dd>
              </div>
            </dl>
          </div>

          {doc.category && (
            <div className="bg-white rounded-lg border border-gray-200 border-t-4 border-t-purple-400 p-4">
              <h3 className="font-semibold mb-2">分類</h3>
              <span className="px-2.5 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {doc.category}
              </span>
            </div>
          )}

          {doc.summary && (
            <div className="bg-white rounded-lg border border-gray-200 border-t-4 border-t-blue-400 p-4">
              <h3 className="font-semibold mb-2">要約</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{doc.summary}</p>
            </div>
          )}

          {doc.key_points && doc.key_points.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 border-t-4 border-t-green-400 p-4">
              <h3 className="font-semibold mb-2">重要ポイント</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                {doc.key_points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-green-500 shrink-0">-</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.entities && <SharedEntitiesCard entities={doc.entities} />}
        </div>
      </div>
    </div>
  );
}

function SharedEntitiesCard({ entities }: { entities: Entities }) {
  const sections: { key: keyof Entities; label: string }[] = [
    { key: "people", label: "人名" },
    { key: "organizations", label: "組織名" },
    { key: "dates", label: "日付" },
    { key: "amounts", label: "金額" },
    { key: "addresses", label: "住所" },
    { key: "references", label: "参照番号" },
  ];

  const hasAny = sections.some(
    (s) => entities[s.key] && entities[s.key].length > 0
  );
  if (!hasAny) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 border-t-4 border-t-amber-400 p-4">
      <h3 className="font-semibold mb-2">抽出エンティティ</h3>
      <div className="space-y-2">
        {sections.map((s) => {
          const items = entities[s.key];
          if (!items || items.length === 0) return null;
          return (
            <div key={s.key} className="text-sm">
              <span className="text-gray-500">{s.label}: </span>
              <span className="text-gray-800">{items.join(", ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
