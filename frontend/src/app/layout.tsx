import type { Metadata } from "next";
import "./globals.css";
import Header from "./_components/Header";
import { ToastProvider } from "./_components/Toast";

export const metadata: Metadata = {
  title: "OCRCheck - 書類管理システム",
  description: "書類スキャン・OCR・AI管理システム",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen antialiased">
        <ToastProvider>
          <Header />
          <main className="px-6 py-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
