import { isFailed, isSuccess } from "@/lib/aggregate";

// Badge status transaksi (kolom sts_trx) — warna + teks (aman color-blind).
export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let cls = "bg-blue-50 text-blue-600"; // netral (WAITING APPROVE, dll.)
  if (isSuccess(s)) cls = "bg-green-50 text-green-600";
  else if (isFailed(s)) cls = s === "REJECT" || s === "REJECTED"
    ? "bg-amber-50 text-amber-600"
    : "bg-red-50 text-red-600";
  return (
    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {s}
    </span>
  );
}

// Badge pill % sukses (tabel Analitik): hijau >=90, kuning 70-89, merah <70.
export function PctBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 90
      ? "bg-green-50 text-green-600"
      : pct >= 70
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-600";
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
    </span>
  );
}

// Chip tren KPI: warna semantik (good=hijau) terpisah dari arah panah.
export function TrendChip({
  direction,
  good,
  label,
}: {
  direction: "up" | "down" | "flat";
  good: boolean | null; // null = netral
  label: string;
}) {
  const cls =
    good === null ? "bg-gray-100 text-gray-500" : good ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "—";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      {arrow} {label}
    </span>
  );
}
