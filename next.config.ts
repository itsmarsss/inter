import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    // ssh2 has a native addon (cpu-features) that Next.js cannot bundle
    serverExternalPackages: ["ssh2"],
};

export default nextConfig;
