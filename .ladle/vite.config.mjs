import path from "node:path"
import { defineConfig } from "vite"

const a = (p) => path.resolve(p)

export default defineConfig({
  resolve: {
    alias: {
      "@cortex/ui": a("packages/@cortex/ui/src"),
      "@cortex/styles": a("packages/@cortex/styles"),
      "@cortex/utils": a("packages/@cortex/utils/src"),
      "@cortex/types": a("packages/@cortex/types/src"),
      "@cortex/api": a("packages/@cortex/api/src"),
      // Ladle nie renderuje ekranów aplikacji, ale MUSI umieć rozwiązać `@` —
      // singleton i18next stoi w `app/idp/lib/i18n` i to stamtąd bierze zasoby.
      "@": a("app/idp"),
    },
  },
})
