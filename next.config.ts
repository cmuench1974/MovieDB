import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TMDB-URLs unverändert ausliefern: Browser lädt vom CDN,
    // nicht jeder Poster über Next.js (sharp + ggf. Tunnel).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;
