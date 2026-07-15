"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { HistoryEntry } from "@/lib/types";
import { getHistory, removeHistory, setActiveId } from "@/lib/history";
import { deleteDataset, loadDataset } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";

export default function RiwayatPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter && e.fileType !== typeFilter) return false;
      if (q && !e.fileName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, search, typeFilter]);

  const handleOpen = async (entry: HistoryEntry) => {
    setOpeningId(entry.id);
    try {
      const data = await loadDataset(entry.id);
      if (!data || data.length === 0) {
        setToast("Dataset tidak ditemukan di penyimpanan lokal. Silakan konversi ulang file.");
        return;
      }
      setActiveId(entry.id);
      localStorage.setItem(
        "active-dataset-meta",
        JSON.stringify({ fileName: entry.fileName, dropped: entry.dropped })
      );
      router.push("/");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    removeHistory(deleteTarget.id);
    deleteDataset(deleteTarget.id).catch(() => { /* dataset mungkin sudah tak ada */ });
    // jika yang dihapus adalah dataset aktif, bersihkan pointer
    if (localStorage.getItem("active-dataset-id") === deleteTarget.id) {
      setActiveId(null);
      localStorage.removeItem("active-dataset-meta");
    }
    setEntries(getHistory());
    setDeleteTarget(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Riwayat Konversi</h1>
          <p className="text-sm text-gray-500 mt-1">Daftar file yang pernah dikonversi — buka ulang atau hapus</p>
        </div>

        {toast && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
            ⚠ {toast}
          </div>
        )}

        {/* Search + filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama file..."
              className="w-full h-[50px] pl-11 pr-4 rounded-[10px] bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`h-[50px] px-4 rounded-[10px] bg-white text-sm outline-none cursor-pointer ${typeFilter ? "text-gray-800 font-medium" : "text-gray-400"}`}
          >
            <option value="">Semua jenis</option>
            <option value="Laporan Transaksi">Laporan Transaksi</option>
            <option value="Pemasukan Pajak Pemda">Pemasukan Pajak Pemda</option>
          </select>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl py-20 flex flex-col items-center gap-4 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 7v7l4.5 2.7" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="14" r="11" stroke="#9ca3af" strokeWidth="2" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                {entries.length === 0 ? "Belum ada riwayat konversi" : "Tidak ada yang cocok dengan pencarian"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {entries.length === 0
                  ? "Konversi file pertama Anda melalui halaman Dashboard."
                  : "Coba ubah kata kunci atau filter jenis file."}
              </p>
            </div>
            {entries.length === 0 && (
              <button
                onClick={() => router.push("/")}
                className="mt-1 px-6 py-2.5 rounded-[10px] text-sm font-semibold text-white bg-brand-blue hover:brightness-110 transition-all"
              >
                Ke Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((e) => {
              const ok = e.status === "ok";
              return (
                <div
                  key={e.id}
                  className="relative bg-white rounded-[14px] px-6 py-5 flex items-center gap-5 shadow-[0_2px_8px_rgba(16,24,40,0.04)] border border-gray-100 overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${ok ? "bg-green-500" : "bg-red-500"}`} />
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${ok ? "bg-green-50" : "bg-red-50"}`}>
                    {ok ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="2" width="18" height="20" rx="2.5" stroke="#00AA42" strokeWidth="1.8" />
                        <path d="M7 8h10M7 12h10M7 16h6" stroke="#00AA42" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M5 5l14 14M19 5L5 19" stroke="#E02D0D" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{e.fileName}</p>
                    <div className="flex items-center gap-4 mt-1 text-[13px] flex-wrap">
                      <span className="text-gray-400">🕒 {formatDateTime(e.convertedAt)}</span>
                      {ok ? (
                        <>
                          <span className="text-gray-500">{formatNumber(e.rowCount)} baris</span>
                          {e.dropped > 0 && (
                            <span className="text-amber-600">{formatNumber(e.dropped)} baris dibuang</span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-600" title={e.errorMsg}>Konversi gagal</span>
                      )}
                    </div>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-brand-blue">
                      {e.fileType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {ok ? (
                      <button
                        onClick={() => handleOpen(e)}
                        disabled={openingId === e.id}
                        className="px-5 h-11 rounded-[10px] text-sm font-semibold text-white bg-brand-blue hover:brightness-110 transition-all disabled:opacity-60"
                      >
                        {openingId === e.id ? "Membuka..." : "Buka Ulang"}
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push("/")}
                        className="px-5 h-11 rounded-[10px] text-sm font-semibold text-white bg-brand-orange hover:brightness-105 transition-all"
                      >
                        Coba Lagi
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(e)}
                      className="w-11 h-11 rounded-[10px] bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title="Hapus dari riwayat"
                    >
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                        <path d="M3 5h14M8 5V3h4v2M6 5l1 12h6l1-12" stroke="#E02D0D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus riwayat ini?"
        message={`"${deleteTarget?.fileName}" beserta dataset tersimpannya akan dihapus permanen.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
