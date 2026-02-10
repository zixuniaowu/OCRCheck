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

  if (loading) return <p className="text-gray-500 text-center mt-20">読み込み中...</p>;
  if (error || !doc)
    return (
      <div className="text-center mt-20">
        <p className="text-red-500 text-lg">共有書類が見つかりません</p>
        <p className="text-gray-400 text-sm mt-2">リンクが無効か、共有が取り消された可能性があります。</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">{doc.original_filename}</h2>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
          共有ビュー
        </span>
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
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold mb-2">分類</h3>
              <span className="px-2.5 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {doc.category}
              </span>
            </div>
          )}

          {doc.summary && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold mb-2">要約</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{doc.summary}</p>
            </div>
          )}

          {doc.key_points && doc.key_points.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold mb-2">重要ポイント</h3>
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
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
