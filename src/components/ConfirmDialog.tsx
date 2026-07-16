"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl px-10 py-8 flex flex-col items-center gap-4 w-full max-w-sm mx-4 shadow-2xl animate-[fadeInScale_0.18s_ease]">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${danger ? "bg-red-100" : "bg-blue-100"}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? "bg-red-500" : "bg-brand-blue"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 6v8M12 17v1" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xl font-bold text-gray-800">{title}</p>
          <p className="text-sm text-gray-500">{message}</p>
        </div>
        <div className="flex gap-3 w-full pt-1">
          <button
            onClick={onCancel}
            className={`flex-1 py-3 rounded-xl font-bold border-2 text-sm transition-colors ${
              danger
                ? "text-red-500 border-red-400 hover:bg-red-50"
                : "text-brand-blue border-brand-blue/40 hover:bg-blue-50"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-bold text-white text-sm hover:brightness-105 transition-all active:scale-95 ${
              danger ? "bg-red-500" : "bg-brand-blue"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
