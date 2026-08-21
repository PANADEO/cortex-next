import path from "node:path"
import { defineConfig } from "vitest/config"

const a = (p: string) => path.resolve(p)

export default defineConfig({
  resolve: {
    alias: {
      "@cortex/ui": a("packages/@cortex/ui/src"),
      "@cortex/styles": a("packages/@cortex/styles"),
      "@cortex/utils": a("packages/@cortex/utils/src"),
      "@cortex/types": a("packages/@cortex/types/src"),
      "@cortex/api": a("packages/@cortex/api/src"),
      "@cortex/tile-sdk": a("packages/@cortex/tile-sdk/src"),
      "@cortex/service": a("packages/@cortex/service/src"),
      "@cortex/db": a("packages/@cortex/db/src"),
      "@": a("app/idp"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    // i18next musi wstać, zanim jakikolwiek komponent zawoła useTranslation() —
    // testy renderują je bez AppProviders, czyli poza ścieżką inicjalizacji.
    setupFiles: ["./app/idp/lib/i18n/test-setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/.next*/**"],
  },
})
