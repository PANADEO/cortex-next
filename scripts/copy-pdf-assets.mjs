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
