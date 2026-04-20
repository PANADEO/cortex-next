# Repo Setup — Cortex Frontend

Single root `package.json`, no workspaces, no turbo. TS path aliases map `@cortex/*` directly to `libs/@cortex/*/src`. Next.js picks up local libs via `transpilePackages`.

> Later migration to pnpm workspaces = split per-lib `package.json` + add `workspaces` field. Not now.

---

## 1. File tree

```
cortex_frontend/
├── app/
│   └── idp/
│       ├── app/                      (App Router: layout, (auth), (main), api)
│       ├── components/
│       ├── features/
│       ├── lib/
│       ├── mocks/                    (MSW handlers + browser/server bootstrap)
│       ├── public/
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── next-env.d.ts
├── libs/
│   └── @cortex/
│       ├── ui/src/                   (shadcn components, compositions, stories)
│       ├── styles/                   (globals.css, tokens.css, tailwind preset)
│       ├── api/src/                  (apiClient, error mapping)
│       ├── types/src/                (shared TS types)
│       └── utils/src/                (cn, formatters, validators)
├── docs/
├── scripts/
│   └── copy-pdf-assets.mjs
├── .ladle/
│   └── config.mjs
├── package.json
├── tsconfig.json                     (root, shared paths)
├── tailwind.config.ts                (single, root)
├── postcss.config.mjs
├── .eslintrc.cjs
├── .prettierrc
└── vitest.config.ts
```

---

## 2. Root `package.json`

```json
{
  "name": "cortex-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "msw-init": "msw init app/idp/public/ --save",
    "pdf-assets": "node ./scripts/copy-pdf-assets.mjs",
    "dev": "npm run pdf-assets && next dev app/idp",
    "build": "npm run pdf-assets && next build app/idp",
    "start": "next start app/idp",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint \"{app,libs}/**/*.{ts,tsx}\"",
    "format": "prettier --write \"{app,libs,docs,scripts}/**/*.{ts,tsx,md,json,css}\"",
    "ladle": "ladle serve",
    "ladle:build": "ladle build"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@hookform/resolvers": "^3.9.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-slot": "^1.2.4",
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-query-devtools": "^5.59.0",
    "@tanstack/react-table": "^8.20.5",
    "@tanstack/react-virtual": "^3.13.12",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "docx-preview": "^0.3.7",
    "framer-motion": "^11.11.0",
    "lucide-react": "^0.454.0",
    "next": "^15.4.6",
    "next-auth": "5.0.0-beta.25",
    "pdfjs-dist": "5.4.296",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "react-pdf": "^10.2.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^3.5.0",
    "xlsx": "^0.18.5",
    "zod": "^3.23.8",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@ladle/react": "^4.1.2",
    "@testing-library/jest-dom": "^6.7.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.15.29",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@typescript-eslint/eslint-plugin": "^8.11.0",
    "@typescript-eslint/parser": "^8.11.0",
    "autoprefixer": "^10.5.0",
    "eslint": "^8.57.1",
    "eslint-config-next": "^15.4.6",
    "eslint-plugin-tailwindcss": "^3.17.5",
    "jsdom": "^26.1.0",
    "msw": "^2.6.0",
    "postcss": "^8.5.10",
    "prettier": "^3.3.3",
    "prettier-plugin-organize-imports": "^4.1.0",
    "prettier-plugin-tailwindcss": "^0.6.8",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  },
  "msw": {
    "workerDirectory": ["app/idp/public"]
  }
}
```

---

