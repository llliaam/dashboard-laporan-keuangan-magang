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
          className="relative flex items-center px-8 shrink-0 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(90deg, #1B2E9A 0%, #2353B9 55%, #2B52C0 100%)",
            height: "88px",
          }}
        >
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-2xl font-bold text-white">Bank</span>
            <span className="text-2xl font-bold text-brand-orange">SUMUT</span>
          </div>
          <div
            className="absolute right-0 top-0 h-full pointer-events-none"
            style={{
              width: 260,
              background: "linear-gradient(140deg, #F9A13F 0%, #F97316 100%)",
              borderRadius: "58% 0 0 78%",
            }}
          />
        </header>

        {/* Panel konten */}
        <main className="flex-1 mt-3.5 rounded-3xl bg-[#f0f0f0] p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
