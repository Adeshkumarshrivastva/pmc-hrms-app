import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second build/start (e.g. for testing) use its own folder instead of the running dev server's.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Lets phones on the office Wi-Fi open the dev server via the laptop's LAN IP (see "dev:lan").
  allowedDevOrigins: ["192.168.1.7"],
};

export default nextConfig;
