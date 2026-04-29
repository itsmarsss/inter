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
};

export default nextConfig;
