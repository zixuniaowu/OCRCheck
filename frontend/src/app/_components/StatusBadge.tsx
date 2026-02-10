const statusMap: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "アップロード済", cls: "bg-gray-100 text-gray-600" },
  processing: { label: "処理中", cls: "bg-yellow-100 text-yellow-700 animate-pulse" },
  completed: { label: "完了", cls: "bg-green-100 text-green-700" },
  failed: { label: "失敗", cls: "bg-red-100 text-red-700" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}
