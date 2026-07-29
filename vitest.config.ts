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
      "@": a("app/idp"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/.next*/**"],
  },
})
