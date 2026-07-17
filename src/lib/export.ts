import * as XLSX from "xlsx";
import type { CleanRow } from "./types";
import { CLEAN_COLUMNS } from "./types";
import { formatRupiah, formatTanggal } from "./format";

function toExportRows(rows: CleanRow[]): Record<string, string>[] {
  return rows.map((r) => ({
    corpid: r.corpid,
    corpnm: r.corpnm,
    branchid: r.branchid,
    src_number: r.src_number,
    amount: formatRupiah(r.amount),
    fee: formatRupiah(r.fee),
    total: formatRupiah(r.total),
    product_name: r.product_name,
    sts_trx: r.sts_trx,
    txid: r.txid,
    err_message: r.err_message,
    tanggal: formatTanggal(r.tanggal),
  }));
}

// Untuk CSV: kolom yang berisi angka panjang (src_number, txid, corpid)
// dibungkus ="value" agar Excel tidak konversi ke scientific notation.
const forceText = (v: string) => (v ? `="${v}"` : "");

function toExportRowsCsv(rows: CleanRow[]): Record<string, string>[] {
  return rows.map((r) => ({
    corpid: forceText(r.corpid),
    corpnm: r.corpnm,
    branchid: r.branchid,
    src_number: forceText(r.src_number),
    amount: formatRupiah(r.amount),
    fee: formatRupiah(r.fee),
    total: formatRupiah(r.total),
    product_name: r.product_name,
    sts_trx: r.sts_trx,
    txid: forceText(r.txid),
    err_message: r.err_message,
    tanggal: formatTanggal(r.tanggal),
  }));
}

export function exportXlsx(rows: CleanRow[], fileName: string): void {
  const ws = XLSX.utils.json_to_sheet(toExportRows(rows), {
    header: CLEAN_COLUMNS.map((c) => c.key),
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Bersih");
  XLSX.writeFile(wb, fileName.replace(/\.(xlsx|xls|csv)$/i, "") + "-bersih.xlsx");
}

export function exportCsv(rows: CleanRow[], fileName: string): void {
  const ws = XLSX.utils.json_to_sheet(toExportRowsCsv(rows), {
    header: CLEAN_COLUMNS.map((c) => c.key),
  });
  // Pakai semicolon agar Excel locale Indonesia langsung baca per-kolom.
  // sep= hint di baris pertama memberitahu Excel delimiter yang dipakai.
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["﻿" + "sep=;\r\n" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/\.(xlsx|xls|csv)$/i, "") + "-bersih.csv";
  a.click();
  URL.revokeObjectURL(url);
}
