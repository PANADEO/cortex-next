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
        { source: "/packages/get_all", destination: `${IDP_BACKEND_URL}/packages/get_all` },
        { source: "/packages/action_logs", destination: `${IDP_BACKEND_URL}/packages/action_logs` },
        { source: "/packages/import", destination: `${IDP_BACKEND_URL}/packages/import` },
        { source: "/packages/import-multiple", destination: `${IDP_BACKEND_URL}/packages/import-multiple` },
        // Dynamic routes kolidują z Next page routes (app/packages/[id]/page.tsx),
        // więc rewrite ograniczony do API calls (Accept: application/json z apiClient).
        // Page navigation (Accept: text/html) leci do page componentu bez rewrite'u.
        {
          source: "/packages/:id/actions",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: `${IDP_BACKEND_URL}/packages/:id/actions`,
        },
        {
          source: "/packages/:id/transitions",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: `${IDP_BACKEND_URL}/packages/:id/transitions`,
        },
        {
          source: "/packages/:id/transport-orders",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: `${IDP_BACKEND_URL}/packages/:id/transport-orders`,
        },
        {
          source: "/packages/:id/download",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: `${IDP_BACKEND_URL}/packages/:id/download`,
        },
        {
          source: "/packages/:id/download-result",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: `${IDP_BACKEND_URL}/packages/:id/download-result`,
        },
        {
          source: "/packages/:id",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: `${IDP_BACKEND_URL}/packages/:id`,
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
