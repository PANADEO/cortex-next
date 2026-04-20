import { defineConfig } from "vite"
import path from "node:path"

const a = (p) => path.resolve(p)

export default defineConfig({
  resolve: {
    alias: {
      "@cortex/ui": a("libs/@cortex/ui/src"),
      "@cortex/styles": a("libs/@cortex/styles"),
      "@cortex/utils": a("libs/@cortex/utils/src"),
      "@cortex/types": a("libs/@cortex/types/src"),
      "@cortex/api": a("libs/@cortex/api/src"),
    },
  },
})
