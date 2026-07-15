# CLAUDE.md

Ringkasan Project
Project dashboard laporan transaksi dan pemasukan pajak pemda sumut. Memuat sebuah visualisasi yang menampilkan tabel-tabel dari laporan excel yang berupa data mentah di input pengguna untuk diolah menjadi sebuah tabel data laporan transaksi dan pemasukan yang sudah bersih dan mudah dibaca oleh pengguna. Tambahan: Pertimbangkan untuk menggunakan chart-chart dalam visualisasi data yang dilakukan tetapi untuk file excel/csv yang di export tetap dalam bentuk tabel yang sudah diolah bersih.

Fitur Aplikasi
- Import file excel yang ingin ditampilkan.
- Filter kategori pada bagian visualisasi.
- Export file excel bersih kedalam format excel/csv.
- Fitur chart untuk insight yang lebih jelas (masih dalam pertimbangan)

Alur kerja pengembangan secara umum
Asumsikan aplikasi yang dibangun itu adalah aplikasi berbasis website, untuk menjadi aplikasi yang dapat berjalan secara lokal di komputer pengguna, maka disarankan untuk menggunakan kombinasi nextjs(dengan static export) + Tauri. Jadi alur nya adalah mengembangkan aplikasi berbasis website, setelah berhasil dikembangkan, source code dari framework NextJs(file-file seperti HTML, CSS dan JavaScript) perlu dikonfigurasi (static export) lalu akan dilakukan instalasi tauri untuk mengkonversi Framework Nextjs ini menjadi sebuah file Exe yang bisa diinstall oleh pengguna.

# CLAUDE.md — Konteks Project Dashboard Laporan Transaksi

## Ringkasan Project
Aplikasi dashboard desktop (Next.js + Tauri) untuk mengolah file Excel data mentah menjadi laporan transaksi dan pemasukan pajak Pemda Sumut yang bersih dan mudah dibaca. Output berupa tabel data bersih di UI dan file Excel/CSV yang dapat di-export.

---

## Struktur Data: File Laporan Transaksi (dari Bang Dedy)

### Sheet yang Dipakai
- **`Data Transaksi`** → data mentah (input pengguna)
- **`Data Transaksi (2)`** → contoh hasil data bersih (acuan output)

---

## Algoritma Pembersihan Data Mentah → Data Bersih

### Input: Format Data Mentah (`Data Transaksi`)
- Semua data tersimpan dalam **1 kolom tunggal** di kolom A
- Baris 1 adalah header, semua kolom dipisah karakter pipe `|`
- Nilai string diapit tanda kutip tunggal `'...'`
- Nilai numerik (amount, fee, total) adalah angka mentah tanpa format
- Format tanggal: `YYYY-MM-DD HH:MM:SS`

**Contoh baris mentah:**
```
'2310000005'|'DINAS KETAHANAN PANGAN'|'23101020000770'|'231'|34177458|0|34177458|'MULTI TRANSFER INTERNAL'|'REJECT'|||'2025-03-03 17:29:19'
```

**Urutan kolom di data mentah:**
```
corpid | corpnm | src_number | branchid | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal
```

---

### Output: Format Data Bersih (`Data Transaksi (2)`)
- Data tersebar di **12 kolom terpisah**
- Tidak ada tanda kutip tunggal di nilai manapun
- Angka diformat sebagai mata uang Rupiah
- Format tanggal diubah ke format Indonesia tanpa detik

**Urutan kolom di data bersih (berbeda dari mentah!):**
```
corpid | corpnm | branchid | src_number | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal
```

**Contoh baris bersih:**
```
1030000009 | PT TIGA SAUDARA JAYA | 103 | 10301040002455 | Rp 43.000.000 | Rp 6.500 | Rp 43.006.500 | TRANSFER ANTAR BANK | FAILED | | Transaksi tidak bisa dilakukan... | 01/01/2025 06:05
```

---

### Langkah-Langkah Transformasi

#### Langkah 1 — Parse Pipe-Delimited String
- Baca setiap baris di kolom A (mulai baris 2, lewati header)
- Split string berdasarkan karakter `|`
- Hasilnya adalah array 12 elemen sesuai urutan kolom mentah

#### Langkah 2 — Hapus Tanda Kutip Tunggal
- Untuk setiap nilai hasil split, hapus tanda kutip tunggal `'` di awal dan akhir string
- Berlaku untuk semua kolom yang bertipe string
- Kolom numerik (amount, fee, total) tidak memiliki kutip di data mentah

