import type { NextConfig } from "next";
import path from "path";

// stats-gl ships its own nested three@0.170.0 which creates a duplicate-instance
// warning and breaks SparkJS material.onBuild (added after r155).
// Force all three imports to the single root copy.
const THREE_PATH = path.resolve(process.cwd(), "node_modules/three");

const nextConfig: NextConfig = {
  output: "standalone",
  // ssh2 has a native addon (cpu-features) that Next.js cannot bundle
  serverExternalPackages: ["ssh2"],
  // Force three.js deduplication for Turbopack (dev) and webpack (prod)
  turbopack: {
    resolveAlias: {
      three: THREE_PATH,
    },
  },
  webpack(config) {
    config.resolve.alias["three"] = THREE_PATH;
    return config;
  },
};

export default nextConfig;
