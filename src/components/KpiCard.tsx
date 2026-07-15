import { TrendChip } from "./Badges";

interface Props {
  accent: string; // warna strip atas
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  trend?: { direction: "up" | "down" | "flat"; good: boolean | null; label: string };
}

export default function KpiCard({ accent, iconBg, icon, label, value, caption, trend }: Props) {
  return (
    <div className="relative bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(16,24,40,0.06)] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div className="w-10 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
          {icon}
        </div>
        {trend && <TrendChip {...trend} />}
      </div>
      <p className="mt-2 text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1.5 text-xs text-gray-400">{caption}</p>
    </div>
  );
}
