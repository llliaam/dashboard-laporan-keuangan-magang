"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import Pagination from "@/components/Pagination";
import { PctBadge, StatusBadge } from "@/components/Badges";
import type { CleanRow } from "@/lib/types";
import { isFailed, isSuccess } from "@/lib/aggregate";
import { formatNumber, formatRupiah, formatRupiahCompact, formatTanggal } from "@/lib/format";
import { getActiveId } from "@/lib/history";
import { loadDataset } from "@/lib/db";

const PAGE_SIZE = 15;

function DetailDialog({ row, onClose }: { row: CleanRow; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fields: { label: string; value: string }[] = [
    { label: "Corp ID", value: row.corpid },
    { label: "Nama Instansi", value: row.corpnm },
    { label: "Branch ID", value: row.branchid || "—" },
    { label: "No. Rekening Asal", value: row.src_number || "—" },
    { label: "Amount", value: formatRupiah(row.amount) },
    { label: "Fee", value: formatRupiah(row.fee) },
    { label: "Total", value: formatRupiah(row.total) },
    { label: "Kanal / Produk", value: row.product_name || "—" },
    { label: "Status", value: row.sts_trx || "—" },
    { label: "TX ID", value: row.txid || "—" },
    { label: "Pesan Error", value: row.err_message || "—" },
    { label: "Tanggal", value: formatTanggal(row.tanggal) },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Detail Transaksi</h2>
            <p className="text-xs text-gray-400 mt-0.5">{row.corpnm}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex gap-4 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400 w-40 shrink-0 pt-0.5">{label}</span>
              <span className="text-sm font-medium break-all text-gray-800">
                {label === "Status" ? <StatusBadge status={value} /> : value}
              </span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-[10px] text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AnalitikDetailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const corpidParam = searchParams.get("corpid") ?? "";

  const [allRows, setAllRows] = useState<CleanRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKanal, setFilterKanal] = useState("");
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<CleanRow | null>(null);

  useEffect(() => {
    const id = getActiveId();
    if (!id) { setLoading(false); return; }
    loadDataset(id)
      .then((data) => setAllRows(data && data.length ? data : null))
      .finally(() => setLoading(false));
  }, []);

  const instansiRows = useMemo(
    () => (allRows ? allRows.filter((r) => r.corpid === corpidParam) : []),
    [allRows, corpidParam]
  );

  const corpnm = instansiRows[0]?.corpnm ?? corpidParam;

  const statusOptions = useMemo(
    () => [...new Set(instansiRows.map((r) => r.sts_trx).filter(Boolean))].sort(),
    [instansiRows]
  );
  const kanalOptions = useMemo(
    () => [...new Set(instansiRows.map((r) => r.product_name).filter(Boolean))].sort(),
    [instansiRows]
  );

  const kpi = useMemo(() => {
    const count = instansiRows.length;
    const success = instansiRows.filter((r) => isSuccess(r.sts_trx)).length;
    const failed = instansiRows.filter((r) => isFailed(r.sts_trx)).length;
    const totalNominal = instansiRows.reduce((s, r) => s + r.total, 0);
    const pct = count ? (success / count) * 100 : 0;
    return { count, success, failed, totalNominal, pct };
  }, [instansiRows]);

  const kanalDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of instansiRows) {
      const k = r.product_name || "(kosong)";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ kanal: k, count: v }));
  }, [instansiRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instansiRows.filter((r) => {
      if (filterStatus && r.sts_trx !== filterStatus) return false;
      if (filterKanal && r.product_name !== filterKanal) return false;
      if (q) {
        return (
          r.src_number.toLowerCase().includes(q) ||
          r.txid.toLowerCase().includes(q) ||
          r.product_name.toLowerCase().includes(q) ||
          r.sts_trx.toLowerCase().includes(q) ||
          r.tanggal.includes(q)
        );
      }
      return true;
    });
  }, [instansiRows, search, filterStatus, filterKanal]);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterKanal]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const backBtn = (
    <button
      onClick={() => router.push("/analitik")}
      className="mt-1 flex items-center justify-center w-9 h-9 rounded-[10px] bg-white border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-colors shrink-0 shadow-sm"
      title="Kembali ke Analitik"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-40">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="animate-spin">
            <circle cx="32" cy="32" r="26" stroke="#E5E7EB" strokeWidth="5" />
            <path d="M32 6A26 26 0 0 1 58 32" stroke="#2353B9" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
      </AppShell>
    );
  }

  if (!allRows || instansiRows.length === 0) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {backBtn}
            <span className="text-sm text-gray-500">Kembali ke Analitik</span>
          </div>
          <div className="bg-white rounded-2xl py-20 flex flex-col items-center gap-4 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
            <p className="font-semibold text-gray-700">
              {!allRows ? "Belum ada data untuk dianalisis" : `Corp ID "${corpidParam}" tidak ditemukan`}
            </p>
            <p className="text-sm text-gray-400">
              {!allRows ? "Konversi file terlebih dahulu di halaman Dashboard." : "Data mungkin sudah berubah atau corp ID tidak valid."}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header + back */}
        <div className="flex items-start gap-4">
          {backBtn}
          <div>
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">{corpnm}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Corp ID: {corpidParam} · Detail transaksi per instansi</p>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard
            accent="#2353B9" iconBg="#e8effb"
            icon={<span className="text-brand-blue font-bold text-lg">⇄</span>}
            label="Total Transaksi" value={formatNumber(kpi.count)} caption="Seluruh periode"
          />
          <KpiCard
            accent="#00AA42" iconBg="#e6f6ec"
            icon={<span className="text-green-600 font-bold text-lg">✓</span>}
            label="Berhasil" value={formatNumber(kpi.success)} caption="Status sukses"
          />
          <KpiCard
            accent="#E02D0D" iconBg="#fdeae7"
            icon={<span className="text-red-600 font-bold text-lg">✕</span>}
            label="Gagal" value={formatNumber(kpi.failed)} caption="FAILED/REJECT/dll."
          />
          <KpiCard
            accent="#F9A13F" iconBg="#fef3e5"
            icon={<span className="text-brand-orange font-bold text-lg">Rp</span>}
            label="Total Nominal" value={formatRupiahCompact(kpi.totalNominal)} caption="Sum(total)"
          />
        </div>

        {/* % Sukses + distribusi kanal */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(16,24,40,0.06)] p-6 flex flex-col gap-3">
            <p className="text-sm font-medium text-gray-500">Persentase Sukses</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-gray-900">
                {kpi.pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
              </span>
              <PctBadge pct={kpi.pct} />
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  kpi.pct >= 90 ? "bg-green-500" : kpi.pct >= 70 ? "bg-amber-400" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, kpi.pct)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {formatNumber(kpi.success)} berhasil dari {formatNumber(kpi.count)} total transaksi
            </p>
          </div>

          <div className="xl:col-span-2 bg-white rounded-2xl shadow-[0_4px_16px_rgba(16,24,40,0.06)] p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Distribusi Kanal Transaksi</p>
            <div className="space-y-2.5">
              {kanalDist.slice(0, 6).map(({ kanal, count }) => (
                <div key={kanal} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-48 shrink-0 truncate" title={kanal}>{kanal}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2353B9]/70"
                      style={{ width: `${(count / kpi.count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-10 text-right">{formatNumber(count)}</span>
                </div>
              ))}
              {kanalDist.length === 0 && (
                <p className="text-sm text-gray-400">Tidak ada data kanal.</p>
              )}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-52 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. rekening, TX ID, kanal..."
              className="w-full h-[46px] pl-11 pr-4 rounded-[10px] bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-[46px] px-4 rounded-[10px] bg-white text-sm text-gray-700 font-medium outline-none cursor-pointer"
          >
            <option value="">Semua Status</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterKanal}
            onChange={(e) => setFilterKanal(e.target.value)}
            className="h-[46px] px-4 rounded-[10px] bg-white text-sm text-gray-700 font-medium outline-none cursor-pointer"
          >
            <option value="">Semua Kanal</option>
            {kanalOptions.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Tabel */}
        <div className="bg-white rounded-xl shadow-[0_4px_16px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">No.</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">No. Rekening</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 whitespace-nowrap">Kanal</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right whitespace-nowrap">Fee</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-sm text-gray-400">
                      Tidak ada transaksi yang cocok dengan filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, i) => {
                    const globalIdx = (page - 1) * PAGE_SIZE + i;
                    return (
                      <tr key={globalIdx} className={i % 2 === 1 ? "bg-gray-50/60" : ""}>
                        <td className="px-5 py-3.5 text-gray-400 text-right text-xs">{formatNumber(globalIdx + 1)}</td>
                        <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{formatTanggal(r.tanggal)}</td>
                        <td className="px-4 py-3.5 font-medium text-gray-800 whitespace-nowrap">{r.src_number || "—"}</td>
                        <td className="px-4 py-3.5 text-gray-600 max-w-[200px] truncate" title={r.product_name}>{r.product_name || "—"}</td>
                        <td className="px-4 py-3.5 text-gray-700 text-right whitespace-nowrap">{formatRupiah(r.amount)}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-right whitespace-nowrap">{formatRupiah(r.fee)}</td>
                        <td className="px-4 py-3.5 font-semibold text-gray-900 text-right whitespace-nowrap">{formatRupiah(r.total)}</td>
                        <td className="px-4 py-3.5 text-center"><StatusBadge status={r.sts_trx} /></td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setDetailRow(r)}
                            className="text-[12px] font-semibold text-brand-blue whitespace-nowrap px-3 py-1.5 rounded-[8px] hover:bg-blue-50 transition-colors"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 flex-wrap gap-3">
            <p className="text-[13px] text-gray-500">
              {filtered.length === 0
                ? "Tidak ada data"
                : `Menampilkan ${formatNumber((page - 1) * PAGE_SIZE + 1)}–${formatNumber(Math.min(page * PAGE_SIZE, filtered.length))} dari ${formatNumber(filtered.length)} transaksi`}
              {filtered.length !== instansiRows.length && (
                <span className="text-gray-400"> (total {formatNumber(instansiRows.length)})</span>
              )}
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>

      {detailRow && <DetailDialog row={detailRow} onClose={() => setDetailRow(null)} />}
    </AppShell>
  );
}

export default function AnalitikDetailPage() {
  return (
    <Suspense>
      <AnalitikDetailInner />
    </Suspense>
  );
}
