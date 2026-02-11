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
      <body className="min-h-screen text-gray-900 antialiased">
        <ToastProvider>
          <Header />

          {/* Animated flowing grid background — global */}
          <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30">
            <div className="absolute inset-0 hero-grid" />
            <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-[120px] animate-float-1" />
            <div className="absolute bottom-0 -right-32 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-[100px] animate-float-2" />
            <div className="absolute top-1/3 left-1/2 w-[300px] h-[300px] bg-cyan-200/15 rounded-full blur-[80px] animate-float-3" />
            <div className="absolute top-2/3 left-1/4 w-[250px] h-[250px] bg-purple-200/10 rounded-full blur-[80px] animate-float-2" />
          </div>

          <main className="relative px-6 py-8">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
