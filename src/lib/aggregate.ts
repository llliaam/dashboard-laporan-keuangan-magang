import type { CleanRow, InstansiAggregate } from "./types";

// Status yang dihitung "berhasil" — sisanya (FAILED/REJECT/SUSPECT/dll.) gagal,
// kecuali WAITING APPROVE yang netral (belum final) tetap masuk pembagi.
const SUCCESS_STATUSES = new Set(["RELEASED", "SUCCESS", "APPROVED"]);
const FAILED_STATUSES = new Set(["FAILED", "REJECT", "REJECTED", "SUSPECT", "ERROR"]);

export function isSuccess(sts: string): boolean {
  return SUCCESS_STATUSES.has(sts.toUpperCase());
}
export function isFailed(sts: string): boolean {
  return FAILED_STATUSES.has(sts.toUpperCase());
}

// Group-by corpid: COUNT, SUM(total), berhasil/gagal, % sukses.
export function aggregateByInstansi(rows: CleanRow[]): InstansiAggregate[] {
  const map = new Map<string, InstansiAggregate>();
  for (const r of rows) {
    let agg = map.get(r.corpid);
    if (!agg) {
      agg = {
        corpid: r.corpid,
        corpnm: r.corpnm,
        count: 0,
        totalNominal: 0,
        success: 0,
        failed: 0,
        pctSuccess: 0,
      };
      map.set(r.corpid, agg);
    }
    agg.count++;
    agg.totalNominal += r.total;
    if (isSuccess(r.sts_trx)) agg.success++;
    else if (isFailed(r.sts_trx)) agg.failed++;
  }
  const out = [...map.values()];
  for (const a of out) {
    a.pctSuccess = a.count ? (a.success / a.count) * 100 : 0;
  }
  return out;
}

// Agregasi volume transaksi per tanggal (YYYY-MM-DD) untuk bar chart.
export function aggregateByDay(rows: CleanRow[]): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const day = r.tanggal.slice(0, 10);
    if (day) map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Distribusi status untuk donut: kelompokkan minor ke "Lainnya".
export function aggregateByStatus(rows: CleanRow[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const s = r.sts_trx || "(kosong)";
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3).reduce((sum, [, c]) => sum + c, 0);
  const out = top.map(([label, count]) => ({ label, count }));
  if (rest > 0) out.push({ label: "Lainnya", count: rest });
  return out;
}
