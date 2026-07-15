"use client";

import AppShell from "@/components/AppShell";

const STEPS = [
  {
    title: "Parse Pipe-Delimited String",
    desc: "Setiap baris di kolom A (mulai baris 2) dipecah berdasarkan karakter pipe (|) menjadi array 12 elemen sesuai urutan kolom data mentah.",
    example: "'2310000005'|'DINAS KETAHANAN PANGAN'|... → [corpid, corpnm, src_number, ...]",
  },
  {
    title: "Hapus Tanda Kutip Tunggal",
    desc: "Setiap nilai string yang diapit tanda kutip tunggal ('...') dibersihkan. Kolom numerik (amount, fee, total) tidak memiliki kutip di data mentah.",
    example: "'DINAS KETAHANAN PANGAN' → DINAS KETAHANAN PANGAN",
  },
  {
    title: "Reorder Kolom",
    desc: "Posisi src_number dan branchid ditukar: di data mentah src_number ada di posisi 3, branchid di posisi 4 — di data bersih urutannya dibalik.",
    example: "..., src_number, branchid, ... → ..., branchid, src_number, ...",
  },
  {
    title: "Format Kolom Numerik",
    desc: "Nilai amount, fee, dan total dikonversi ke format mata uang Rupiah dengan pemisah ribuan titik. Nilai 0 ditampilkan sebagai \"Rp -\".",
    example: "34177458 → Rp 34.177.458 · 0 → Rp -",
  },
  {
    title: "Format Kolom Tanggal",
    desc: "Format tanggal diubah dari YYYY-MM-DD HH:MM:SS menjadi format Indonesia DD/MM/YYYY HH:MM tanpa detik.",
    example: "2025-03-03 17:29:19 → 03/03/2025 17:29",
  },
  {
    title: "Hapus Baris Tidak Valid",
    desc: "Baris kosong, baris dengan corpid kosong, baris dengan kolom kurang dari 12, dan duplikat header di tengah file dibuang. Jumlah baris yang dibuang dilaporkan ke pengguna sebagai bagian dari transparansi proses.",
    example: "63.958 baris mentah → 63.956 baris bersih (2 dibuang)",
  },
];

const RAW_COLS = "corpid | corpnm | src_number | branchid | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal";
const CLEAN_COLS = "corpid | corpnm | branchid | src_number | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal";

export default function TentangPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tentang &amp; Metodologi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Algoritma pembersihan data mentah menjadi laporan transaksi yang rapi dan mudah dibaca
          </p>
        </div>

        {/* Ringkasan aplikasi */}
        <div className="bg-white rounded-2xl p-7 shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
          <h2 className="font-semibold text-gray-900 mb-3">Tentang Aplikasi</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Dashboard Laporan Transaksi adalah aplikasi desktop untuk mengolah file Excel data mentah
            transaksi dan pemasukan pajak Pemda Sumatera Utara menjadi laporan bersih yang siap dianalisis.
            Data mentah yang tersimpan sebagai teks pipe-delimited dalam satu kolom ditransformasi menjadi
            tabel 12 kolom terstruktur, lengkap dengan visualisasi, agregasi per instansi, dan export ke
            Excel/CSV. Seluruh pemrosesan berjalan lokal di komputer Anda — tidak ada data yang dikirim ke server.
          </p>
        </div>

        {/* Struktur kolom */}
        <div className="bg-white rounded-2xl p-7 shadow-[0_4px_16px_rgba(16,24,40,0.06)] space-y-4">
          <h2 className="font-semibold text-gray-900">Struktur Kolom</h2>
          <div>
            <p className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5">DATA MENTAH (1 kolom, pipe-delimited)</p>
            <code className="block text-[12px] bg-gray-50 rounded-lg px-4 py-3 text-gray-700 overflow-x-auto whitespace-nowrap">
              {RAW_COLS}
            </code>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 tracking-wide mb-1.5">DATA BERSIH (12 kolom terpisah — perhatikan posisi branchid &amp; src_number)</p>
            <code className="block text-[12px] bg-blue-50 rounded-lg px-4 py-3 text-brand-blue overflow-x-auto whitespace-nowrap">
              {CLEAN_COLS}
            </code>
          </div>
        </div>

        {/* Langkah transformasi */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 pl-1">6 Langkah Transformasi</h2>
          {STEPS.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(16,24,40,0.04)] flex gap-5">
              <div className="w-10 h-10 rounded-xl bg-brand-blue text-white font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{s.desc}</p>
                <code className="block mt-2.5 text-[12px] bg-gray-50 rounded-lg px-3.5 py-2.5 text-gray-600 overflow-x-auto whitespace-nowrap">
                  {s.example}
                </code>
              </div>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="bg-white rounded-2xl p-7 shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
          <h2 className="font-semibold text-gray-900 mb-3">Teknologi</h2>
          <div className="flex flex-wrap gap-2">
            {["Next.js (static export)", "React", "TypeScript", "Tailwind CSS", "SheetJS (xlsx)", "Tauri", "IndexedDB"].map((t) => (
              <span key={t} className="px-3.5 py-1.5 rounded-lg bg-gray-50 text-sm text-gray-600 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