#### Langkah 3 — Reorder Kolom
- Tukar posisi `src_number` dan `branchid`
- Urutan di mentah: `..., src_number (index 2), branchid (index 3), ...`
- Urutan di bersih: `..., branchid (index 2), src_number (index 3), ...`

#### Langkah 4 — Format Kolom Numerik (amount, fee, total)
- Konversi nilai numerik mentah ke format mata uang Rupiah
- Format: `Rp X.XXX.XXX` (pemisah ribuan pakai titik `.`)
- Jika nilainya `0`, tampilkan sebagai `Rp -`
- Contoh: `34177458` → `Rp 34.177.458`, `0` → `Rp -`

#### Langkah 5 — Format Kolom Tanggal (`tanggal`)
- Ubah dari: `YYYY-MM-DD HH:MM:SS`
- Menjadi: `DD/MM/YYYY HH:MM` (tanpa detik)
- Contoh: `2025-03-03 17:29:19` → `03/03/2025 17:29`

#### Langkah 6 — Hapus Baris Tidak Valid
- Hapus baris yang kosong / tidak memiliki data setelah proses parse
- Data dengan kolom `corpid` kosong atau null dianggap baris invalid dan dibuang
- **Catatan:** Selisih 2 baris antara raw (63.958 data) dan clean (63.956 data) kemungkinan karena baris kosong atau duplikat header di dalam file raw

---

### Ringkasan Transformasi (Cheat Sheet)

| Kolom | Data Mentah | Data Bersih |
|---|---|---|
| `corpid` | `'2310000005'` | `2310000005` |
| `corpnm` | `'DINAS KETAHANAN PANGAN'` | `DINAS KETAHANAN PANGAN` |
| `branchid` | `'231'` *(di posisi ke-4 raw)* | `231` *(di posisi ke-3 bersih)* |
| `src_number` | `'23101020000770'` *(di posisi ke-3 raw)* | `23101020000770` *(di posisi ke-4 bersih)* |
| `amount` | `34177458` | `Rp 34.177.458` |
| `fee` | `0` | `Rp -` |
| `total` | `34177458` | `Rp 34.177.458` |
| `product_name` | `'MULTI TRANSFER INTERNAL'` | `MULTI TRANSFER INTERNAL` |
| `sts_trx` | `'REJECT'` | `REJECT` |
| `txid` | *(kosong)* | *(kosong)* |
| `err_message` | *(kosong)* | *(kosong)* |
| `tanggal` | `'2025-03-03 17:29:19'` | `03/03/2025 17:29` |

---

## Fitur Aplikasi

### 1. Import
- Pengguna upload file Excel (.xlsx)
- Pengguna memilih jenis file: **Laporan Transaksi** atau **Pemasukan Pajak Pemda**
- Sheet yang dibaca sesuai jenis file yang dipilih

### 2. Filter & Visualisasi
- Filter berdasarkan `corpid`
- Filter berdasarkan `sts_trx` (status transaksi: RELEASED, FAILED, REJECT, WAITING APPROVE, SUSPECT, dll.)
- Filter berdasarkan `product_name` (kanal transaksi: TRANSFER ANTAR BANK, TRANSFER INTERNAL, MULTI TRANSFER INTERNAL, PEMBELIAN PULSA, PEMBELIAN TOKEN PLN, dll.)

### 3. Export
- Export hasil data bersih ke format Excel (.xlsx) atau CSV (.csv)
- Data yang di-export tetap dalam format tabel bersih (bukan chart)

### 4. Chart (opsional)
- Visualisasi tambahan berupa chart untuk insight data
- Contoh: distribusi per `sts_trx`, volume transaksi per `product_name`, tren per tanggal

---

## Tech Stack
- **Next.js** (dengan static export `output: 'export'`)
- **Tauri** — bundling ke file `.exe`/`.msi` untuk Windows
- **Figma** — referensi desain UI (link akan diberikan terpisah)

---

## Struktur Navigasi & Halaman

### Keputusan Navigasi
Aplikasi menggunakan **sidebar kiri 240px** sebagai navigasi utama (bukan flow linear satu arah). Alasan: aplikasi desktop (Tauri), muat banyak menu, dan skalabel untuk penambahan halaman. Banner biru Bank Sumut tetap di area konten (bukan di sidebar). **Frame baru = 1680px** (sidebar 240 + area konten 1440).

