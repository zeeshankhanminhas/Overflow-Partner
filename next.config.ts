import type { NextConfig } from "next";

const executionSecurityHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const publicSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {source: '/:path*',headers: publicSecurityHeaders},
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
