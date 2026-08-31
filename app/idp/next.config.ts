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
    "@cortex/desk-core",
    "@cortex/desk-ui",
    "@cortex/desk-app",
  ],
  // Prefiksy kafelka `desk`. Nie w `.env`, tylko tutaj, bo to nie jest ustawienie
  // wdrożenia — trasa `/desk` wynika z manifestu kafelka i zmienia się razem z nim.
  // Zmienne muszą być `NEXT_PUBLIC_`, bo linki i `fetch` składają się także
  // w komponentach klienckich; Next wstawia je w czasie builda.
  //
  // Dwa prefiksy, nie jeden: strony kafelka stoją pod `/desk`, a jego trasy pod
  // `/api/desk`, bo `app/api` jest wspólne dla całej aplikacji i grupa tras go nie
  // przenosi. Aplikacja `apps/desk` ma własną konfigurację i zostaje przy korzeniu.
  env: {
    NEXT_PUBLIC_DESK_BAZA: "/desk",
    NEXT_PUBLIC_DESK_BAZA_API: "/api/desk",
  },
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
