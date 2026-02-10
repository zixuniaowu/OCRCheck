import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCRCheck - 書類管理システム",
  description: "書類スキャン・OCR・AI管理システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-700">
              OCRCheck
            </h1>
            <nav className="flex gap-6 text-sm">
              <a href="/" className="hover:text-blue-600">
                ダッシュボード
              </a>
              <a href="/upload" className="hover:text-blue-600">
                アップロード
              </a>
              <a href="/search" className="hover:text-blue-600">
                検索
              </a>
              <a href="/documents" className="hover:text-blue-600">
                書類一覧
              </a>
            </nav>
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
