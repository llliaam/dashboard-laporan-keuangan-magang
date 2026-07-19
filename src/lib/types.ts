// Satu baris data bersih hasil konversi (urutan kolom output).
export interface CleanRow {
  corpid: string;
  corpnm: string;
  branchid: string;
  src_number: string;
  amount: number;
  fee: number;
  total: number;
  product_name: string;
  sts_trx: string;
  txid: string;
  err_message: string;
  tanggal: string; // ISO-like "YYYY-MM-DD HH:MM:SS" (mentah, diformat saat render)
}

export const CLEAN_COLUMNS: { key: keyof CleanRow; label: string }[] = [
  { key: "corpid", label: "corpid" },
  { key: "corpnm", label: "corpnm" },
  { key: "branchid", label: "branchid" },
  { key: "src_number", label: "src_number" },
  { key: "amount", label: "amount" },
  { key: "fee", label: "fee" },
  { key: "total", label: "total" },
  { key: "product_name", label: "product_name" },
  { key: "sts_trx", label: "sts_trx" },
  { key: "txid", label: "txid" },
  { key: "err_message", label: "err_message" },
  { key: "tanggal", label: "tanggal" },
];

export interface ParseResult {
  rows: CleanRow[];
  totalRaw: number; // jumlah baris data mentah (tanpa header)
  dropped: number; // baris dibuang (kosong/corpid kosong/kolom kurang)
  droppedSamples: string[]; // contoh baris yang dibuang (maks 5) untuk pesan error
}

// Metadata satu entri riwayat konversi (disimpan di localStorage;
// dataset penuh di IndexedDB dengan key = id).
export interface HistoryEntry {
  id: string;
  fileName: string;
  convertedAt: string; // ISO date
  rowCount: number;
  dropped: number;
  fileType: "Laporan Transaksi";
  status: "ok" | "failed";
  errorMsg?: string;
}

export interface InstansiAggregate {
  corpid: string;
  corpnm: string;
  count: number;
  totalNominal: number;
  success: number;
  failed: number;
  pctSuccess: number; // 0-100
}

export interface KanalAggregate {
  kanal: string;
  count: number;
  totalNominal: number;
  success: number;
  failed: number;
  pctSuccess: number; // 0-100
  avgTicket: number;  // totalNominal / count
}
