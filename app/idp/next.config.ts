import type { NextConfig } from "next"
import path from "node:path"

const isDev = process.env.NODE_ENV === "development"
const repoRoot = path.resolve(__dirname, "..", "..")
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
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
    // Backend validates import payloads at 100 MB total file size. Next needs a
    // slightly higher middleware clone limit so multipart overhead can pass.
    middlewareClientMaxBodySize: "110mb",
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
}

export default nextConfig
