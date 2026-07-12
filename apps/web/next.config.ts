import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The engine ships as raw TypeScript (no build step), so Next must
  // transpile it as part of the app build.
  transpilePackages: ["@fils/engine"],
};

export default nextConfig;