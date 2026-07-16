// Format angka ke mata uang Rupiah sesuai spesifikasi CLAUDE.md:
// 34177458 -> "Rp 34.177.458", 0 -> "Rp -"
export function formatRupiah(value: number): string {
  if (!value) return "Rp -";
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

// Ringkas nominal besar untuk KPI/agregat: 2_410_000_000_000 -> "Rp 2,41 T"
export function formatRupiahCompact(value: number): string {
  if (!value) return "Rp -";
  const abs = Math.abs(value);
  const fmt = (v: number, suffix: string) =>
    "Rp " + v.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " " + suffix;
  if (abs >= 1e12) return fmt(value / 1e12, "T");
  if (abs >= 1e9) return fmt(value / 1e9, "M");
  if (abs >= 1e6) return fmt(value / 1e6, "jt");
  return formatRupiah(value);
}

// "2025-03-03 17:29:19" -> "03/03/2025 17:29" (sesuai CLAUDE.md, tanpa detik)
export function formatTanggal(raw: string): string {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

// "2026-07-14T09:32:00.000Z" -> "14 Jul 2026, 09:32" (untuk kartu riwayat)
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":");
}

// Konversi berbagai format tanggal ke "YYYY-MM-DD" untuk perbandingan filter.
// Handle: "YYYY-MM-DD HH:MM:SS", "DD/MM/YYYY HH:MM", "M/D/YY HH:MM" (Excel US locale)
export function tanggalToIso(raw: string): string {
  if (!raw) return "";
  // YYYY-MM-DD (ISO — sudah benar)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY
  const dmy4 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy4) return `${dmy4[3]}-${dmy4[2].padStart(2, "0")}-${dmy4[1].padStart(2, "0")}`;
  // M/D/YY (Excel US locale, e.g. "1/1/25 6:05")
  const mdy2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:[^0-9]|$)/);
  if (mdy2) return `${2000 + Number(mdy2[3])}-${mdy2[1].padStart(2, "0")}-${mdy2[2].padStart(2, "0")}`;
  return "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
