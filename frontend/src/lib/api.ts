// Use nullish coalescing: empty string "" means "same origin" (HF Spaces),
// only fall back to localhost when the env var is truly unset.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9001";

export interface Entities {
  people: string[];
  organizations: string[];
  dates: string[];
  amounts: string[];
  addresses: string[];
  references: string[];
}

export interface DocumentData {
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  s3_key: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  page_count: number | null;
  category: string | null;
  category_confidence: number | null;
  summary: string | null;
  tags: string[] | null;
  entities: Entities | null;
  document_date: string | null;
  key_points: string[] | null;
  ocr_text: string | null;
  share_token: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  download_url: string | null;
}

export interface DocumentListResponse {
  documents: DocumentData[];
  total: number;
}

export interface UploadResponse {
  id: string;
  filename: string;
  status: string;
  message: string;
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export function uploadDocumentWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", `${API_BASE}/api/documents/upload`);
    xhr.send(formData);
  });
}

export async function uploadDocumentsBatch(
  files: File[]
): Promise<UploadResponse[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await fetch(`${API_BASE}/api/documents/upload-batch`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Batch upload failed");
  }
  return res.json();
}

export async function listDocuments(
  skip = 0,
  limit = 50
): Promise<DocumentListResponse> {
  const res = await fetch(
    `${API_BASE}/api/documents/?skip=${skip}&limit=${limit}`
  );
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentData> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

// --- OCR Results ---

export interface OCRBlock {
  text: string;
  bbox: number[];
  confidence: number;
}

export interface OCRTable {
  bbox: number[];
  html: string;
}

export interface OCRPageData {
  id: string;
  document_id: string;
  page_number: number;
  width: number;
  height: number;
  full_text: string | null;
  blocks: OCRBlock[] | null;
  tables: OCRTable[] | null;
  confidence: number | null;
  page_image_url: string | null;
  created_at: string;
}

export async function getOCRResults(documentId: string): Promise<OCRPageData[]> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/ocr`);
  if (!res.ok) throw new Error("Failed to fetch OCR results");
  return res.json();
}

export async function reprocessDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/reprocess`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to reprocess document");
}

// --- Search ---

export interface SearchHit {
  document_id: string;
  original_filename: string;
  content_type: string;
  ocr_text: string;
  summary: string;
  category: string | null;
  tags: string[];
  entities_people: string[];
  entities_organizations: string[];
  page_count: number | null;
  file_size: number;
  document_date: string | null;
  created_at: string;
  _score: number | null;
  _highlights: Record<string, string[]>;
}

export interface FacetBucket {
  key: string;
  count: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  facets: {
    categories: FacetBucket[];
    tags: FacetBucket[];
  };
}

export async function searchDocuments(params: {
  q?: string;
  category?: string;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}): Promise<SearchResponse> {
  const url = new URL(
    `${API_BASE}/api/search/`,
    typeof window !== "undefined" ? window.location.origin : undefined
  );
  if (params.q) url.searchParams.set("q", params.q);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.tags) {
    params.tags.forEach((t) => url.searchParams.append("tags", t));
  }
  if (params.date_from) url.searchParams.set("date_from", params.date_from);
  if (params.date_to) url.searchParams.set("date_to", params.date_to);
  if (params.skip) url.searchParams.set("skip", String(params.skip));
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

// --- Comments ---

export interface CommentData {
  id: string;
  document_id: string;
  page_number: number | null;
  content: string;
  author: string;
  region: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export async function listComments(
  documentId: string,
  pageNumber?: number
): Promise<CommentData[]> {
  const url = new URL(
    `${API_BASE}/api/documents/${documentId}/comments/`,
    typeof window !== "undefined" ? window.location.origin : undefined
  );
  if (pageNumber !== undefined)
    url.searchParams.set("page_number", String(pageNumber));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

export async function createComment(
  documentId: string,
  data: { content: string; page_number?: number; author?: string; region?: Record<string, number> }
): Promise<CommentData> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/comments/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error("Failed to create comment");
  return res.json();
}

export async function updateComment(
  documentId: string,
  commentId: string,
  content: string
): Promise<CommentData> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/comments/${commentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (!res.ok) throw new Error("Failed to update comment");
  return res.json();
}

export async function deleteComment(
  documentId: string,
  commentId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/comments/${commentId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete comment");
}

// --- OCR Text Correction ---

export async function correctOCRText(
  documentId: string,
  pageNumber: number,
  fullText: string
): Promise<OCRPageData> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/ocr/${pageNumber}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_text: fullText }),
    }
  );
  if (!res.ok) throw new Error("Failed to update OCR text");
  return res.json();
}

// --- Sharing ---

export interface ShareData {
  share_token: string;
  share_url: string;
  is_public: boolean;
}

export async function createShareLink(
  documentId: string,
  isPublic = true
): Promise<ShareData> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/share`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: isPublic }),
    }
  );
  if (!res.ok) throw new Error("Failed to create share link");
  return res.json();
}

export async function revokeShareLink(documentId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/share`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to revoke share link");
}

export async function getSharedDocument(
  shareToken: string
): Promise<DocumentData> {
  const res = await fetch(`${API_BASE}/api/shared/${shareToken}`);
  if (!res.ok) throw new Error("Shared document not found");
  return res.json();
}
