// Web Worker untuk parsing Excel/CSV di background thread.
// Input: { type: "xlsx" | "csv", data: ArrayBuffer | string }
// Output: ParseResult | { error: string }

import { parseWorkbook, parseCsvText } from "./parser";

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: "xlsx" | "csv";
    data: ArrayBuffer | string;
  };
  try {
    const result = type === "csv"
      ? parseCsvText(data as string)
      : parseWorkbook(data as ArrayBuffer);
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
