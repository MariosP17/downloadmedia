import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: '/downloader',
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.83','100.126.90.29'],
  env: {
    NEXT_PUBLIC_BASE_PATH: '/downloader',
  },
};

export default nextConfig;
