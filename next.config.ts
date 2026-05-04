import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: true,
    webpackBuildWorker: false,
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
