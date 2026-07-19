import * as XLSX from "xlsx";
import type { CleanRow, ParseResult } from "./types";

// Urutan kolom pada data MENTAH (pipe-delimited, per file aktual):
// corpid | corpnm | src_number | branchid | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal
const RAW_COL_COUNT = 12;

// Nama sheet fallback jika content-based detection gagal.
const SHEET_NAMES: string[] = ["data transaksi"];

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
    src_number: stripQuotes(parts[2]),
    branchid: stripQuotes(parts[3]),
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

// Deteksi sheet data mentah berdasarkan isi: cari sheet yang baris pertama datanya
// (baris ke-2, index r=1) di kolom A mengandung karakter pipe '|'.
// Fallback: nama-based (SHEET_NAMES), lalu sheet pertama.
function findSheet(wb: XLSX.WorkBook): string {
  // Priority 1: content-based — sheet dengan pipe-delimited di cell A2
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (range.e.r < 1) continue; // hanya header, tidak ada data
    const a2 = sheet[XLSX.utils.encode_cell({ r: 1, c: range.s.c })];
    if (a2 && a2.t === "s" && String(a2.v).includes("|")) return name;
  }
  // Priority 2: name-based
  const found = wb.SheetNames.find((n) =>
    SHEET_NAMES.some((c) => n.trim().toLowerCase().includes(c))
  );
  return found ?? wb.SheetNames[0];
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// Ubah satu cell Excel jadi string yang mempertahankan NILAI ASLI:
// - Numerik biasa (txid, amount, dst.) -> nilai penuh, bukan teks terformat.
//   Contoh: txid 202501016975 (jangan sampai jadi scientific "2.02501E+11"),
//   amount 43000000 (bukan "Rp43,000,000").
// - Numerik bertipe tanggal (serial Excel, mis. 45658.25) -> "YYYY-MM-DD HH:MM:SS"
//   via SSF.parse_date_code (wall-clock, TZ-independent — TIDAK bergeser timezone
//   seperti cellDates/objek Date). Format ini yang dipahami formatTanggal().
// - String (mis. sheet mentah 1-kolom pipe-delimited) -> apa adanya.
function cellToText(cell: XLSX.CellObject | undefined): string {
  if (cell == null || cell.v == null) return "";
  if (cell.t === "n") {
    if (cell.z && XLSX.SSF.is_date(cell.z)) {
      const d = XLSX.SSF.parse_date_code(cell.v as number);
      if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)} ${pad2(d.H)}:${pad2(d.M)}:${pad2(d.S)}`;
    }
    // String(number) menjaga integer besar (<=12 digit di data ini) tetap presisi penuh.
    return String(cell.v);
  }
  return String(cell.v);
}

// Baca workbook Excel: ambil sheet sesuai fileType, fallback sheet pertama.
// Dua bentuk input didukung:
//   1. Sheet mentah 1-kolom pipe-delimited (kolom A) -> satu cell string per baris.
//   2. Sheet 12-kolom terpisah -> tiap field cell sendiri, digabung ulang dgn '|'.
// cellNF:true agar cell.z (number-format) tersedia untuk deteksi kolom tanggal.
// Baca per-cell (bukan sheet_to_json{raw:false}) supaya nilai numerik ASLI dipakai,
// bukan teks terformat — kunci perbaikan txid scientific & amount.
export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { type: "array", cellNF: true });
  const sheetName = findSheet(wb);
  if (!sheetName) throw new Error("File tidak memiliki sheet.");
  const sheet = wb.Sheets[sheetName];
  if (!sheet["!ref"]) throw new Error("Sheet kosong atau hanya berisi header.");

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (range.e.r < 1) throw new Error("Sheet kosong atau hanya berisi header.");

  const lines: string[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cells.push(cellToText(sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined));
    }
    lines.push(cells.join("|"));
  }
  return parseRawLines(lines);
}

export function parseCsvText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  lines.shift(); // buang header
  return parseRawLines(lines);
}
