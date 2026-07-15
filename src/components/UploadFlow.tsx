"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseWorkbook, parseCsvText } from "@/lib/parser";
import { formatBytes } from "@/lib/format";
import type { ParseResult } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; file: File; progress: number }
  | { status: "ready"; file: File; buffer: ArrayBuffer | string }
  | { status: "failed"; file: File }
  | { status: "converting"; file: File };

interface Props {
  fileType: "Laporan Transaksi" | "Pemasukan Pajak Pemda";
  onFileTypeChange: (t: "Laporan Transaksi" | "Pemasukan Pajak Pemda") => void;
  onConverted: (result: ParseResult, fileName: string) => void;
  onConvertFailed: (fileName: string, message: string) => void;
}

function FileIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="10" fill="#E8F5E9" />
      <rect x="9" y="7" width="26" height="30" rx="3" fill="white" stroke="#34A853" strokeWidth="1.5" />
      <rect x="13" y="13" width="18" height="2.5" rx="1.25" fill="#34A853" />
      <rect x="13" y="18" width="18" height="2.5" rx="1.25" fill="#34A853" />
      <rect x="13" y="23" width="12" height="2.5" rx="1.25" fill="#34A853" />
      <text x="22" y="35.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#34A853" letterSpacing="0.5">XLS</text>
    </svg>
  );
}

