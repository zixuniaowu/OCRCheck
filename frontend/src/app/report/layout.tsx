import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OCRCheck - 可行性調査報告書",
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-6 -mt-8">
      {children}
    </div>
  );
}
