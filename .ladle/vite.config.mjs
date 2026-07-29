import { defineConfig } from "vite"
import path from "node:path"

const a = (p) => path.resolve(p)

export default defineConfig({
  resolve: {
    alias: {
      "@cortex/ui": a("packages/@cortex/ui/src"),
      "@cortex/styles": a("packages/@cortex/styles"),
      "@cortex/utils": a("packages/@cortex/utils/src"),
      "@cortex/types": a("packages/@cortex/types/src"),
      "@cortex/api": a("packages/@cortex/api/src"),
    },
  },
})
