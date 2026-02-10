"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <svg className="h-20 w-20 text-red-300 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h2 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h2>
      <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
        予期しないエラーが発生しました。再度お試しいただくか、ダッシュボードに戻ってください。
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          再試行
        </button>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  );
}
