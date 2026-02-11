"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  searchDocuments,
  type SearchResponse,
  type SearchHit,
} from "@/lib/api";
import { formatSize } from "@/lib/format";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 20;

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchDocuments({
        q: query || undefined,
        category: category || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        skip: page * limit,
        limit,
      });
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query, category, selectedTags, dateFrom, dateTo, page]);

  useEffect(() => {
    doSearch();
  }, [category, selectedTags, dateFrom, dateTo, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    doSearch();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(0);
  };

  const clearFilters = () => {
    setCategory(null);
    setSelectedTags([]);
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const totalPages = result ? Math.ceil(result.total / limit) : 0;
  const hasFilters = category || selectedTags.length > 0 || dateFrom || dateTo;

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold">書類検索</h2>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードで書類を検索..."
            className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:shadow-md transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPage(0);
                doSearch();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition font-medium"
        >
          検索
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <div className="space-y-4">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-500 hover:text-red-700"
            >
              フィルターをクリア
            </button>
          )}

          {result?.facets.categories && result.facets.categories.length > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="font-semibold mb-3 text-sm">分類</h3>
              <div className="space-y-1">
                {result.facets.categories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setCategory(category === cat.key ? null : cat.key);
                      setPage(0);
                    }}
                    className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-sm transition ${
                      category === cat.key
                        ? "bg-blue-100 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span>{cat.key}</span>
                    <span className="text-xs text-gray-400">{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {result?.facets.tags && result.facets.tags.length > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4">
              <h3 className="font-semibold mb-3 text-sm">タグ</h3>
              <div className="flex flex-wrap gap-1">
                {result.facets.tags.map((tag) => (
                  <button
                    key={tag.key}
                    onClick={() => toggleTag(tag.key)}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      selectedTags.includes(tag.key)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tag.key}
                    <span className="ml-1 opacity-60">{tag.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4">
            <h3 className="font-semibold mb-3 text-sm">書類日付</h3>
            <div className="space-y-2">
              <label className="block text-xs text-gray-500">
                開始日
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(0);
                  }}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </label>
              <label className="block text-xs text-gray-500">
                終了日
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(0);
                  }}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {result && (
            <p className="text-sm text-gray-500">
              {result.total} 件の結果
              {query && (
                <span>
                  {" "}
                  - &quot;{query}&quot;
                </span>
              )}
            </p>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4 animate-pulse">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-48 bg-gray-200 rounded" />
                      <div className="h-4 w-full bg-gray-100 rounded" />
                      <div className="h-4 w-2/3 bg-gray-100 rounded" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-12 bg-gray-200 rounded" />
                      <div className="h-3 w-16 bg-gray-200 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : result && result.hits.length === 0 ? (
            <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm">
              <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500">検索結果がありません</p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-blue-600 hover:underline text-sm"
                >
                  フィルターをクリアして再検索
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {result?.hits.map((hit) => (
                  <SearchResultCard key={hit.document_id} hit={hit} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
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
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
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
      </div>
    </div>
  );
}

function SearchResultCard({ hit }: { hit: SearchHit }) {
  const highlights = hit._highlights || {};

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm p-4 hover:border-blue-300 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/documents/${hit.document_id}`}
              className="text-blue-600 hover:underline font-medium truncate"
            >
              {hit.original_filename}
            </Link>
            {hit.category && (
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium shrink-0">
                {hit.category}
              </span>
            )}
          </div>

          {highlights.summary ? (
            <p
              className="text-sm text-gray-600 mb-2 [&_mark]:bg-yellow-200 [&_mark]:px-0.5"
              dangerouslySetInnerHTML={{
                __html: highlights.summary.join("... "),
              }}
            />
          ) : hit.summary ? (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {hit.summary}
            </p>
          ) : null}

          {highlights.ocr_text && (
            <div className="space-y-1 mb-2">
              {highlights.ocr_text.map((h, i) => (
                <p
                  key={i}
                  className="text-xs text-gray-500 [&_mark]:bg-yellow-200 [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{ __html: `...${h}...` }}
                />
              ))}
            </div>
          )}

          {hit.tags && hit.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {hit.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 text-xs text-gray-400">
            {hit.entities_people?.length > 0 && (
              <span>人名: {hit.entities_people.join(", ")}</span>
            )}
            {hit.entities_organizations?.length > 0 && (
              <span>組織: {hit.entities_organizations.join(", ")}</span>
            )}
          </div>
        </div>

        <div className="text-right text-xs text-gray-400 shrink-0 space-y-1">
          <div>{hit.content_type.split("/")[1].toUpperCase()}</div>
          <div>{formatSize(hit.file_size)}</div>
          {hit.page_count && <div>{hit.page_count}ページ</div>}
          {hit.document_date && <div>{hit.document_date}</div>}
          {hit._score && hit._score > 0 && (
            <div className="text-blue-400">
              スコア: {hit._score.toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
