"use client";

interface Item {
  label: string;
  value: number;
  sublabel?: string;
}

interface Props {
  data: Item[];
  formatValue: (n: number) => string;
  color?: string;
}

export default function HBarChart({ data, formatValue, color = "#2353B9" }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        Tidak ada data
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((item, i) => {
        const pct = (item.value / maxVal) * 100;
        return (
          <div key={i} className="flex items-center gap-3 group">
            {/* Rank */}
            <span className="w-5 text-[11px] font-semibold text-gray-400 shrink-0 text-right">
              {i + 1}
            </span>
            {/* Label + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className="text-[12px] font-medium text-gray-700 truncate"
                  title={item.label}
                >
                  {item.label}
                </span>
                <span className="text-[12px] font-semibold text-gray-900 whitespace-nowrap shrink-0">
                  {formatValue(item.value)}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: color, opacity: i === 0 ? 1 : 0.55 + (1 - i / data.length) * 0.45 }}
                />
              </div>
              {item.sublabel && (
                <span className="text-[10px] text-gray-400">{item.sublabel}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
