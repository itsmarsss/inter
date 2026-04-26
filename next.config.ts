import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // ssh2 has a native addon (cpu-features) that Next.js cannot bundle
  serverExternalPackages: ["ssh2"],
  // Deduplicate three.js for Turbopack dev builds (stats-gl ships its own copy).
  // Must use a relative path — Turbopack rejects absolute Windows paths.
  turbopack: {
    resolveAlias: {
      three: "./node_modules/three",
    },
  },
  // Deduplicate three.js for production webpack builds (stats-gl ships its own copy)
  webpack(config) {
    config.resolve.alias["three"] = path.resolve(process.cwd(), "node_modules/three");
    return config;
  },
};

export default nextConfig;
