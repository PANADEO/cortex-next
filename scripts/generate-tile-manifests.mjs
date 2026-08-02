// Generuje packages/@cortex/db/scripts/tile-manifests.generated.json z barrela
// app/idp/lib/tile-manifests.ts (ALL_TILE_MANIFESTS).
//
// DLACZEGO TEN SKRYPT ISTNIEJE (PROJECT/cortex-frontend-hub-db-driven-projekt.md
// D10-rewizja c): krok `migrate` (packages/@cortex/db/scripts/*.mjs) startuje z
// obrazu `runner`, który nie ma ani toolchainu TS, ani plików manifest.ts spod
// app/idp/app/(main)/** — nie da się ich tam po prostu zaimportować. Ten skrypt
// więc NIE jedzie do obrazu runner: uruchamia się WYŁĄCZNIE w etapie `builder`
// Dockerfile (który ma pełny toolchain, bo i tak robi `next build`), tuż po
// `pnpm run build`, i zapisuje gotowy JSON, który potem jedzie razem ze
// skryptami `.mjs` (`COPY --from=builder .../scripts`).
//
// Bundluje przez esbuild (już w repo — transitywna zależność @ladle/react,
// tu dopisana jako jawny devDependency zamiast polegać na tym po cichu,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md D10-rewizja c ostrzega
// dokładnie przed tą klasą niesprawdzonego założenia). Manifesty i tile-sdk
// importują się wyłącznie przez alias `@cortex/tile-sdk`/`@/*` z tsconfig —
// esbuild honoruje `paths` z tsconfig.json automatycznie przy bundlowaniu.

import { build } from "esbuild"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const entryPoint = path.join(repoRoot, "app", "idp", "lib", "tile-manifests.ts")
const outFile = path.join(repoRoot, "generated-tile-manifests.tmp.mjs")
const targetFile = path.join(
  repoRoot,
  "packages",
  "@cortex",
  "db",
  "scripts",
  "tile-manifests.generated.json",
)

async function main() {
  await build({
    entryPoints: [entryPoint],
    outfile: outFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    // Repo tsconfig.json (baseUrl "." + paths) rozwiązuje @cortex/tile-sdk i
    // @/* — bez tego esbuild nie wie, że te specyfikatory to lokalne pliki.
    tsconfig: path.join(repoRoot, "tsconfig.json"),
    logLevel: "warning",
  })

  const moduleUrl = `${new URL("file://")}${outFile}`
  const { ALL_TILE_MANIFESTS } = await import(moduleUrl)

  if (!Array.isArray(ALL_TILE_MANIFESTS) || ALL_TILE_MANIFESTS.length === 0) {
    throw new Error(
      "[generate-tile-manifests] ALL_TILE_MANIFESTS jest puste albo nie jest tablicą — sprawdź app/idp/lib/tile-manifests.ts.",
    )
  }

  const codes = new Set()
  for (const manifest of ALL_TILE_MANIFESTS) {
    if (codes.has(manifest.entitlementCode)) {
      throw new Error(
        `[generate-tile-manifests] Zduplikowany entitlementCode w manifestach: ${manifest.entitlementCode}`,
      )
    }
    codes.add(manifest.entitlementCode)
  }

  await fs.writeFile(targetFile, `${JSON.stringify(ALL_TILE_MANIFESTS, null, 2)}\n`)
  console.log(
    `[generate-tile-manifests] zapisano ${ALL_TILE_MANIFESTS.length} manifestów do ${path.relative(repoRoot, targetFile)}`,
  )
}

try {
  await main()
} catch (error) {
  console.error("[generate-tile-manifests] błąd:", error)
  process.exitCode = 1
} finally {
  await fs.rm(outFile, { force: true })
}
