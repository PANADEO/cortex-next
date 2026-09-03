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
      // Biurko: `desk-core` sięga do słownika `desk-ui` (typ tłumacza, a w testach także
      // sama funkcja). Bez tego aliasu każdy test dowodu przewracał się na rozwiązaniu
      // ścieżki, a nie na tym, co miał sprawdzać.
      "@cortex/desk-ui": a("packages/@cortex/desk-ui/src"),
      "@cortex/desk-core": a("packages/@cortex/desk-core/src"),
      "@": a("app/idp"),
      // `server-only` to pakiet, którego całą treścią jest `throw` — pilnuje granicy
      // klient/serwer przy budowaniu Next. W teście tej granicy nie ma, a on i tak
      // przewraca każdy test wołający trasę BFF wprost. Zaślepka dotyczy WYŁĄCZNIE
      // testów; budowanie używa prawdziwego pakietu.
      "server-only": a("test/server-only-stub.ts"),
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
