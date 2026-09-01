const path = require("node:path")

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
    // `plugin:@typescript-eslint/recommended` włącza tę regułę gołym "error",
    // czyli BEZ `ignoreRestSiblings` i bez konwencji podkreślnika. Efekt:
    // standardowy idiom pomijania klucza — `const { [K]: _pominiete, ...reszta }`
    // — jest błędem, mimo że nazwa z podkreślnikiem jawnie deklaruje, że
    // wiązanie istnieje wyłącznie po to, żeby czegoś NIE było w `reszta`.
    // Kosztowało to zatrzymany build (`next build` przerywa na błędzie lintu,
    // nie na ostrzeżeniu), więc konwencja jest tu zapisana wprost.
    // To nie jest poluzowanie reguły: nieużyta zmienna nadal jest błędem,
    // chyba że autor OZNACZY ją podkreślnikiem jako świadomie odrzuconą.
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        ignoreRestSiblings: true,
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
  overrides: [
    {
      // BIURKO — `no-custom-classname` włączone TYLKO tutaj i to jest sedno.
      //
      // Tailwind na nieznaną klasę nie zgłasza błędu, tylko nie generuje reguły.
      // Nie widzi tego `tsc`, nie widzi build, nie widzi żaden test — a objawem
      // jest element bez tła albo bez wysokości, którego nikt nie kojarzy ze
      // zmianą nazwy w configu. Tak właśnie `pb-pasek` nie działał od początku:
      // `pasek` stał w `height`, a `pb-*` czyta `spacing`.
      //
      // Wąsko, bo reszta repozytorium ma 830 użyć klas powłoki i własne klasy
      // spoza Tailwinda (`.skin-*`); włączenie tego globalnie byłoby regułą
      // nie do włączenia, a nie strażnikiem.
      files: [
        "packages/@cortex/desk-ui/src/**/*.{ts,tsx}",
        "packages/@cortex/desk-app/src/**/*.{ts,tsx}",
        "apps/desk/src/**/*.{ts,tsx}",
      ],
      extends: ["plugin:tailwindcss/recommended"],
      // Ścieżka MUSI być bezwzględna: plugin resolwuje moduł `tailwindcss`
      // względem katalogu configu, a przy ścieżce względnej trafia w katalog
      // linterowanego pakietu i przewraca się na „Could not resolve tailwindcss".
      settings: {
        tailwindcss: {
          config: path.join(__dirname, "tailwind.config.ts"),
          callees: ["cn", "clsx"],
        },
      },
      rules: {
        "tailwindcss/no-custom-classname": [
          "error",
          {
            // Klasy z `@cortex/styles/desk.css` — nie są narzędziami Tailwinda,
            // więc plugin ich nie zna i musi je tu zobaczyć wypisane.
            whitelist: [
              "desk", "sheet", "editor", "pulse", "spin", "slide-in", "step-running",
              "prose-desk", "t-display", "t-h2", "t-h3", "t-section", "t-body",
              "t-body-m", "t-meta", "t-micro", "t-btn",
            ],
          },
        ],
        // Kolejność klas pilnuje `prettier-plugin-tailwindcss` przy formatowaniu;
        // druga reguła o tym samym tylko dublowałaby komunikat.
        "tailwindcss/classnames-order": "off",
        "tailwindcss/no-unnecessary-arbitrary-value": "off",
        // `size-8` zamiast `h-8 w-8` to styl, nie poprawność — a ta reguła
        // dokłada tu 22 ostrzeżenia i topi w nich jedyny komunikat, dla
        // którego plugin został włączony.
        "tailwindcss/enforces-shorthand": "off",
      },
    },
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
