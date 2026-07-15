"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import UploadFlow from "@/components/UploadFlow";
import KpiCard from "@/components/KpiCard";
import Pagination from "@/components/Pagination";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import { StatusBadge } from "@/components/Badges";
import type { CleanRow, ParseResult } from "@/lib/types";
import { aggregateByDay, aggregateByStatus, isFailed, isSuccess } from "@/lib/aggregate";
import { formatNumber, formatRupiah, formatRupiahCompact, formatTanggal } from "@/lib/format";
import { exportCsv, exportXlsx } from "@/lib/export";
import { saveDataset, loadDataset } from "@/lib/db";
import { addHistory, getActiveId, newId, setActiveId } from "@/lib/history";

const PAGE_SIZE = 10;

type FileType = "Laporan Transaksi" | "Pemasukan Pajak Pemda";

function DashboardInner() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<CleanRow[] | null>(null);
  const [meta, setMeta] = useState<{ fileName: string; dropped: number } | null>(null);
  const [fileType, setFileType] = useState<FileType>("Laporan Transaksi");
  const [loading, setLoading] = useState(true);

  // filter state
  const [search, setSearch] = useState("");
  const [kanal, setKanal] = useState("");
  const [status, setStatus] = useState("");
  const [instansi, setInstansi] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [selectedRow, setSelectedRow] = useState<CleanRow | null>(null);

  // Drill-down dari halaman Analitik: /?corpid=XXX.
  // Pola "adjust state during render": saat param berubah, terapkan sebagai filter instansi.
  const corpidParam = searchParams.get("corpid") ?? "";
  const [seenCorpidParam, setSeenCorpidParam] = useState(corpidParam);
  if (corpidParam !== seenCorpidParam) {
    setSeenCorpidParam(corpidParam);
    if (corpidParam) {
      setInstansi(corpidParam);
      setPage(1);
    }
  }

  // Muat dataset aktif (hasil konversi terakhir / dibuka dari Riwayat)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = getActiveId();
        if (!id) return;
        const data = await loadDataset(id);
        if (cancelled) return;
        if (data && data.length) {
          setRows(data);
          try {
            const metaRaw = localStorage.getItem("active-dataset-meta");
            if (metaRaw) setMeta(JSON.parse(metaRaw));
          } catch { /* meta opsional */ }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tutup dropdown export saat klik di luar
  useEffect(() => {
    if (!exportOpen) return;
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [exportOpen]);

  const handleConverted = useCallback(
    (result: ParseResult, fileName: string) => {
      const id = newId();
      setRows(result.rows);
      const m = { fileName, dropped: result.dropped };
      setMeta(m);
      localStorage.setItem("active-dataset-meta", JSON.stringify(m));
      setActiveId(id);
      // reset filter dari sesi sebelumnya
      setSearch(""); setKanal(""); setStatus(""); setInstansi(""); setPage(1);
      // persist: dataset ke IndexedDB, metadata ke localStorage
      saveDataset(id, result.rows).catch(() => {
        // simpan riwayat tetap jalan walau IndexedDB gagal (mis. private mode)
      });
      addHistory({
        id,
        fileName,
        convertedAt: new Date().toISOString(),
        rowCount: result.rows.length,
        dropped: result.dropped,
        fileType,
        status: "ok",
      });
    },
    [fileType]
  );

  const handleConvertFailed = useCallback(
    (fileName: string, message: string) => {
      addHistory({
        id: newId(),
        fileName,
        convertedAt: new Date().toISOString(),
        rowCount: 0,
        dropped: 0,
        fileType,
        status: "failed",
        errorMsg: message,
      });
    },
    [fileType]
  );

  // ===== Derivasi data =====
  const kanalOptions = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.product_name).filter(Boolean))].sort() : []),
    [rows]
  );
  const statusOptions = useMemo(
    () => (rows ? [...new Set(rows.map((r) => r.sts_trx).filter(Boolean))].sort() : []),
    [rows]
  );
  const instansiOptions = useMemo(() => {
    if (!rows) return [];
    const m = new Map<string, string>();
    for (const r of rows) if (!m.has(r.corpid)) m.set(r.corpid, r.corpnm);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    // dateFrom/dateTo dibandingkan dengan 10 karakter awal tanggal mentah (YYYY-MM-DD)
    const from = dateFrom || "";
    const to = dateTo || "";
    return rows.filter((r) => {
      if (kanal && r.product_name !== kanal) return false;
      if (status && r.sts_trx !== status) return false;
      if (instansi && r.corpid !== instansi) return false;
      if (from && r.tanggal.slice(0, 10) < from) return false;
      if (to && r.tanggal.slice(0, 10) > to) return false;
      if (q) {
        const hay = `${r.corpid} ${r.corpnm} ${r.txid} ${r.src_number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, kanal, status, instansi, dateFrom, dateTo]);

  // reset ke halaman 1 setiap filter berubah
  useEffect(() => { setPage(1); }, [search, kanal, status, instansi, dateFrom, dateTo]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const nominal = filtered.reduce((s, r) => s + r.total, 0);
    const success = filtered.filter((r) => isSuccess(r.sts_trx)).length;
    const failed = filtered.filter((r) => isFailed(r.sts_trx)).length;
    return { total, nominal, success, failed };
  }, [filtered]);

  const byDay = useMemo(() => aggregateByDay(filtered), [filtered]);
  const byStatus = useMemo(() => aggregateByStatus(filtered), [filtered]);

  const dateRange = useMemo(() => {
    if (byDay.length === 0) return "";
    const fmt = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };
    return `${fmt(byDay[0].date)} - ${fmt(byDay[byDay.length - 1].date)}`;
  }, [byDay]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleNewConversion = () => {
    setRows(null);
    setMeta(null);
    setActiveId(null);
    localStorage.removeItem("active-dataset-meta");
  };

  // ===== Render =====
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="animate-spin">
          <circle cx="32" cy="32" r="26" stroke="#E5E7EB" strokeWidth="5" />
          <path d="M32 6A26 26 0 0 1 58 32" stroke="#2353B9" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!rows) {
    return (
      <UploadFlow
        fileType={fileType}
        onFileTypeChange={setFileType}
        onConverted={handleConverted}
        onConvertFailed={handleConvertFailed}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Data setelah dikonversi</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dateRange || meta?.fileName}
            {meta && meta.dropped > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {formatNumber(meta.dropped)} baris tidak valid dibuang
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleNewConversion}
            className="px-4 py-2.5 rounded-[10px] text-sm font-semibold text-brand-blue border border-brand-blue/30 bg-white hover:bg-blue-50 transition-colors"
          >
            + Konversi Baru
          </button>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold text-white bg-brand-orange hover:brightness-105 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v9M4.5 6.5L8 10l3.5-3.5M2 13h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download File
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
                <button
                  onClick={() => { exportXlsx(filtered, meta?.fileName ?? "data"); setExportOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => { exportCsv(filtered, meta?.fileName ?? "data"); setExportOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  CSV (.csv)
                </button>
                <p className="px-4 pt-1.5 pb-1 text-[11px] text-gray-400 border-t border-gray-100 mt-1">
                  {formatNumber(filtered.length)} baris (sesuai filter aktif)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
          <h2 className="font-semibold text-gray-900">Volume Transaksi per Hari</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Jumlah transaksi harian sepanjang periode</p>
          <BarChart data={byDay} />
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
          <h2 className="font-semibold text-gray-900">Distribusi Status Transaksi</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Berdasarkan kolom sts_trx</p>
          <DonutChart data={byStatus} />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard
          accent="#2353B9" iconBg="#e8effb"
          icon={<span className="text-brand-blue font-bold text-lg">▤</span>}
          label="Total Transaksi" value={formatNumber(kpi.total)} caption="Seluruh baris data"
        />
        <KpiCard
          accent="#F9A13F" iconBg="#fef3e5"
          icon={<span className="text-brand-orange font-bold text-base">Rp</span>}
          label="Total Nominal" value={formatRupiahCompact(kpi.nominal)} caption="Akumulasi kolom total"
        />
        <KpiCard
          accent="#00AA42" iconBg="#e6f6ec"
          icon={<span className="text-green-600 font-bold text-lg">✓</span>}
          label="Transaksi Berhasil" value={formatNumber(kpi.success)}
          caption={kpi.total ? `${((kpi.success / kpi.total) * 100).toFixed(1).replace(".", ",")}% dari total` : "—"}
        />
        <KpiCard
          accent="#E02D0D" iconBg="#fdeae7"
          icon={<span className="text-red-600 font-bold text-lg">✕</span>}
          label="Transaksi Gagal" value={formatNumber(kpi.failed)}
          caption={kpi.total ? `${((kpi.failed / kpi.total) * 100).toFixed(1).replace(".", ",")}% dari total` : "—"}
        />
      </div>

      {/* Filter row */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-64 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari corpid / nama instansi / txid..."
            className="w-full h-[50px] pl-11 pr-4 rounded-[10px] bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>
        <FilterSelect value={kanal} onChange={setKanal} placeholder="Semua Kanal" options={kanalOptions} />
        <FilterSelect value={status} onChange={setStatus} placeholder="Semua Status" options={statusOptions} />
        <FilterSelect
          value={instansi}
          onChange={setInstansi}
          placeholder="Semua Instansi"
          options={instansiOptions.map(([id]) => id)}
          labels={Object.fromEntries(instansiOptions)}
        />
        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Tanggal mulai"
          className={`h-[50px] px-3 rounded-[10px] bg-white text-sm outline-none focus:ring-2 focus:ring-brand-blue/30 cursor-pointer ${dateFrom ? "text-gray-800" : "text-gray-400"}`}
        />
        <span className="text-gray-400 text-sm">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Tanggal akhir"
          className={`h-[50px] px-3 rounded-[10px] bg-white text-sm outline-none focus:ring-2 focus:ring-brand-blue/30 cursor-pointer ${dateTo ? "text-gray-800" : "text-gray-400"}`}
        />
        {(search || kanal || status || instansi || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(""); setKanal(""); setStatus(""); setInstansi(""); setDateFrom(""); setDateTo(""); }}
            className="h-[50px] px-4 rounded-[10px] text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 transition-colors"
          >
            ✕ Reset
          </button>
        )}
      </div>

      {/* Table — 7 kolom utama; kolom tersembunyi (branchid, src_number, fee, txid, err_message) tampil di modal detail */}
      <div className="bg-white rounded-xl shadow-[0_4px_16px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">corpid</th>
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">corpnm</th>
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap text-right">amount</th>
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap text-right">total</th>
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">product_name</th>
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">sts_trx</th>
                <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">tanggal</th>
                <th className="px-4 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400">
                    Tidak ada data yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr
                    key={i}
                    className={`cursor-pointer group transition-colors ${i % 2 === 1 ? "bg-gray-50/60 hover:bg-blue-50/60" : "hover:bg-blue-50/40"}`}
                    onClick={() => setSelectedRow(r)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.corpid}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-52 truncate" title={r.corpnm}>{r.corpnm}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-right whitespace-nowrap">{formatRupiah(r.amount)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-right whitespace-nowrap">{formatRupiah(r.total)}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-44 truncate" title={r.product_name}>{r.product_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.sts_trx} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTanggal(r.tanggal)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[12px] font-semibold text-gray-400 group-hover:text-brand-blue transition-colors whitespace-nowrap">Detail</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-wrap gap-3">
          <p className="text-[13px] text-gray-500">
            Menampilkan {filtered.length === 0 ? 0 : formatNumber((page - 1) * PAGE_SIZE + 1)}–
            {formatNumber(Math.min(page * PAGE_SIZE, filtered.length))} dari {formatNumber(filtered.length)} data
          </p>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      <RowDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-[50px] px-4 pr-9 rounded-[10px] bg-white text-sm outline-none focus:ring-2 focus:ring-brand-blue/30 appearance-none cursor-pointer max-w-56 ${
        value ? "text-gray-800 font-medium" : "text-gray-400"
      }`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

// ===== Modal detail baris =====
function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-gray-800 break-all ${mono ? "font-mono" : ""}`}>{value || "–"}</span>
    </div>
  );
}

function RowDetailModal({ row, onClose }: { row: CleanRow | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!row) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [row, onClose]);

  if (!row || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-[fadeInScale_0.18s_ease] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">{row.corpnm || row.corpid}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatTanggal(row.tanggal)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors ml-4 shrink-0"
            aria-label="Tutup"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Status + nominal */}
        <div className="flex items-center gap-4 px-7 py-4 bg-gray-50 border-b border-gray-100">
          <StatusBadge status={row.sts_trx} />
          <div className="flex-1 min-w-0" />
          <div className="text-right">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-gray-900">{formatRupiah(row.total)}</p>
          </div>
        </div>

        {/* Isi detail — 2 kolom grid */}
        <div className="px-7 py-5 grid grid-cols-2 gap-x-8 gap-y-5">
          <DetailField label="corpid" value={row.corpid} mono />
          <DetailField label="branchid" value={row.branchid} mono />
          <DetailField label="corpnm" value={row.corpnm} />
          <DetailField label="src_number" value={row.src_number} mono />
          <DetailField label="product_name" value={row.product_name} />
          <DetailField label="Kanal / txid" value={row.txid} mono />
          <DetailField label="Amount" value={formatRupiah(row.amount)} />
          <DetailField label="Fee" value={formatRupiah(row.fee)} />
          <div className="col-span-2">
            <DetailField label="Pesan Error" value={row.err_message} />
          </div>
        </div>

        <div className="px-7 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Home() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DashboardInner />
      </Suspense>
    </AppShell>
  );
}
