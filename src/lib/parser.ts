import * as XLSX from "xlsx";
import type { CleanRow, ParseResult } from "./types";

// Urutan kolom pada data MENTAH (pipe-delimited, per CLAUDE.md):
// corpid | corpnm | src_number | branchid | amount | fee | total | product_name | sts_trx | txid | err_message | tanggal
const RAW_COL_COUNT = 12;

// Langkah 2 — hapus tanda kutip tunggal di awal/akhir nilai string.
function stripQuotes(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  return t;
}

function toNumber(v: string): number {
  const n = Number(stripQuotes(v));
  return isNaN(n) ? 0 : n;
}

// Transformasi satu baris mentah -> CleanRow, atau null jika baris invalid.
// Langkah 1 (split |), 2 (strip quotes), 3 (reorder src_number<->branchid),
// 6 (buang baris kosong / corpid kosong / kolom kurang).
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
    branchid: stripQuotes(parts[3]), // reorder: branchid (raw idx 3) -> posisi 3 bersih
    src_number: stripQuotes(parts[2]), // src_number (raw idx 2) -> posisi 4 bersih
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

// Baca workbook Excel: ambil sheet "Data Transaksi" jika ada, selain itu sheet pertama.
// Data mentah = 1 kolom tunggal di kolom A, baris 1 header.
export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { type: "array" });
  const sheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === "data transaksi") ?? wb.SheetNames[0];
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

export function parseCsvText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  lines.shift(); // buang header
  return parseRawLines(lines);
}