## 3. Root `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["dom", "dom.iterable", "es2023"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@cortex/ui": ["libs/@cortex/ui/src/index.ts"],
      "@cortex/ui/*": ["libs/@cortex/ui/src/*"],
      "@cortex/styles": ["libs/@cortex/styles/index.ts"],
      "@cortex/styles/*": ["libs/@cortex/styles/*"],
      "@cortex/api":    ["libs/@cortex/api/src/index.ts"],
      "@cortex/api/*":  ["libs/@cortex/api/src/*"],
      "@cortex/types":  ["libs/@cortex/types/src/index.ts"],
      "@cortex/types/*":["libs/@cortex/types/src/*"],
      "@cortex/utils":  ["libs/@cortex/utils/src/index.ts"],
      "@cortex/utils/*":["libs/@cortex/utils/src/*"],
      "@/*": ["app/idp/*"]
    },
    "types": ["node", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": [
    "app/**/*.ts",
    "app/**/*.tsx",
    "libs/**/*.ts",
    "libs/**/*.tsx",
    "app/idp/.next/types/**/*.ts",
    "app/idp/next-env.d.ts"
  ],
  "exclude": ["node_modules", "**/dist", "**/.next", "**/.next-dev"]
}
```

---

## 4. `/app/idp/tsconfig.json`

Inherits paths from root (relative `baseUrl` from root still resolves — Next reads the root config via `extends`).

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next-dev/types/**/*.ts"
  ],
  "exclude": ["node_modules", ".next", ".next-dev"]
}
```

---

## 5. `/app/idp/next.config.ts`

```ts
import path from "node:path"
import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"
const repoRoot = path.resolve(__dirname, "..", "..")

const nextConfig: NextConfig = {
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
    // pdfjs-dist ships .mjs worker; don't let webpack try to parse it.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
}

export default nextConfig
```

Consumers load the worker from `/pdfjs/pdf.worker.min.mjs` (copied by `scripts/copy-pdf-assets.mjs` into `app/idp/public/pdfjs/`).

---

## 6. Tailwind — single config at root

Decision: **one `tailwind.config.ts` at repo root**. Apps + libs share tokens, dark mode class, plugins. Per-app Tailwind would force duplicated presets and break Ladle scanning libs.

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./libs/**/*.{ts,tsx,mdx}",
    "./.ladle/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
}

export default config
```

`postcss.config.mjs`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

---

## 7. `/libs/@cortex/styles/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Defaults = shadcn zinc. R3 overrides with real tokens via @cortex/styles/tokens.css. */
  :root {
    --background: 0 0% 100%; --foreground: 240 10% 3.9%;
    --card: 0 0% 100%; --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%; --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%; --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%; --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%; --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%; --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%; --input: 240 5.9% 90%; --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%; --foreground: 0 0% 98%;
    --card: 240 10% 3.9%; --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%; --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%; --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%; --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%; --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%; --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%; --input: 240 3.7% 15.9%; --ring: 240 4.9% 83.9%;
  }

  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}
```

Imported once in `app/idp/app/layout.tsx`:
```ts
import "@cortex/styles/globals.css"
```

---

## 8. shadcn `components.json` (root)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "libs/@cortex/styles/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@cortex/ui",
    "utils": "@cortex/utils",
    "ui": "@cortex/ui/components",
    "lib": "@cortex/utils",
    "hooks": "@cortex/ui/hooks"
  }
}
```

`npx shadcn@latest add button` now writes to `libs/@cortex/ui/src/components/ui/button.tsx`.

---

## 9. MSW bootstrap (dev-only)

Worker file generated by `npm run msw-init` into `app/idp/public/mockServiceWorker.js`.

`app/idp/mocks/handlers.ts`:
```ts
import { http, HttpResponse } from "msw"

export const handlers = [
  http.get("/api/packages", () => HttpResponse.json({ items: [] })),
]
```

`app/idp/mocks/browser.ts`:
```ts
"use client"
import { setupWorker } from "msw/browser"
import { handlers } from "./handlers"

export const worker = setupWorker(...handlers)
```

`app/idp/mocks/msw-provider.tsx`:
```tsx
"use client"
import { useEffect, useState } from "react"

const ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled"

export function MswProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!ENABLED)
  useEffect(() => {
    if (!ENABLED) return
    import("./browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass" }).then(() => setReady(true)),
    )
  }, [])
  return ready ? <>{children}</> : null
}
```

