"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumber, formatRupiahCompact } from "@/lib/format";
import type { CleanRow } from "@/lib/types";

type Granularity = "Harian" | "Mingguan" | "Bulanan";
type Metric = "count" | "nominal";

interface Props {
  rows: CleanRow[];
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Handle semua format tanggal yang mungkin datang dari Excel/parser:
// YYYY-MM-DD, DD/MM/YYYY, M/D/YY (Excel US locale, e.g. "1/1/25 6:05")
function parseTanggal(raw: string): { y: number; m: number; d: number } | null {
  if (!raw) return null;
  // YYYY-MM-DD or YYYY/MM/DD (year first, 4 digits)
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  // DD/MM/YYYY or DD-MM-YYYY (4-digit year)
  const dmy4 = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy4) {
    const d = Number(dmy4[1]), m = Number(dmy4[2]), y = Number(dmy4[3]);
    if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  // M/D/YY — Excel US locale, 2-digit year (e.g. "1/1/25 6:05")
  const mdy2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:[^0-9]|$)/);
  if (mdy2) {
    const m = Number(mdy2[1]), d = Number(mdy2[2]), y = 2000 + Number(mdy2[3]);
    if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDay(p: { y: number; m: number; d: number }): string {
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

function mondayOfWeek(p: { y: number; m: number; d: number }): string {
  const dt = new Date(p.y, p.m - 1, p.d); // local midnight — no UTC shift
  if (isNaN(dt.getTime())) return toIsoDay(p);
  const dow = dt.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + diff);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function bucketKey(p: { y: number; m: number; d: number }, g: Granularity): string {
  if (g === "Bulanan") return `${p.y}-${pad2(p.m)}`;
  if (g === "Harian") return toIsoDay(p);
  return mondayOfWeek(p); // Mingguan: Senin pertama minggu tsb
}

// Short label for X-axis ticks
function bucketLabel(key: string, g: Granularity): string {
  if (g === "Bulanan") {
    const m = key.match(/^(\d{4})-(\d{2})$/);
    if (!m) return key;
    return `${BULAN[parseInt(m[2]) - 1]} '${m[1].slice(2)}`;
  }
  // Harian & Mingguan: YYYY-MM-DD
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return key;
  return `${parseInt(m[3])} ${BULAN[parseInt(m[2]) - 1]}`;
}

// Detailed label for tooltip
function bucketTooltip(key: string, g: Granularity): string {
  if (g === "Bulanan") {
    const m = key.match(/^(\d{4})-(\d{2})$/);
    if (!m) return key;
    return `${BULAN[parseInt(m[2]) - 1]} ${m[1]}`;
  }
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return key;
  const d = parseInt(m[3]), mon = BULAN[parseInt(m[2]) - 1], yr = m[1];
  if (g === "Mingguan") return `Minggu ${d} ${mon} ${yr}`;
  return `${d} ${mon} ${yr}`;
}

function fmtAxisNominal(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000_000) return `${+(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${+(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

function fmtAxisCount(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${+(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}

export default function BarChart({ rows }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("Harian");
  const [metric, setMetric] = useState<Metric>("count");
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(736);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const display = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const parsed = parseTanggal(r.tanggal);
      if (!parsed) continue;
      const key = bucketKey(parsed, granularity);
      const val = metric === "nominal" ? (Number(r.total) || 0) : 1;
      map.set(key, (map.get(key) ?? 0) + val);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        value,
        label: bucketLabel(key, granularity),
        tooltip: bucketTooltip(key, granularity),
      }));
  }, [rows, granularity, metric]);

  const H = 240;
  const mL = 56;
  const mB = 26;
  const MIN_SLOT = 14; // px minimum per slot agar bar tidak invisible
  const innerH = H - mB - 6;

  // W = lebar container aktual (stretch) atau lebih lebar jika bucket banyak (scroll)
  const W = Math.max(containerW, mL + 8 + display.length * MIN_SLOT);
  const innerW = W - mL - 8;

  const maxV = display.reduce((m, d) => (d.value > m ? d.value : m), 1);
  const step = niceStep(maxV / 4);
  const axisMax = Math.ceil(maxV / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= axisMax; v += step) ticks.push(v);

  const slot = display.length > 0 ? innerW / display.length : innerW;
  const bw = Math.max(2, slot * 0.62);
  const maxIdx = display.length > 0
    ? display.reduce((mi, d, i) => (d.value > display[mi].value ? i : mi), 0)
    : -1;
  const labelEvery = Math.max(1, Math.ceil(display.length / 8));

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["Harian", "Mingguan", "Bulanan"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => { setGranularity(g); setHover(null); }}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                granularity === g ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setMetric("count"); setHover(null); }}
            className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
              metric === "count" ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Jumlah
          </button>
          <button
            onClick={() => { setMetric("nominal"); setHover(null); }}
            className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
              metric === "nominal" ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Nominal
          </button>
        </div>
      </div>

      {/* Chart */}
      {display.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400">
          Tidak ada data pada rentang waktu ini
        </div>
      ) : (
        <div className="overflow-x-auto min-w-0" ref={containerRef}>
          <svg
            width={W}
            height={H}
            style={{ display: "block" }}
            role="img"
            aria-label="Volume transaksi"
          >
            {/* Grid + Y-axis labels */}
            {ticks.map((v) => {
              const y = 6 + innerH - (v / axisMax) * innerH;
              return (
                <g key={v}>
                  <line
                    x1={mL} x2={W - 8} y1={y} y2={y}
                    stroke={v === 0 ? "#d1d5db" : "#f3f4f6"}
                    strokeWidth={1}
                  />
                  <text x={mL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                    {metric === "nominal" ? fmtAxisNominal(v) : fmtAxisCount(v)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {display.map((d, i) => {
              const bh = Math.max((d.value / axisMax) * innerH, 1);
              const x = mL + i * slot + (slot - bw) / 2;
              const y = 6 + innerH - bh;
              const active = hover === i;
              const emphasized = i === maxIdx;
              return (
                <g key={d.key}>
                  <rect
                    x={x} y={y} width={bw} height={bh} rx={4}
                    fill={active ? "#1a3f8f" : emphasized ? "#2353B9" : "#b6c8ec"}
                    style={{ transition: "fill 0.15s" }}
                  />
                  {/* Invisible hit area per bar slot */}
                  <rect
                    x={mL + i * slot} y={0} width={slot} height={H - mB}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                  {i % labelEvery === 0 && (
                    <text
                      x={mL + i * slot + slot / 2}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill={active ? "#2353B9" : "#9ca3af"}
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Tooltip — SVG native agar ikut scroll container */}
            {hover !== null && display[hover] && (() => {
              const tx = mL + hover * slot + slot / 2;
              const ty = 8;
              const label1 = display[hover].tooltip;
              const label2 = metric === "nominal"
                ? formatRupiahCompact(display[hover].value)
                : `${formatNumber(display[hover].value)} transaksi`;
              const boxW = Math.max(label1.length, label2.length) * 7 + 24;
              const boxH = 44;
              const clampedX = Math.min(W - boxW / 2 - 8, Math.max(boxW / 2 + 8, tx));
              return (
                <g transform={`translate(${clampedX},${ty})`} style={{ pointerEvents: "none" }}>
                  <rect x={-boxW / 2} y={0} width={boxW} height={boxH} rx={8} fill="#111827" />
                  <text x={0} y={16} textAnchor="middle" fontSize={10} fill="#9ca3af">{label1}</text>
                  <text x={0} y={32} textAnchor="middle" fontSize={12} fontWeight="600" fill="white">{label2}</text>
                </g>
              );
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}
