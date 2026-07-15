import type { HistoryEntry } from "./types";

// Metadata riwayat konversi di localStorage (ringan);
// dataset penuh disimpan terpisah di IndexedDB (lihat db.ts).

const KEY = "conversion-history";
const ACTIVE_KEY = "active-dataset-id";

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistory(entry: HistoryEntry): void {
  const list = getHistory();
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}

export function removeHistory(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getHistory().filter((h) => h.id !== id)));
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveId(id: string | null): void {
  if (id === null) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, id);
}

export function newId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
