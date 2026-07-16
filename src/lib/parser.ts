import * as XLSX from "xlsx";
import type { CleanRow, ParseResult } from "./types";

// Urutan kolom pada data MENTAH (pipe-delimited, per file aktual):
// corpid | corpnm | branchid | src_number | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal
const RAW_COL_COUNT = 12;

// Nama sheet yang dicari per jenis file.
const SHEET_NAMES: Record<string, string[]> = {
  "Laporan Transaksi": ["data transaksi"],
  "Pemasukan Pajak Pemda": ["pemasukan pajak", "pajak", "pemasukan"],
};

// Langkah 2 — hapus tanda kutip tunggal di awal/akhir nilai string.
function stripQuotes(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  return t;
}

// Konversi nilai numerik yang mungkin sudah berformat.
// Excel dengan number-format (ribuan) + sheet_to_json({raw:false}) mengembalikan
// string seperti "34,177,458" atau "34.177.458" — Number() langsung = NaN.
// Tangani pemisah ribuan/desimal (koma & titik), simbol mata uang, dan spasi.
function toNumber(v: string): number {
  let t = stripQuotes(v).trim();
  if (!t) return 0;
  // Buang simbol mata uang & spasi (termasuk NBSP dari toLocaleString id-ID).
  t = t.replace(/rp/gi, "").replace(/[\s ]/g, "");
  if (!t || t === "-") return 0;

  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  if (hasComma && hasDot) {
    // Pemisah yang muncul terakhir dianggap desimal.
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
      t = t.replace(/\./g, "").replace(",", "."); // ID: titik ribuan, koma desimal
    } else {
      t = t.replace(/,/g, ""); // EN: koma ribuan, titik desimal
    }
  } else if (hasComma) {
    const parts = t.split(",");
    // >2 bagian, atau bagian akhir 3 digit → koma sebagai pemisah ribuan.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      t = t.replace(/,/g, "");
    } else {
      t = t.replace(",", "."); // koma desimal
    }
  } else if (hasDot) {
    const parts = t.split(".");
    // >2 bagian, atau bagian akhir 3 digit → titik sebagai pemisah ribuan.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      t = t.replace(/\./g, "");
    }
    // else: titik desimal murni, biarkan.
  }

  const n = Number(t);
  return isNaN(n) ? 0 : n;
}

// Transformasi satu baris mentah -> CleanRow, atau null jika baris invalid.
// Langkah 1 (split |), 2 (strip quotes), 6 (buang baris kosong / corpid kosong / kolom kurang).
export function parseRawLine(line: string): CleanRow | null {
  if (!line || !line.trim()) return null;
  const parts = line.split("|");
  if (parts.length < RAW_COL_COUNT) return null;

  const corpid = stripQuotes(parts[0]);
  if (!corpid) return null;
  // Duplikat header di tengah file juga dibuang.
  if (corpid.toLowerCase() === "corpid") return null;

  return {
    corpid,
    corpnm: stripQuotes(parts[1]),
    branchid: stripQuotes(parts[2]),
    src_number: stripQuotes(parts[3]),
    amount: toNumber(parts[4]),
    fee: toNumber(parts[5]),
    total: toNumber(parts[6]),
    product_name: stripQuotes(parts[7]),
    sts_trx: stripQuotes(parts[8]).toUpperCase(),
    txid: stripQuotes(parts[9]),
    err_message: stripQuotes(parts[10]),
    tanggal: stripQuotes(parts[11]),
  };
}

export function parseRawLines(allLines: string[]): ParseResult {
  // Baris kosong di ujung file adalah artefak (trailing newline), bukan data dibuang.
  const lines = [...allLines];
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  const rows: CleanRow[] = [];
  const droppedSamples: string[] = [];
  let dropped = 0;
  for (const line of lines) {
    const row = parseRawLine(line);
    if (row) {
      rows.push(row);
    } else if (line && line.trim()) {
      dropped++;
      if (droppedSamples.length < 5) droppedSamples.push(line.slice(0, 120));
    } else {
      dropped++; // baris kosong tetap dihitung sebagai dibuang
    }
  }
  return { rows, totalRaw: lines.length, dropped, droppedSamples };
}

// Cari nama sheet yang cocok untuk fileType, fallback ke sheet pertama.
function findSheet(wb: XLSX.WorkBook, fileType: string): string {
  const candidates = SHEET_NAMES[fileType] ?? ["data transaksi"];
  const found = wb.SheetNames.find((n) =>
    candidates.some((c) => n.trim().toLowerCase().includes(c))
  );
  return found ?? wb.SheetNames[0];
}

// Baca workbook Excel: ambil sheet sesuai fileType, fallback sheet pertama.
// Data mentah = 1 kolom tunggal di kolom A, baris 1 header.
export function parseWorkbook(data: ArrayBuffer, fileType = "Laporan Transaksi"): ParseResult {
  const wb = XLSX.read(data, { type: "array" });
  const sheetName = findSheet(wb, fileType);
  if (!sheetName) throw new Error("File tidak memiliki sheet.");
  const sheet = wb.Sheets[sheetName];

  // header:1 -> array of arrays; kolom A = index 0.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  if (aoa.length < 2) throw new Error("Sheet kosong atau hanya berisi header.");

  const lines: string[] = [];
  for (let i = 1; i < aoa.length; i++) {
    // Baris bisa terpecah ke beberapa cell jika Excel memisahkan '|' — gabung kembali.
    const cells = aoa[i] as unknown[];
    const line = cells.map((c) => String(c ?? "")).join("|").replace(/\|+$/, "");
    lines.push(line);
  }
  return parseRawLines(lines);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseCsvText(text: string, _fileType = "Laporan Transaksi"): ParseResult {
  const lines = text.split(/\r?\n/);
  lines.shift(); // buang header
  return parseRawLines(lines);
}
