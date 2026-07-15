"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import KpiCard from "@/components/KpiCard";
import Pagination from "@/components/Pagination";
import { PctBadge } from "@/components/Badges";
import type { CleanRow, InstansiAggregate } from "@/lib/types";
import { aggregateByInstansi } from "@/lib/aggregate";
import { formatNumber, formatRupiahCompact } from "@/lib/format";
import { getActiveId } from "@/lib/history";
import { loadDataset } from "@/lib/db";

const PAGE_SIZE = 10;
const ATTENTION_THRESHOLD = 70;

type SortKey = "totalNominal" | "count" | "pctSuccess" | "corpnm";

export default function AnalitikPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CleanRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalNominal");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = getActiveId();
    if (!id) {
      setLoading(false);
      return;
    }
    loadDataset(id)
      .then((data) => setRows(data && data.length ? data : null))
      .finally(() => setLoading(false));
  }, []);

  const aggregates = useMemo(() => (rows ? aggregateByInstansi(rows) : []), [rows]);

  const kpi = useMemo(() => {
    const totalInstansi = aggregates.length;
    const totalTrx = aggregates.reduce((s, a) => s + a.count, 0);
    // rata-rata tertimbang: total sukses / total transaksi
    const totalSuccess = aggregates.reduce((s, a) => s + a.success, 0);
    const avgPct = totalTrx ? (totalSuccess / totalTrx) * 100 : 0;
    const attention = aggregates.filter((a) => a.pctSuccess < ATTENTION_THRESHOLD).length;
    return { totalInstansi, totalTrx, avgPct, attention };
  }, [aggregates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = aggregates;
    if (q) {
      out = out.filter(
        (a) => a.corpid.toLowerCase().includes(q) || a.corpnm.toLowerCase().includes(q)
      );
    }
    const sorted = [...out];
    switch (sortKey) {
      case "totalNominal": sorted.sort((a, b) => b.totalNominal - a.totalNominal); break;
      case "count": sorted.sort((a, b) => b.count - a.count); break;
      case "pctSuccess": sorted.sort((a, b) => a.pctSuccess - b.pctSuccess); break; // terburuk dulu
      case "corpnm": sorted.sort((a, b) => a.corpnm.localeCompare(b.corpnm)); break;
    }
    return sorted;
  }, [aggregates, search, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const drillDown = (a: InstansiAggregate) => {
    router.push(`/analitik/detail?corpid=${encodeURIComponent(a.corpid)}`);
  };

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

  if (!rows) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Analitik &amp; Insight per Instansi</h1>
            <p className="text-sm text-gray-500 mt-1">Agregasi transaksi dikelompokkan berdasarkan corpid</p>
          </div>
          <div className="bg-white rounded-2xl py-20 flex flex-col items-center gap-4 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
                <path d="M3 15V8M9 15V3M15 15v-5" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">Belum ada data untuk dianalisis</p>
              <p className="text-sm text-gray-400 mt-1">Konversi file terlebih dahulu di halaman Dashboard, atau buka ulang dari Riwayat.</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-1 px-6 py-2.5 rounded-[10px] text-sm font-semibold text-white bg-brand-blue hover:brightness-110 transition-all"
            >
              Ke Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analitik &amp; Insight per Instansi</h1>
          <p className="text-sm text-gray-500 mt-1">Agregasi transaksi dikelompokkan berdasarkan corpid</p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard
            accent="#2353B9" iconBg="#e8effb"
            icon={<span className="text-brand-blue font-bold text-lg">▤</span>}
            label="Total Instansi" value={formatNumber(kpi.totalInstansi)} caption="Jumlah corpid unik"
          />
          <KpiCard
            accent="#F9A13F" iconBg="#fef3e5"
            icon={<span className="text-brand-orange font-bold text-lg">⇄</span>}
            label="Total Transaksi" value={formatNumber(kpi.totalTrx)} caption="Seluruh instansi"
          />
          <KpiCard
            accent="#00AA42" iconBg="#e6f6ec"
            icon={<span className="text-green-600 font-bold text-lg">✓</span>}
            label="Rata-rata Sukses"
            value={kpi.avgPct.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%"}
            caption="Rata-rata seluruh instansi"
          />
          <KpiCard
            accent="#E02D0D" iconBg="#fdeae7"
            icon={<span className="text-red-600 font-bold text-lg">◆</span>}
            label="Instansi Perlu Atensi" value={formatNumber(kpi.attention)}
            caption={`Sukses < ${ATTENTION_THRESHOLD}%`}
          />
        </div>

        {/* Search + sort */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="#9ca3af" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari corpid / nama instansi..."
              className="w-full h-[50px] pl-11 pr-4 rounded-[10px] bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-[50px] px-4 rounded-[10px] bg-white text-sm text-gray-700 font-medium outline-none cursor-pointer"
          >
            <option value="totalNominal">Urutkan: Total Nominal</option>
            <option value="count">Urutkan: Jumlah Transaksi</option>
            <option value="pctSuccess">Urutkan: % Sukses Terendah</option>
            <option value="corpnm">Urutkan: Nama Instansi</option>
          </select>
        </div>

        {/* Tabel agregasi */}
        <div className="bg-white rounded-xl shadow-[0_4px_16px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3.5 font-semibold text-xs text-gray-500">corpid</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500">Nama Instansi</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right">Jml Transaksi</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right">Total Nominal</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right">Berhasil</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-right">Gagal</th>
                  <th className="px-4 py-3.5 font-semibold text-xs text-gray-500 text-center">% Sukses</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm text-gray-400">
                      Tidak ada instansi yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((a, i) => (
                    <tr key={a.corpid} className={i % 2 === 1 ? "bg-gray-50/60" : ""}>
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{a.corpid}</td>
                      <td className="px-4 py-4 font-medium text-gray-700 max-w-72 truncate" title={a.corpnm}>{a.corpnm}</td>
                      <td className="px-4 py-4 text-gray-700 text-right">{formatNumber(a.count)}</td>
                      <td className="px-4 py-4 font-semibold text-gray-900 text-right whitespace-nowrap">
                        {formatRupiahCompact(a.totalNominal)}
                      </td>
                      <td className="px-4 py-4 text-green-600 text-right">{formatNumber(a.success)}</td>
                      <td className="px-4 py-4 text-red-600 text-right">{formatNumber(a.failed)}</td>
                      <td className="px-4 py-4 text-center"><PctBadge pct={a.pctSuccess} /></td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => drillDown(a)}
                          className="text-[13px] font-semibold text-brand-blue hover:underline whitespace-nowrap"
                          title={`Lihat detail transaksi ${a.corpnm}`}
                        >
                          Lihat ›
                        </button>
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
              {formatNumber(Math.min(page * PAGE_SIZE, filtered.length))} dari {formatNumber(filtered.length)} instansi
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
