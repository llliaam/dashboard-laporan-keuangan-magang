"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";

interface Datum {
  date: string; // YYYY-MM-DD
  count: number;
}

// Bar chart volume per hari — SVG murni, hover tooltip per bar.
// Jika hari > 40, agregasi otomatis per minggu agar bar tetap terbaca.
export default function BarChart({ data }: { data: Datum[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const display = useMemo(() => {
    if (data.length <= 40) return data.map((d) => ({ ...d, label: shortDate(d.date) }));
    // agregasi per minggu (ISO-ish: potong per 7 hari dari awal)
    const weeks: { date: string; count: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += 7) {
      const chunk = data.slice(i, i + 7);
      weeks.push({
        date: chunk[0].date,
        count: chunk.reduce((s, d) => s + d.count, 0),
        label: shortDate(chunk[0].date) + " –",
      });
    }
    return weeks;
  }, [data]);

  if (display.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-gray-400">Tidak ada data tanggal valid</div>;
  }

  const W = 800;
  const H = 240;
  const mL = 44;
  const mB = 26;
  const innerW = W - mL - 8;
  const innerH = H - mB - 6;
  const maxV = Math.max(...display.map((d) => d.count), 1);
  // pembulatan sumbu ke atas yang enak dibaca
  const step = niceStep(maxV / 3);
  const axisMax = Math.ceil(maxV / step) * step;
  const ticks = [];
  for (let v = 0; v <= axisMax; v += step) ticks.push(v);

  const slot = innerW / display.length;
  const bw = Math.min(40, slot * 0.62);
  const maxIdx = display.reduce((mi, d, i) => (d.count > display[mi].count ? i : mi), 0);

  // label X: maksimal ~8 label agar tidak bertabrakan
  const labelEvery = Math.max(1, Math.ceil(display.length / 8));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Volume transaksi per hari">
        {/* grid + label Y */}
        {ticks.map((v) => {
          const y = 6 + innerH - (v / axisMax) * innerH;
          return (
            <g key={v}>
              <line x1={mL} x2={W - 8} y1={y} y2={y} stroke={v === 0 ? "#d1d5db" : "#f3f4f6"} strokeWidth={1} />
              <text x={mL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {v >= 1000 ? v / 1000 + "rb" : v}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {display.map((d, i) => {
          const bh = (d.count / axisMax) * innerH;
          const x = mL + i * slot + (slot - bw) / 2;
          const y = 6 + innerH - bh;
          const active = hover === i;
          const emphasized = i === maxIdx;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={bw}
                height={bh}
                rx={4}
                fill={active ? "#1a3f8f" : emphasized ? "#2353B9" : "#b6c8ec"}
                style={{ transition: "fill 0.15s" }}
              />
              {/* hit target lebih besar dari mark */}
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
                  fontSize={11}
                  fill="#9ca3af"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* tooltip */}
      {hover !== null && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((mL + hover * slot + slot / 2) / W) * 100}%`,
            top: 0,
            transform: "translate(-50%, -10%)",
          }}
        >
          <p className="text-gray-400">{longDate(display[hover].date)}</p>
          <p className="font-semibold text-[13px]">{formatNumber(display[hover].count)} transaksi</p>
        </div>
      )}
    </div>
  );
}

function shortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${parseInt(m[3])} ${bulan[parseInt(m[2]) - 1]}`;
}

function longDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const n = rough / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}
