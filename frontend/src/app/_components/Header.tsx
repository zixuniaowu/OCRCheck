"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "ダッシュボード" },
  { href: "/upload", label: "アップロード" },
  { href: "/search", label: "検索" },
  { href: "/documents", label: "書類一覧" },
  { href: "/report", label: "調査報告書" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isShared = pathname.startsWith("/shared/");

  return (
    <header className="sticky top-0 z-30 backdrop-blur-sm bg-white/95 border-b border-gray-200 shadow-sm">
      <div className="px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="2" width="20" height="26" rx="2" stroke="#2563EB" strokeWidth="2" fill="#EFF6FF" />
            <path d="M9 10h10M9 14h10M9 18h6" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="22" cy="22" r="8" fill="#2563EB" />
            <path d="M19 22l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xl font-bold">
            <span className="text-blue-600">OCR</span>
            <span className="text-gray-800">Check</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {!isShared && (
          <nav className="hidden md:flex gap-1 text-sm">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    isActive
                      ? "text-blue-600 font-medium bg-blue-50"
                      : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Shared view badge */}
        {isShared && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            共有ビュー
          </span>
        )}

        {/* Mobile hamburger */}
        {!isShared && (
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            aria-label="メニュー"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && !isShared && (
        <nav className="md:hidden border-t border-gray-100 bg-white px-4 pb-3 animate-fade-in">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? "text-blue-600 font-medium bg-blue-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
