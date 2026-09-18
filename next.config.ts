import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },
};

export default nextConfig;
