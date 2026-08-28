import type { NextConfig } from "next";

const backend = (process.env.API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const onVercel = process.env.VERCEL === "1";
const remoteApi = Boolean(process.env.API_URL && !/localhost|127\.0\.0\.1/.test(process.env.API_URL));

const nextConfig: NextConfig = {
  async rewrites() {
    if (onVercel && !remoteApi) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
