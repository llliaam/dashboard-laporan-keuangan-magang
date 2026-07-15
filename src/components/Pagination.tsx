"use client";

interface Props {
  page: number; // 1-based
  totalPages: number;
  onChange: (page: number) => void;
}

// Pager ‹ 1 2 3 … N › — model window sederhana di sekitar halaman aktif.
export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const items: (number | "...")[] = [];
  const push = (v: number | "...") => {
    if (items[items.length - 1] !== v) items.push(v);
  };
  push(1);
  if (page > 3) push("...");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) push(p);
  if (page < totalPages - 2) push("...");
  if (totalPages > 1) push(totalPages);

  const btn =
    "min-w-8 h-8 px-2 rounded-lg text-[13px] flex items-center justify-center transition-colors";

  return (
    <div className="flex items-center gap-1.5">
      <button
        className={`${btn} bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed`}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Halaman sebelumnya"
      >
        ‹
      </button>
      {items.map((it, i) =>
        it === "..." ? (
          <span key={`e${i}`} className="px-1 text-gray-400 text-sm">
            …
          </span>
        ) : (
          <button
            key={it}
            className={`${btn} ${
              it === page ? "bg-brand-blue text-white font-semibold" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => onChange(it)}
          >
            {it}
          </button>
        )
      )}
      <button
        className={`${btn} bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed`}
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Halaman berikutnya"
      >
        ›
      </button>
    </div>
  );
}
