import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".cordon-next",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
