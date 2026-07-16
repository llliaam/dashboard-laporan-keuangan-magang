"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

const MENU = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1.5" y="10.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10.5" y="10.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/riwayat",
    label: "Riwayat",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 4.5V9l3 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2.3 7.2A7 7 0 1 1 2 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 4.5V7.3h2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/analitik",
    label: "Analitik",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 15V8M9 15V3M15 15v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [exitOpen, setExitOpen] = useState(false);

  const handleExit = async () => {
    // Di Tauri: tutup jendela aplikasi. Di browser: window.close() (berhasil
    // hanya jika tab dibuka via script — fallback tampilkan pesan singkat).
    try {
      const w = window as unknown as {
        __TAURI__?: { window?: { getCurrentWindow?: () => { close: () => Promise<void> } } };
      };
      if (w.__TAURI__?.window?.getCurrentWindow) {
        await w.__TAURI__.window.getCurrentWindow().close();
        return;
      }
    } catch {
      // lanjut ke fallback browser
    }
    window.close();
  };

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col px-4 py-7 min-h-screen sticky top-0 h-screen">
      {/* Brand */}
      <div className="flex items-center gap-1.5 pl-2 pb-4">
        <span className="text-[22px] font-bold text-brand-blue">Bank</span>
        <span className="text-[22px] font-bold text-brand-orange">SUMUT</span>
      </div>

      <p className="pl-3.5 pb-2 text-[11px] font-semibold tracking-[0.08em] text-gray-400">MENU</p>

      <nav className="flex flex-col gap-2">
        {MENU.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 h-11 px-3.5 rounded-[10px] text-sm transition-colors ${
                active
                  ? "bg-brand-blue text-white font-semibold"
                  : "text-gray-700 font-medium hover:bg-gray-100"
              }`}
            >
              <span className={active ? "text-white" : "text-gray-500"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button
        onClick={() => setExitOpen(true)}
        className="flex items-center justify-center gap-2.5 h-11 rounded-[10px] text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4.2 3.8a5.5 5.5 0 1 0 7.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Keluar Aplikasi
      </button>

      <p className="pl-3.5 pt-3 text-[10px] text-gray-300">v1.0.0 — Dashboard Laporan</p>

      <ConfirmDialog
        open={exitOpen}
        title="Keluar dari aplikasi?"
        message="Data konversi yang belum diexport akan tetap tersimpan di riwayat."
        confirmLabel="Keluar"
        onConfirm={handleExit}
        onCancel={() => setExitOpen(false)}
      />
    </aside>
  );
}
