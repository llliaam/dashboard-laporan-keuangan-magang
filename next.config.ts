import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export untuk bundling ke Tauri (.exe) — semua halaman jadi HTML statis.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
