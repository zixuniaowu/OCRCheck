export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ja-JP");
}