### Daftar Halaman
| Halaman | Menu Sidebar | Deskripsi |
|---|---|---|
| **Dashboard / Hasil Konversi** | Dashboard | Upload file → convert → tabel data bersih 12 kolom + chart + KPI + filter + export. Halaman utama. |
| **Riwayat Konversi** | Riwayat | Daftar konversi yang pernah dilakukan (persistensi lokal). Bisa dibuka ulang/dihapus. |
| **Analitik & Insight per Instansi** | Analitik | Halaman terpisah. Agregasi group-by `corpid`: jumlah transaksi, total nominal, berhasil/gagal, % sukses per instansi. Drill-down ke tabel detail terfilter. **Catatan:** Nama awalnya "Ringkasan" tapi diubah ke "Analitik" — kata "Ringkasan" tabrakan makna dengan KPI cards di halaman Dashboard yang sudah berisi ringkasan numerik; halaman ini adalah analitik/agregasi level instansi (GROUP BY), berbeda konsep. |
| **Tentang / Metodologi** | Tentang | Dokumentasi algoritma pembersihan data mentah → bersih. |

### Keputusan UI Spesifik (Figma, 14 Jul 2026)
- **Sidebar bawah:** Tombol **"Keluar Aplikasi"** (bg `#fdeae7`, stroke `#f5c6bd`, teks/ikon `#E02D0D`, radius 10) — bukan profile card. Alasan: aplikasi desktop Tauri **tidak punya sistem akun/login**. Footer versi `10px #c4c9d4` di paling bawah sidebar.
- **Sidebar label section:** Label "MENU" uppercase `11px` letter-spacing 8% di atas daftar menu.
- **% Sukses di tabel Analitik:** Badge pill 3 tingkat, **bukan** progress bar: hijau ≥90% (`#e6f6ec/#00AA42`), kuning 70–89% (`#fef3e5/#B45309`), merah <70% (`#fdeae7/#E02D0D`).
- **Tabel Analitik:** Tidak ada avatar/inisial di kolom instansi — data murni teks, tidak ada sistem user.
- **Kartu Riwayat:** Strip status 5px di tepi kiri kartu (hijau = sukses, merah = gagal/error).
- **KPI cards:** Accent strip 4px warna di tepi atas + trend chip pill (↑/↓/— vs bulan lalu; hijau = baik, merah = buruk secara semantik).

### Catatan Desain
- **Dark mode**: dilewati untuk saat ini (fokus ke fitur fungsional dulu; dapat ditambahkan belakangan).
- Konsistensi visual (HCI): warna brand biru `#2353B9` / oranye `#F9A13F`, font Inter, badge status berwarna + berlabel (redundansi warna+teks untuk aksesibilitas color-blind).

---

## Design Tokens

### Warna
| Token | Hex | Penggunaan |
|---|---|---|
| Brand Blue | `#2353B9` | Sidebar aktif, CTA, aksen utama |
| Brand Orange | `#F9A13F` | Highlight, badge kanal |
| Sukses | `#00AA42` | Badge RELEASED, strip hijau |
| Gagal | `#E02D0D` | Badge FAILED/REJECT, alert merah |
| Teks Utama | `#111827` | Konten tabel, angka KPI |
| Teks Sekunder | `#6b7280` | Label KPI, subtitle |
| Teks Tersier | `#9ca3af` | Caption, hint |
| BG Panel | `#f0f0f0` | Latar panel konten utama |
| BG Frame | `#ffffff` | Card, modal, tabel |

### Tipografi (font: Inter)
| Level | Weight | Size | Warna |
|---|---|---|---|
| Judul halaman | SemiBold | 20px | `#000000` |
| Subjudul / heading kartu | SemiBold | 16px | `#111827` |
| Label KPI | Medium | 14px | `#6b7280` |
| Angka KPI | Bold | 30px | `#111827` |
| Caption / footer | Regular | 12px | `#9ca3af` |

### Radius & Shadow
| Elemen | Radius | Shadow |
|---|---|---|
| Panel konten utama | 24px | — |
| Card / kartu | 16px | y4 blur16 rgba(16,24,40,6%) |
| Card list (riwayat) | 16px | y2 blur8 rgba(16,24,40,4%) |
| Kontrol / tombol / input | 10px | — |
| Banner Bank Sumut | 16px | — |

---

## Figma File Reference

