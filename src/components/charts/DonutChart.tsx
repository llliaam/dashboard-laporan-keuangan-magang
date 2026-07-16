"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";

interface Segment {
  label: string;
  count: number;
}

// Warna status: hijau=sukses, merah=failed, oranye=reject, kuning=waspada, biru=lainnya.
function colorFor(label: string, idx: number): string {
  const s = label.toUpperCase();
  if (s === "RELEASED" || s === "SUCCESS" || s === "APPROVED") return "#00AA42";
  if (s === "FAILED" || s === "ERROR") return "#E02D0D";
  if (s === "REJECT" || s === "REJECTED") return "#F9A13F";
  // Zona % sukses dari successZones()
  if (s.startsWith("SEHAT")) return "#00AA42";
  if (s.startsWith("WASPADA")) return "#F9A13F";
  if (s.startsWith("KRITIS")) return "#E02D0D";
  const rest = ["#2353B9", "#7C3AED", "#0E9F8A"];
  return rest[idx % rest.length];
}

export default function DonutChart({ data }: { data: Segment[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-gray-400">Tidak ada data status</div>;
  }

  const R = 80;
  const STROKE = 26;
  const C = 100;
  const r = R - STROKE / 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 2.5;

  const fractions = data.map((d) => d.count / total);
  const segs = data.map((d, i) => ({
    ...d,
    frac: fractions[i],
    offset: fractions.slice(0, i).reduce((a, b) => a + b, 0),
    color: colorFor(d.label, i),
  }));

  const active = hover !== null ? segs[hover] : segs[0];

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label="Distribusi status transaksi">
          <g transform={`rotate(-90 ${C} ${C})`}>
            {segs.map((s, i) => {
              const len = Math.max(s.frac * circumference - gapPx, 1);
              return (
                <circle
                  key={s.label}
                  cx={C}
                  cy={C}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? STROKE + 4 : STROKE}
                  strokeDasharray={`${len} ${circumference - len}`}
                  strokeDashoffset={-s.offset * circumference - gapPx / 2}
                  strokeLinecap="butt"
                  style={{ transition: "stroke-width 0.15s", cursor: "pointer" }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </g>
        </svg>
        {/* center label — mengikuti segmen yang di-hover */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[26px] font-bold text-gray-900">
            {((active.count / total) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
          </span>
          <span className="text-[11px] text-gray-500 max-w-[100px] truncate">{active.label}</span>
        </div>
      </div>

      {/* legend chips 2 kolom */}
      <div className="grid grid-cols-2 gap-2 w-full">
        {segs.map((s, i) => (
          <button
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
              hover === i ? "bg-gray-100" : "bg-gray-50"
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] font-medium text-gray-700 truncate flex-1">{s.label}</span>
            <span className="text-[11px] font-semibold text-gray-900" title={formatNumber(s.count)}>
              {(s.frac * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
