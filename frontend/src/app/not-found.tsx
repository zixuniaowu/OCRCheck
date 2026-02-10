import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <svg className="h-20 w-20 text-gray-300 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
      <h2 className="text-4xl font-bold text-gray-800 mb-2">404</h2>
      <p className="text-gray-500 text-sm mb-6">ページが見つかりません</p>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
      >
        ダッシュボードに戻る
      </Link>
    </div>
  );
}
