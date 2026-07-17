"use client";

import Sidebar from "./Sidebar";

// Kerangka halaman: sidebar kiri 240px + area konten (banner + panel abu).
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 min-w-0 px-4 pt-4 pb-3 flex flex-col">
        {/* Banner Bank Sumut */}
        <header
          className="relative flex items-center px-10 shrink-0 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(100deg, #071650 0%, #0e2178 25%, #1B2E9A 55%, #2353B9 100%)",
            height: "88px",
          }}
        >
          {/* ── Dekorasi biru ── */}

          {/* Kilap putih tipis di tepi atas */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
          />

          {/* Cincin besar kiri-bawah */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 260, height: 260, borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.06)",
              left: -90, bottom: -150,
            }}
          />
          {/* Cincin kecil tengah-atas */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 120, height: 120, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.07)",
              left: "36%", top: -60,
            }}
          />

          {/* ── Blob oranye kanan (persis Figma) ── */}

          {/* Blob utama */}
          <div
            className="absolute right-0 top-0 h-full pointer-events-none"
            style={{
              width: 340,
              background: "linear-gradient(150deg, #fbba5a 0%, #F9A13F 40%, #f07d10 100%)",
              borderRadius: "70% 0 0 80%",
            }}
          />
          {/* Sorot putih atas blob */}
          <div
            className="absolute right-0 top-0 pointer-events-none"
            style={{
              width: 340, height: "50%",
              background: "linear-gradient(175deg, rgba(255,255,255,0.22) 0%, transparent 100%)",
              borderRadius: "70% 0 0 0",
            }}
          />
          {/* Pola halftone titik-titik di blob (persis Figma) */}
          <div
            className="absolute right-0 top-0 h-full pointer-events-none"
            style={{
              width: 340,
              borderRadius: "70% 0 0 80%",
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)",
              backgroundSize: "14px 14px",
              backgroundPosition: "4px 4px",
            }}
          />
          {/* Shadow gelap bawah blob */}
          <div
            className="absolute right-0 bottom-0 pointer-events-none"
            style={{
              width: 340, height: "35%",
              background: "linear-gradient(0deg, rgba(0,0,0,0.14) 0%, transparent 100%)",
              borderRadius: "0 0 0 80%",
            }}
          />

          {/* ── Konten teks ── */}
          <div className="relative z-10 flex flex-col justify-center gap-1">
            <span className="text-white/50 text-[10px] font-semibold tracking-[0.22em] uppercase leading-none">
              Sistem Informasi
            </span>
            <span className="text-white text-[19px] font-bold tracking-wide leading-tight drop-shadow-sm">
              Dashboard Laporan Transaksi
            </span>
            <div className="w-8 h-[2px] rounded-full bg-white/25" />
          </div>
        </header>

        {/* Panel konten */}
        <main className="flex-1 mt-3.5 rounded-3xl bg-[#f0f0f0] p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
