import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  compress: true,
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react", "motion/react", "sonner"],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60,
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/api/events",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Connection", value: "keep-alive" },
        { key: "X-Accel-Buffering", value: "no" },
      ],
    },
    {
      source: "/api/public/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=60, s-maxage=120, stale-while-revalidate=120" },
      ],
    },
    {
      source: "/:path*",
      has: [{ type: "header", key: "accept", value: ".*" }],
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
