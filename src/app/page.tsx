"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import UploadFlow from "@/components/UploadFlow";
import KpiCard from "@/components/KpiCard";
import Pagination from "@/components/Pagination";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import { StatusBadge } from "@/components/Badges";
import type { CleanRow, ParseResult } from "@/lib/types";
import { aggregateByStatus, isFailed, isSuccess } from "@/lib/aggregate";
import { formatNumber, formatRupiah, formatRupiahCompact, formatTanggal, tanggalToIso } from "@/lib/format";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CleanRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<CleanRow | null>(null);

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
      const isoDate = tanggalToIso(r.tanggal);
      if (from && isoDate && isoDate < from) return false;
      if (to && isoDate && isoDate > to) return false;
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

  const byStatus = useMemo(() => aggregateByStatus(filtered), [filtered]);

  const dateRange = useMemo(() => {
    const dates = filtered.map((r) => r.tanggal.slice(0, 10)).filter(Boolean).sort();
    if (dates.length === 0) return "";
    const fmt = (iso: string) => {
      const d = new Date(iso + "T00:00:00");
      return isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };
    return `${fmt(dates[0])} - ${fmt(dates[dates.length - 1])}`;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleNewConversion = () => {
    setRows(null);
    setMeta(null);
    setActiveId(null);
    localStorage.removeItem("active-dataset-meta");
  };

  const handleCreateRow = useCallback((newRow: CleanRow) => {
    setRows((prev) => {
      const next = [newRow, ...(prev ?? [])];
      const id = getActiveId();
      if (id) saveDataset(id, next).catch(() => {});
      return next;
    });
  }, []);

  const handleUpdateRow = useCallback((original: CleanRow, updated: CleanRow) => {
    setRows((prev) => {
      if (!prev) return prev;
      const next = prev.map((r) => (r === original ? updated : r));
      const id = getActiveId();
      if (id) saveDataset(id, next).catch(() => {});
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback((target: CleanRow) => {
    setRows((prev) => {
      if (!prev) return prev;
      const next = prev.filter((r) => r !== target);
      const id = getActiveId();
      if (id) saveDataset(id, next).catch(() => {});
      return next;
    });
    setSelectedRow(null);
    setDeleteRow(null);
  }, []);

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
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2.5 rounded-[10px] text-sm font-semibold text-white bg-brand-blue hover:brightness-105 transition-all active:scale-95"
          >
            + Tambah Data
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
          <h2 className="font-semibold text-gray-900">Volume Transaksi</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Pilih berdasarkan rentang tanggal, jumlah transaksi dan nominal transaksi</p>
          <BarChart rows={filtered} />
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

      <RowDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onEdit={(r) => { setSelectedRow(null); setEditRow(r); }}
        onDelete={(r) => { setDeleteRow(r); }}
      />

      {/* Edit modal */}
      <RowFormModal
        initial={editRow}
        onClose={() => setEditRow(null)}
        onSubmit={(updated) => { handleUpdateRow(editRow!, updated); setEditRow(null); }}
      />

      {/* Create modal */}
      <RowFormModal
        initial={null}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(newRow) => { handleCreateRow(newRow); setCreateOpen(false); }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteRow}
        title="Hapus data ini?"
        message={`Baris "${deleteRow?.corpnm || deleteRow?.corpid}" akan dihapus secara permanen dari dataset.`}
        confirmLabel="Hapus"
        onConfirm={() => deleteRow && handleDeleteRow(deleteRow)}
        onCancel={() => setDeleteRow(null)}
      />
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Fokus search saat buka
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
    else setQ("");
  }, [open]);

  const filtered = q.trim()
    ? options.filter((o) => (labels?.[o] ?? o).toLowerCase().includes(q.toLowerCase()))
    : options;

  const displayLabel = value ? (labels?.[value] ?? value) : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 h-[50px] pl-4 pr-3 rounded-[10px] bg-white text-sm outline-none focus:ring-2 focus:ring-brand-blue/30 cursor-pointer max-w-56 min-w-36 ${
          value ? "text-gray-800 font-medium" : "text-gray-400"
        }`}
      >
        <span className="flex-1 text-left truncate">{displayLabel}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 flex flex-col">
          {/* Search bar */}
          <div className="px-3 pb-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="5.5" cy="5.5" r="4" stroke="#9ca3af" strokeWidth="1.4" />
                <path d="M9 9L12 12" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-gray-50 text-[13px] text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>

          {/* Option list */}
          <div className="overflow-y-auto max-h-52">
            {/* Opsi reset */}
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setQ(""); }}
              className={`w-full text-left px-4 py-2 text-[13px] transition-colors ${
                !value ? "text-brand-blue font-semibold bg-blue-50" : "text-gray-400 hover:bg-gray-50"
              }`}
            >
              {placeholder}
            </button>

            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-gray-400 text-center">Tidak ada hasil</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => { onChange(o); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-4 py-2 text-[13px] truncate transition-colors ${
                    o === value
                      ? "text-brand-blue font-semibold bg-blue-50"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  title={labels?.[o] ?? o}
                >
                  {labels?.[o] ?? o}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
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

function RowDetailModal({
  row,
  onClose,
  onEdit,
  onDelete,
}: {
  row: CleanRow | null;
  onClose: () => void;
  onEdit: (r: CleanRow) => void;
  onDelete: (r: CleanRow) => void;
}) {
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

        {/* Footer — Edit / Delete / Tutup */}
        <div className="px-7 pb-6 flex gap-3">
          <button
            onClick={() => onDelete(row)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 3.5h11M5.5 3.5v-2h3v2M3 3.5l.75 8.5h6.5L11 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Hapus
          </button>
          <button
            onClick={() => onEdit(row)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2L12 4.5 5 11.5H2.5V9L9.5 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ===== Form modal untuk Create dan Edit =====
const EMPTY_ROW: CleanRow = {
  corpid: "", corpnm: "", branchid: "", src_number: "",
  amount: 0, fee: 0, total: 0,
  product_name: "", sts_trx: "", txid: "", err_message: "",
  tanggal: "",
};

function RowFormModal({
  initial,
  open,
  onClose,
  onSubmit,
}: {
  initial: CleanRow | null;
  open?: boolean;
  onClose: () => void;
  onSubmit: (row: CleanRow) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isOpen = initial !== null || !!open;
  const isEdit = initial !== null;

  const [form, setForm] = useState<CleanRow>(EMPTY_ROW);

  // sync form to initial whenever modal opens
  useEffect(() => {
    if (isOpen) setForm(initial ?? EMPTY_ROW);
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const set = (k: keyof CleanRow, v: string) =>
    setForm((f) => ({ ...f, [k]: ["amount", "fee", "total"].includes(k) ? Number(v) || 0 : v }));

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.corpid.trim()) return;
    onSubmit(form);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-[fadeInScale_0.18s_ease] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100">
          <p className="font-bold text-gray-900 text-base">{isEdit ? "Edit Data" : "Tambah Data Baru"}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" aria-label="Tutup">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-7 py-5 grid grid-cols-2 gap-x-5 gap-y-4 max-h-[60vh] overflow-y-auto">
            {(
              [
                { key: "corpid", label: "corpid *", mono: true },
                { key: "branchid", label: "branchid", mono: true },
                { key: "corpnm", label: "corpnm", span: 2 },
                { key: "src_number", label: "src_number", mono: true },
                { key: "product_name", label: "product_name" },
                { key: "sts_trx", label: "sts_trx" },
                { key: "tanggal", label: "tanggal (YYYY-MM-DD HH:MM:SS)", span: 2 },
                { key: "amount", label: "amount (angka)", num: true },
                { key: "fee", label: "fee (angka)", num: true },
                { key: "total", label: "total (angka)", num: true },
                { key: "txid", label: "txid", mono: true },
                { key: "err_message", label: "err_message", span: 2 },
              ] as { key: keyof CleanRow; label: string; mono?: boolean; num?: boolean; span?: number }[]
            ).map(({ key, label, mono, num, span }) => (
              <div key={key} className={span === 2 ? "col-span-2" : ""}>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
                <input
                  type={num ? "number" : "text"}
                  value={num ? (form[key] as number) : (form[key] as string)}
                  onChange={(e) => set(key, e.target.value)}
                  className={`w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50 ${mono ? "font-mono" : ""}`}
                  required={key === "corpid"}
                />
              </div>
            ))}
          </div>

          <div className="px-7 pb-6 pt-3 flex gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-blue hover:brightness-105 transition-all active:scale-95"
            >
              {isEdit ? "Simpan Perubahan" : "Tambah Data"}
            </button>
          </div>
        </form>
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