Wrap in root layout **above** `QueryClientProvider`. `.env.local`: `NEXT_PUBLIC_API_MOCKING=enabled`.

---

## 10. Ladle config + scripts

Stories live next to components: `libs/@cortex/ui/src/**/*.stories.tsx`.

`.ladle/config.mjs`:
```js
export default { stories: "libs/@cortex/ui/src/**/*.stories.{ts,tsx}", viteConfig: ".ladle/vite.config.mjs", port: 61000 }
```

`.ladle/vite.config.mjs` — mirror `@cortex/*` aliases so Vite resolves them:
```js
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
      "@cortex/api":   a("libs/@cortex/api/src"),
    },
  },
})
```

`.ladle/components.tsx`:
```tsx
import "../libs/@cortex/styles/globals.css"
export const Provider = ({ children }: { children: React.ReactNode }) => <>{children}</>
```

Run: `npm run ladle`.

---

## 11. ESLint + Prettier

`.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2023, sourceType: "module", project: "./tsconfig.json" },
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended", "plugin:tailwindcss/recommended"],
  settings: {
    next: { rootDir: "app/idp" },
    tailwindcss: { config: "tailwind.config.ts", callees: ["cn", "clsx"] },
  },
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "warn",
  },
  ignorePatterns: ["node_modules", ".next", ".next-dev", "dist", "app/idp/public/pdfjs"],
}
```

`.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
  "tailwindConfig": "./tailwind.config.ts",
  "tailwindFunctions": ["cn", "clsx"]
}
```

---

## 12. `scripts/copy-pdf-assets.mjs` (adapted)

```js
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const pdfDistDir = path.join(repoRoot, "node_modules", "pdfjs-dist")
const publicPdfDir = path.join(repoRoot, "app", "idp", "public", "pdfjs")

await fs.mkdir(publicPdfDir, { recursive: true })
await fs.cp(
  path.join(pdfDistDir, "build", "pdf.worker.min.mjs"),
  path.join(publicPdfDir, "pdf.worker.min.mjs"),
  { force: true },
)
await fs.cp(path.join(pdfDistDir, "cmaps"), path.join(publicPdfDir, "cmaps"), {
  force: true,
  recursive: true,
})
await fs.cp(
  path.join(pdfDistDir, "standard_fonts"),
  path.join(publicPdfDir, "standard_fonts"),
  { force: true, recursive: true },
)
```

In react-pdf setup:
```ts
import { pdfjs } from "react-pdf"
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
```

---

## 13. npm scripts (recap)

Already in §2 `package.json`. Key ones: `dev`, `build`, `typecheck`, `test`, `lint`, `format`, `ladle`, `msw-init`, `pdf-assets`. `dev`/`build` both run `pdf-assets` first.

---

## 14. Gotchas

- **Local libs without workspaces**: Next doesn't auto-compile TS outside its `dir`. Must list every `@cortex/*` in `transpilePackages` and rely on `tsconfig.paths` for resolution. Forgetting a new lib there = `Module not found` at runtime, not build.
- **`outputFileTracingRoot`**: standalone Docker build will miss `libs/@cortex/*` files unless this points at repo root. Without it, `.next/standalone` has a broken app.
- **Tailwind scanning libs**: content globs must include `./libs/**/*.{ts,tsx}` or classes used only inside `@cortex/ui` get purged. Ladle has the same trap — one config at root avoids drift.
- **pdfjs worker path**: worker is fetched from `/pdfjs/pdf.worker.min.mjs` at runtime — copy script must run **before** `next dev`/`build`, and the public dir is `app/idp/public`, not repo root.
- **MSW boot order**: `worker.start()` is async; rendering any component that triggers a fetch before it resolves will hit the network. `MswProvider` must gate children until ready, and sit **above** `QueryClientProvider` in the tree.
- **Path alias in tests**: Vitest needs matching aliases. Either reuse `tsconfig` via `vite-tsconfig-paths`, or mirror them in `vitest.config.ts`.
