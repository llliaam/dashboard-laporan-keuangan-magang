import * as XLSX from "xlsx";
import type { CleanRow } from "./types";
import { CLEAN_COLUMNS } from "./types";
import { formatRupiah, formatTanggal } from "./format";

// Baris untuk export: angka diformat Rupiah, tanggal format Indonesia —
// sama dengan tampilan tabel bersih (sesuai CLAUDE.md, export = tabel bersih).
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

export function exportXlsx(rows: CleanRow[], fileName: string): void {
  const ws = XLSX.utils.json_to_sheet(toExportRows(rows), {
    header: CLEAN_COLUMNS.map((c) => c.key),
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Bersih");
  XLSX.writeFile(wb, fileName.replace(/\.(xlsx|xls|csv)$/i, "") + "-bersih.xlsx");
}

export function exportCsv(rows: CleanRow[], fileName: string): void {
  const ws = XLSX.utils.json_to_sheet(toExportRows(rows), {
    header: CLEAN_COLUMNS.map((c) => c.key),
  });
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.replace(/\.(xlsx|xls|csv)$/i, "") + "-bersih.csv";
  a.click();
  URL.revokeObjectURL(url);
}
