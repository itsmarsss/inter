import type { NextConfig } from "next";
import path from "path";

// Absolute path to the single canonical three.js copy.
// stats-gl ships its own nested three@0.170.0 which causes a duplicate-instance
// warning and breaks SparkJS material.onBuild (added in r155+).
const THREE_PATH = path.resolve(process.cwd(), "node_modules/three");

const nextConfig: NextConfig = {
  output: "standalone",
  // ssh2 has a native addon (cpu-features) that Next.js cannot bundle
  serverExternalPackages: ["ssh2"],
  // Force all three imports to the same instance (Turbopack dev server)
  turbopack: {
    resolveAlias: {
      three: THREE_PATH,
    },
  },
  // Same deduplication for production builds (webpack)
  webpack(config) {
    config.resolve.alias["three"] = THREE_PATH;
    return config;
  },
};

export default nextConfig;
