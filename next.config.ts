import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Thumbnails do Instagram vêm de CDNs variados e expiram; usamos <img> puro,
  // então não configuramos next/image remotePatterns.
  output: "standalone", // build enxuto pro Docker (deploy Easypanel)
};

export default nextConfig;