- **File key:** `r3GQB6tefsWM1JIapHYQq6`
- **Page aktif (kerja):** Page 2 — node `1054:587`
- **Page referensi lama:** Page 1 — node `0:1`

### Frame yang Sudah Ada (Page 2)
| Frame | Node ID | Keterangan |
|---|---|---|
| Dashboard V3 (upload idle) | `1054:588` | State awal, belum ada file |
| Loading Convert File | `1102:152` | Progress konversi |
| Loading Preview File | `1054:601` | Progress preview |
| Preview Completed | `1054:645` | Preview selesai |
| Delete Dialog Background | `1054:677` | Dialog konfirmasi hapus |
| Preview Failed | `1054:738` | State error |
| Dashboard Hasil Konversi | `1216:210` | Halaman utama 1440px (chart+KPI+tabel) — tanpa sidebar |
| Dashboard + Sidebar (retrofit) | `1237:232` | Dashboard 1680px dengan sidebar |
| Analitik & Insight per Instansi | `1240:663` | Halaman Analitik 1680px (KPI + tabel agregasi) |
| Riwayat Konversi | `1241:935` | Halaman Riwayat 1680px (list kartu) |

### Frame Belum Dibuat
- Halaman **Tentang / Metodologi** (1680px)

---

## Roadmap Pengembangan Lanjutan (untuk Laporan KP)

Fitur tambahan di luar MVP dasar, untuk memperdalam bobot teknis laporan magang. Diurutkan per prioritas.

### Tier 1 — Inti Tambahan
1. **Riwayat konversi (persistensi lokal)** — simpan metadata tiap konversi (nama file, tanggal, jumlah baris, ringkasan) via penyimpanan lokal Tauri (SQLite/localStorage). Mematahkan sifat "sekali pakai". → Bab: skema data lokal.
2. **Validasi & error-handling berlapis** — deteksi format kolom salah, baris korup, dan laporkan baris terbuang (mis. selisih 2 baris antara 63.958 raw vs 63.956 clean). → Bab: penanganan data kotor.
3. **Analitik per Instansi (group-by `corpid`)** — agregasi SUM/COUNT + hitung persentase sukses. Visualisasi badge pill 3 tingkat (≥90%/70–89%/<70%). → Bab: pengolahan data jadi informasi (bukan sekadar merapikan).

### Tier 2 — Kedalaman Teknis
4. **Dukungan jenis file kedua (Pemasukan Pajak Pemda)** — memenuhi cakupan awal CLAUDE.md; arsitektur parser modular.
5. **Web Worker untuk parsing 63k baris** — mencegah UI freeze; jadi bab optimasi performa (angka before/after).
6. **Filter lanjutan** — date range + multi-select status/kanal.

### Tier 3 — Poles
7. **Halaman Metodologi** — penjelasan algoritma pembersihan (langsung jadi screenshot bab metode).
8. **State konsisten** — empty state, loading, error (prinsip HCI).
9. **Dark mode** — ditunda (lihat Catatan Desain).

### Prinsip HCI yang Diterapkan
- *Consistency & standards* — reuse komponen banner, warna, font, radius/spacing.
- *Recognition over recall* — badge status berwarna, ikon KPI, menu sidebar selalu terlihat.
- *Visibility of system status* — KPI + persentase memberi ringkasan sekilas; loading/progress jelas.
- *Error prevention & recovery* — dialog konfirmasi hapus, validasi file, pesan error jelas.
- *Aesthetic & minimalist design* — hierarki jelas (chart → KPI → filter → tabel), zebra rows, angka rata-kanan.

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

TypeScript type-checking (no dedicated script): `npx tsc --noEmit`

## Architecture

This is a **Next.js 16 App Router** project bootstrapped with `create-next-app`.

- `src/app/` — App Router root. `layout.tsx` is the root layout; `page.tsx` is the `/` route.
- `src/app/globals.css` — Global styles, imported once in `layout.tsx`.
- `@/*` maps to `src/*` (configured in `tsconfig.json` paths).

**Styling:** Tailwind CSS v4 via PostCSS (`postcss.config.mjs`). No `tailwind.config.js` — v4 uses CSS-first configuration.

**Fonts:** Geist Sans and Geist Mono loaded via `next/font/google`, exposed as CSS variables `--font-geist-sans` and `--font-geist-mono` on the `<html>` element.

**Linting:** ESLint with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` (flat config in `eslint.config.mjs`).

New routes go under `src/app/` following the App Router file conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, etc.). Shared components should live in `src/components/`.
