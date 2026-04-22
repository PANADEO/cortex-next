import path from "node:path"
import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"
const repoRoot = path.resolve(__dirname, "..", "..")

const IDP_BACKEND_URL = process.env.IDP_BACKEND_URL ?? "http://localhost:8000"

const nextConfig: NextConfig = {
  distDir: isDev ? ".next-dev" : ".next",
  output: "standalone",
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  transpilePackages: [
    "@cortex/ui",
    "@cortex/styles",
    "@cortex/api",
    "@cortex/types",
    "@cortex/utils",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/user/me", destination: `${IDP_BACKEND_URL}/user/me` },
        { source: "/packages/dashboard-stats", destination: `${IDP_BACKEND_URL}/packages/dashboard-stats` },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
