"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  uploadDocumentWithProgress,
  getDocument,
  type UploadResponse,
} from "@/lib/api";
import { formatSize } from "@/lib/format";
import Link from "next/link";

type UploadPhase = "pending" | "uploading" | "uploaded" | "processing" | "completed" | "failed" | "error";

interface FileUploadState {
  file: File;
  phase: UploadPhase;
  uploadPercent: number;
  result?: UploadResponse;
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [uploading, setUploading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      phase: "pending" as const,
      uploadPercent: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/tiff": [".tif", ".tiff"],
      "image/bmp": [".bmp"],
    },
    maxSize: 100 * 1024 * 1024,
  });

  useEffect(() => {
    const hasActive = files.some(
      (f) => f.phase === "uploading" || f.phase === "uploaded" || f.phase === "processing"
    );
    if (!hasActive) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [files]);

  useEffect(() => {
    const needsPolling = files.some(
      (f) => f.phase === "uploaded" || f.phase === "processing"
    );

    if (!needsPolling) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      setFiles((prev) => {
        const toCheck = prev.filter(
          (f) => (f.phase === "uploaded" || f.phase === "processing") && f.result?.id
        );
        if (toCheck.length === 0) return prev;

        toCheck.forEach((f) => {
          getDocument(f.result!.id)
            .then((doc) => {
              if (doc.status === "completed" || doc.status === "failed") {
                setFiles((cur) =>
                  cur.map((item) =>
                    item.result?.id === doc.id
                      ? { ...item, phase: doc.status as UploadPhase }
                      : item
                  )
                );
              } else if (doc.status === "processing") {
                setFiles((cur) =>
                  cur.map((item) =>
                    item.result?.id === doc.id && item.phase === "uploaded"
                      ? { ...item, phase: "processing" }
                      : item
                  )
                );
              }
            })
            .catch(() => {});
        });

        return prev;
      });
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [files]);

  const handleUploadAll = async () => {
    setUploading(true);
    const updated = [...files];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].phase !== "pending") continue;

      updated[i] = { ...updated[i], phase: "uploading", uploadPercent: 0 };
      setFiles([...updated]);

      try {
        const result = await uploadDocumentWithProgress(
          updated[i].file,
          (percent) => {
            updated[i] = { ...updated[i], uploadPercent: percent };
            setFiles([...updated]);
          }
        );
        updated[i] = { ...updated[i], phase: "uploaded", uploadPercent: 100, result };
      } catch (e) {
        updated[i] = {
          ...updated[i],
          phase: "error",
          error: e instanceof Error ? e.message : "Upload failed",
        };
      }
      setFiles([...updated]);
    }
    setUploading(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.phase !== "completed" && f.phase !== "failed"));
  };

  const pendingCount = files.filter((f) => f.phase === "pending").length;
  const doneCount = files.filter((f) => f.phase === "completed").length;
  const activeCount = files.filter(
    (f) => f.phase === "uploading" || f.phase === "uploaded" || f.phase === "processing"
  ).length;
  const allDone = files.length > 0 && pendingCount === 0 && activeCount === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold">書類アップロード</h2>

      {/* Success banner */}
      {allDone && doneCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-green-700 text-sm font-medium">
            {doneCount} 件の書類が正常に処理されました
          </span>
          <Link href="/documents" className="ml-auto text-green-700 hover:text-green-800 text-sm underline">
            書類一覧を見る
          </Link>
        </div>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg
            className={`mx-auto h-12 w-12 transition ${isDragActive ? "text-blue-500 animate-pulse" : "text-gray-400"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {isDragActive ? (
            <p className="text-blue-600 font-medium">ここにドロップしてください</p>
          ) : (
            <>
              <p className="text-gray-600">
                ファイルをドラッグ＆ドロップ、またはクリックして選択
              </p>
              <p className="text-gray-400 text-sm">
                対応形式: PDF, JPEG, PNG, TIFF, BMP (最大100MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {files.length} ファイル選択済み
              {doneCount > 0 && ` (${doneCount} 件処理完了)`}
              {activeCount > 0 && ` (${activeCount} 件処理中)`}
            </p>
            <div className="flex gap-2">
              {(doneCount > 0 || files.some((f) => f.phase === "failed")) && (
                <button
                  onClick={clearCompleted}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  完了分をクリア
                </button>
              )}
              {pendingCount > 0 && (
                <button
                  onClick={handleUploadAll}
                  disabled={uploading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700
                    disabled:bg-blue-300 transition text-sm font-medium"
                >
                  {uploading ? "アップロード中..." : `${pendingCount} 件をアップロード`}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/60 shadow-sm divide-y divide-gray-100">
            {files.map((f, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <FileIcon contentType={f.file.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatSize(f.file.size)}
                      {f.error && (
                        <span className="text-red-500 ml-2">{f.error}</span>
                      )}
                    </p>
                  </div>
                  <PhaseIndicator phase={f.phase} uploadPercent={f.uploadPercent} />
                  {f.phase === "pending" && (
                    <button
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      削除
                    </button>
                  )}
                  {f.phase === "completed" && f.result && (
                    <Link
                      href={`/documents/${f.result.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      詳細
                    </Link>
                  )}
                </div>
                {(f.phase === "uploading" || f.phase === "uploaded" || f.phase === "processing") && (
                  <div className="mt-2 ml-14">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          f.phase === "uploading"
                            ? "bg-blue-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width:
                            f.phase === "uploading"
                              ? `${f.uploadPercent}%`
                              : "100%",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileIcon({ contentType }: { contentType: string }) {
  const isPdf = contentType === "application/pdf";
  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold
      ${isPdf ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
    >
      {isPdf ? "PDF" : "IMG"}
    </div>
  );
}

function PhaseIndicator({
  phase,
  uploadPercent,
}: {
  phase: UploadPhase;
  uploadPercent: number;
}) {
  switch (phase) {
    case "pending":
      return <span className="text-xs text-gray-400">待機中</span>;
    case "uploading":
      return (
        <span className="text-xs text-blue-600 flex items-center gap-1 tabular-nums">
          <Spinner />
          アップロード中 {uploadPercent}%
        </span>
      );
    case "uploaded":
      return (
        <span className="text-xs text-amber-600 flex items-center gap-1">
          <Spinner />
          OCR処理待ち
        </span>
      );
    case "processing":
      return (
        <span className="text-xs text-amber-600 flex items-center gap-1">
          <Spinner />
          OCR処理中...
        </span>
      );
    case "completed":
      return (
        <span className="text-xs text-green-600 flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          完了
        </span>
      );
    case "failed":
      return <span className="text-xs text-red-600">OCR失敗</span>;
    case "error":
      return <span className="text-xs text-red-600">エラー</span>;
    default:
      return null;
  }
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
