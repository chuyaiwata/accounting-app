"use client";

import { useState, useEffect } from "react";
import { getReceiptImage } from "@/lib/actions/receipts";
import { X, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  fileId: string;
  onClose: () => void;
}

export default function ReceiptPreviewModal({ fileId, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDataUrl(null);
    getReceiptImage(fileId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDataUrl(result.dataUrl);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--bg-hover)] text-white transition"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        className="max-w-4xl max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="text-white flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            読み込み中...
          </div>
        )}
        {error && (
          <div className="text-[#f87171] flex items-start gap-2 px-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {dataUrl && (
          <img
            src={dataUrl}
            alt="レシート"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  );
}
