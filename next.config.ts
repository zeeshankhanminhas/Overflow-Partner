import type { NextConfig } from "next";

const executionSecurityHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/execution/:path*",
        headers: executionSecurityHeaders,
      },
      {
        source: "/api/execution/:path*",
        headers: executionSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
