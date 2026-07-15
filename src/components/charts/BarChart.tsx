"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatRupiahCompact } from "@/lib/format";
import type { CleanRow } from "@/lib/types";

type Granularity = "Harian" | "Mingguan" | "Bulanan";
type Metric = "count" | "nominal";

interface Props {
  rows: CleanRow[];
}

export default function BarChart({ rows }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("Harian");
  const [metric, setMetric] = useState<Metric>("count");
  const [hover, setHover] = useState<number | null>(null);

  const display = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const raw = r.tanggal.slice(0, 10); // YYYY-MM-DD
      if (!raw || raw.length < 10) continue;
      const key = bucketKey(raw, granularity);
      const val = metric === "nominal" ? r.total : 1;
      map.set(key, (map.get(key) ?? 0) + val);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ key, value, label: bucketLabel(key, granularity) }));
  }, [rows, granularity, metric]);

  const W = 800;
  const H = 240;
  const mL = 56;
  const mB = 26;
  const innerW = W - mL - 8;
  const innerH = H - mB - 6;

  const maxV = Math.max(...display.map((d) => d.value), 1);
  const step = niceStep(maxV / 3);
  const axisMax = Math.ceil(maxV / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= axisMax; v += step) ticks.push(v);

  const slot = display.length > 0 ? innerW / display.length : innerW;
  const bw = Math.min(40, slot * 0.62);
  const maxIdx = display.length > 0
    ? display.reduce((mi, d, i) => (d.value > display[mi].value ? i : mi), 0)
    : -1;
  const labelEvery = Math.max(1, Math.ceil(display.length / 8));

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Granularitas */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["Harian", "Mingguan", "Bulanan"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                granularity === g ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Metrik */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMetric("count")}
            className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
              metric === "count" ? "bg-white text-brand-blue shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Jumlah
          </button>
          <button
            onClick={() => setMetric("nominal")}
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
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Volume transaksi">
            {/* grid + label Y */}
            {ticks.map((v) => {
              const y = 6 + innerH - (v / axisMax) * innerH;
              return (
                <g key={v}>
                  <line x1={mL} x2={W - 8} y1={y} y2={y} stroke={v === 0 ? "#d1d5db" : "#f3f4f6"} strokeWidth={1} />
                  <text x={mL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                    {metric === "nominal" ? fmtAxisNominal(v) : v >= 1000 ? `${v / 1000}rb` : v}
                  </text>
                </g>
              );
            })}

            {/* bars */}
            {display.map((d, i) => {
              const bh = Math.max((d.value / axisMax) * innerH, 1);
              const x = mL + i * slot + (slot - bw) / 2;
              const y = 6 + innerH - bh;
              const active = hover === i;
              const emphasized = i === maxIdx;
              return (
                <g key={d.key}>
                  <rect
                    x={x}
                    y={y}
                    width={bw}
                    height={bh}
                    rx={4}
                    fill={active ? "#1a3f8f" : emphasized ? "#2353B9" : "#b6c8ec"}
                    style={{ transition: "fill 0.15s" }}
                  />
                  {/* hit target */}
                  <rect
                    x={mL + i * slot}
                    y={0}
                    width={slot}
                    height={H - mB}
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
                      fill="#9ca3af"
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hover !== null && (
            <div
              className="absolute pointer-events-none bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg z-10"
              style={{
                left: `${((mL + hover * slot + slot / 2) / W) * 100}%`,
                top: 0,
                transform: "translate(-50%, -10%)",
              }}
            >
              <p className="text-gray-400">{display[hover].key}</p>
              <p className="font-semibold text-[13px]">
                {metric === "nominal"
                  ? formatRupiahCompact(display[hover].value)
                  : `${formatNumber(display[hover].value)} transaksi`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function bucketKey(day: string, g: Granularity): string {
  if (g === "Harian") return day;
  if (g === "Bulanan") return day.slice(0, 7); // YYYY-MM
  // Mingguan: floor ke Senin — pakai local arithmetic, hindari UTC shift
  const [y, mo, dd] = day.split("-").map(Number);
  const d = new Date(y, mo - 1, dd); // local midnight, no UTC conversion
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dy}`;
}

function bucketLabel(key: string, g: Granularity): string {
  if (g === "Bulanan") {
    const m = key.match(/^(\d{4})-(\d{2})/);
    if (!m) return key;
    const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${bulan[parseInt(m[2]) - 1]} '${m[1].slice(2)}`;
  }
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return key;
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const label = `${parseInt(m[3])} ${bulan[parseInt(m[2]) - 1]}`;
  return g === "Mingguan" ? label + " –" : label;
}

function fmtAxisNominal(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000_000) return `${v / 1_000_000_000}M`;
  if (v >= 1_000_000) return `${v / 1_000_000}jt`;
  if (v >= 1_000) return `${v / 1_000}rb`;
  return String(v);
}

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const n = rough / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}
