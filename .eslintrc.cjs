module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  extends: [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
  ],
  settings: {
    next: { rootDir: "app/idp" },
  },
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "warn",
  },
  overrides: [
    {
      // Warstwa 3 huba (D4): layout dostaje gotowy `HubModel` propsem i nie
      // ma prawa sam sięgać po dane ani po regułę dostępu. Bez tej reguły
      // drugi layout skopiuje `useHubTiles()`/`canAccessTile()` do siebie i
      // od tego momentu dwa huby rozjeżdżają się po cichu — to jest dokładnie
      // ten koszt, którego rozdzielenie danych od widoku ma nie dopuścić.
      //
      // Świadomie WĄSKO (jeden katalog, `no-restricted-imports` ze stdliba
      // @typescript-eslint) — to nie jest zapowiadana w docs/modular-monolith.md
      // warstwa `eslint-plugin-boundaries` dla granic MIĘDZY kafelkami, tylko
      // jedna reguła wewnątrz powłoki, i tamtej pracy nie przesądza.
      files: ["app/idp/components/shell/hub/layouts/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-restricted-imports": [
          "error",
          {
            // Lista to WSZYSTKIE wejścia `use-hub-model.ts`, nie dwa moduły
            // wymienione w projekcie: `@cortex/api` (useAuthorizedApps,
            // useHubTiles), `@/lib/tiles` (canAccessTile, kategorie),
            // `@/lib/stores/*` (useFavoritesStore) i `@/features/*`
            // (useCoworkProjectTiles). Dwa ostatnie wpisy celowo obejmują CAŁE
            // katalogi, a nie pojedyncze pliki: to są z definicji stan i dane,
            // więc nowe wejście modelu nie prześlizgnie się tędy pod nową
            // nazwą. Gdy `use-hub-model.ts` dostanie kolejne źródło spoza tych
            // ścieżek, dopisz je tutaj — inaczej reguła zacznie kłamać.
            patterns: [
              {
                group: [
                  "@cortex/api",
                  "@cortex/api/*",
                  "@/lib/tiles",
                  "**/lib/tiles",
                  "@/lib/stores/*",
                  "**/lib/stores/*",
                  "@/features/*",
                  "**/features/*",
                ],
                // Sam typ wolno: layout renderuje `Tile[]`, więc musi go nazwać.
                allowTypeImports: true,
                message:
                  "Layout huba dostaje dane wyłącznie przez HubModel z useHubModel(). Import wartości z API, rejestru kafelków, store'ów albo features duplikuje warstwę 0 (D4).",
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    "node_modules",
    ".next",
    ".next-dev",
    "dist",
    "app/idp/public/pdfjs",
    "app/idp/next-env.d.ts",
  ],
}
