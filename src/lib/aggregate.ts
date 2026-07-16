import type { CleanRow, InstansiAggregate, KanalAggregate } from "./types";

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

// Group-by product_name: COUNT, SUM(total), berhasil/gagal, % sukses, avg ticket.
export function aggregateByKanal(rows: CleanRow[]): KanalAggregate[] {
  const map = new Map<string, KanalAggregate>();
  for (const r of rows) {
    const key = r.product_name?.trim() || "(kosong)";
    let agg = map.get(key);
    if (!agg) {
      agg = { kanal: key, count: 0, totalNominal: 0, success: 0, failed: 0, pctSuccess: 0, avgTicket: 0 };
      map.set(key, agg);
    }
    agg.count++;
    agg.totalNominal += Number(r.total) || 0;
    if (isSuccess(r.sts_trx)) agg.success++;
    else if (isFailed(r.sts_trx)) agg.failed++;
  }
  const out = [...map.values()];
  for (const a of out) {
    a.pctSuccess = a.count ? (a.success / a.count) * 100 : 0;
    a.avgTicket = a.count ? a.totalNominal / a.count : 0;
  }
  return out.sort((a, b) => b.totalNominal - a.totalNominal);
}

// Hitung sebaran 3 zona % sukses dari aggregates per instansi.
export function successZones(aggs: InstansiAggregate[]): { label: string; count: number }[] {
  let sehat = 0, waspada = 0, kritis = 0;
  for (const a of aggs) {
    if (a.pctSuccess >= 90) sehat++;
    else if (a.pctSuccess >= 70) waspada++;
    else kritis++;
  }
  const out = [];
  if (sehat > 0) out.push({ label: "Sehat (≥90%)", count: sehat });
  if (waspada > 0) out.push({ label: "Waspada (70–89%)", count: waspada });
  if (kritis > 0) out.push({ label: "Kritis (<70%)", count: kritis });
  return out;
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