function UploadCloudIcon({ active }: { active?: boolean }) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={`transition-transform duration-300 ${active ? "scale-110" : ""}`}>
      <path
        d="M48 48H52C58.627 48 64 42.627 64 36C64 29.373 58.627 24 52 24H51.16C49.68 16.08 42.68 10 34 10C24.059 10 16 18.059 16 28C16 28.336 16.012 28.669 16.036 29C10.942 30.7 7.28 35.49 7.28 41C7.28 47.627 12.653 53 19.28 53H24"
        stroke={active ? "#F9A13F" : "#6B7280"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M44 46L36 38L28 46" stroke={active ? "#F9A13F" : "#6B7280"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 38V62" stroke={active ? "#F9A13F" : "#6B7280"} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function UploadFlow({ fileType, onFileTypeChange, onConverted, onConvertFailed }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);

  useEffect(() => {
    if (invalidMsg) {
      const t = setTimeout(() => setInvalidMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [invalidMsg]);

  const handleFile = useCallback((file: File) => {
    const validExt = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!validExt) {
      setInvalidMsg("Format file tidak didukung. Gunakan Excel (.xlsx/.xls) atau CSV.");
      return;
    }
    readerRef.current?.abort();

    const reader = new FileReader();
    readerRef.current = reader;
    setState({ status: "uploading", file, progress: 0 });

    reader.onprogress = (e) => {
      if (e.lengthComputable) setState({ status: "uploading", file, progress: (e.loaded / e.total) * 90 });
    };
    reader.onload = (e) => {
      const data = e.target?.result;
      setState({ status: "uploading", file, progress: 95 });
      setTimeout(() => {
        try {
          if (file.name.toLowerCase().endsWith(".csv")) {
            if (typeof data !== "string" || data.trim().length === 0) throw new Error("empty");
            setState({ status: "ready", file, buffer: data });
          } else {
            const bytes = new Uint8Array(data as ArrayBuffer);
            const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b;
            const isXls = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
            if (!isXlsx && !isXls) throw new Error("bad magic bytes");
            setState({ status: "ready", file, buffer: data as ArrayBuffer });
          }
        } catch {
          setState({ status: "failed", file });
          setInvalidMsg("File rusak atau tidak valid. Silahkan gunakan file Excel yang benar.");
        }
      }, 50);
    };
    reader.onerror = () => {
      setState({ status: "failed", file });
      setInvalidMsg("Gagal membaca file. Silahkan coba lagi.");
    };

    if (file.name.toLowerCase().endsWith(".csv")) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }, []);

  const handleConvert = () => {
    if (state.status !== "ready") return;
    const { file, buffer } = state;
    setState({ status: "converting", file });
    // beri waktu browser paint spinner sebelum parsing (blocking) berjalan
    setTimeout(() => {
      try {
        const result =
          typeof buffer === "string" ? parseCsvText(buffer) : parseWorkbook(buffer);
        if (result.rows.length === 0) {
          throw new Error(
            "Tidak ada baris valid. Pastikan sheet 'Data Transaksi' berisi data pipe-delimited (|)."
          );
        }
        onConverted(result, file.name);
      } catch (err) {
        setState({ status: "failed", file });
        const msg = err instanceof Error ? err.message : "Konversi gagal.";
        setInvalidMsg(msg);
        onConvertFailed(file.name, msg);
      }
    }, 80);
  };

  const isConverting = state.status === "converting";
  const hasFile = state.status === "uploading" || state.status === "ready" || state.status === "failed";
  const uploadedBytes = state.status === "uploading" ? state.file.size * (state.progress / 100) : "file" in state ? state.file.size : 0;
  const totalBytes = "file" in state ? state.file.size : 0;

  if (isConverting) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-full max-w-3xl rounded-2xl flex flex-col items-center justify-center py-28 gap-7 bg-[#f5f5f5] border-2 border-dashed border-brand-orange">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="animate-spin">
            <circle cx="32" cy="32" r="26" stroke="#E5E7EB" strokeWidth="5" />
            <path d="M32 6A26 26 0 0 1 58 32" stroke="#2353B9" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <div className="text-center space-y-1.5">
            <p className="text-xl font-bold text-gray-800">Mengonversi file anda...</p>
            <p className="text-sm text-gray-500">Parsing data mentah menjadi tabel bersih 12 kolom</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-5">
      {/* Pilih jenis file */}
      <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 shadow-sm">
        {(["Laporan Transaksi", "Pemasukan Pajak Pemda"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onFileTypeChange(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              fileType === t ? "bg-brand-blue text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col items-center py-14 px-10 gap-6 relative transition-all duration-200 border-2 border-dashed border-brand-orange"
        style={{
          background: isDragging ? "#FFF8EC" : "#F5F5F5",
          boxShadow: isDragging ? "0 0 0 4px rgba(249,161,63,0.15)" : "none",
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <UploadCloudIcon active={isDragging} />
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800 mb-1">
            {isDragging ? "Lepaskan file di sini" : "Pilih atau tarik file"}
          </p>
          <p className="text-sm text-gray-500">Format file yang didukung adalah Excel &amp; CSV</p>
        </div>

        {invalidMsg && (
          <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
              <circle cx="10" cy="10" r="10" fill="#EF4444" />
              <path d="M10 6v4.5M10 13.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {invalidMsg}
          </div>
        )}

        {hasFile && (
          <div className="w-full rounded-xl bg-white px-5 py-4 flex flex-col gap-3 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <FileIcon />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{"file" in state ? state.file.name : ""}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {state.status === "uploading"
                    ? `${formatBytes(uploadedBytes)} dari ${formatBytes(totalBytes)}`
                    : formatBytes(totalBytes)}
                </p>
              </div>

              {state.status === "uploading" && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="4.5" stroke="#D1D5DB" strokeWidth="2" />
                    <path d="M6.5 2A4.5 4.5 0 0 1 11 6.5" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Membaca...
                </div>
              )}
              {state.status === "ready" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#22C55E" />
                    <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold text-green-600">Selesai!</p>
                    <p className="text-green-500">Mulai konversi file</p>
                  </div>
                </div>
              )}
              {state.status === "failed" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="10" fill="#EF4444" />
                    <path d="M10 6v4.5M10 13.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold text-red-600">Gagal!</p>
                    <p className="text-red-500">Silahkan coba lagi!</p>
                  </div>
                </div>
              )}

              {state.status === "uploading" ? (
                <button
                  onClick={() => {
                    readerRef.current?.abort();
                    setState({ status: "idle" });
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="shrink-0 ml-1 text-gray-300 hover:text-gray-500 transition-colors rounded-full p-1 hover:bg-gray-100"
                  title="Batalkan"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="shrink-0 ml-1 p-1.5 rounded-lg hover:bg-red-50 transition-colors group"
                  title="Hapus file"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M8 5V3h4v2M6 5l1 12h6l1-12" className="stroke-gray-400 group-hover:stroke-red-500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            {state.status === "uploading" && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Membaca file...</span>
                  <span className="text-xs font-semibold text-gray-600">{Math.round(state.progress)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-[width]" style={{ width: `${state.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {state.status === "idle" && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all hover:brightness-105 active:scale-95 bg-brand-orange"
            >
              Browse File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </>
        )}

        {(state.status === "ready" || state.status === "failed") && (
          <button
            onClick={handleConvert}
            disabled={state.status === "failed"}
            className={`px-10 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-95 bg-brand-orange ${
              state.status === "ready" ? "hover:brightness-105 cursor-pointer" : "opacity-40 cursor-not-allowed"
            }`}
          >
            Convert File
          </button>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Hapus file ini?"
        message="Apakah anda yakin ingin menghapus file yang telah di upload?"
        onConfirm={() => {
          setDeleteOpen(false);
          setState({ status: "idle" });
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
