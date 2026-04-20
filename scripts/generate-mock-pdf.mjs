// Generates a minimal 2-page PDF for MSW source-file mock.
// Raw hand-built PDF with computed xref offsets. Fits in ~1.5 KB.
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const outDir = path.join(repoRoot, "app", "idp", "public", "mock-assets")
const outPath = path.join(outDir, "sample-invoice.pdf")

function streamBytes(content) {
  return Buffer.from(content, "latin1")
}

function buildObj(id, body) {
  return Buffer.concat([Buffer.from(`${id} 0 obj\n`), body, Buffer.from("\nendobj\n")])
}

function pageStream(text) {
  const content =
    `BT\n/F1 22 Tf\n72 740 Td\n(${text}) Tj\n` +
    `0 -40 Td\n/F1 12 Tf\n(Electronic components — CN 8541) Tj\n` +
    `0 -22 Td\n(Qty 250  Net 18.5 kg  Value EUR 4820.00) Tj\n` +
    `0 -40 Td\n(Steel fittings — CN 7307) Tj\n` +
    `0 -22 Td\n(Qty 85   Net 142.3 kg Value EUR 2910.50) Tj\n` +
    `0 -40 Td\n(Plastic housings — CN 3926) Tj\n` +
    `0 -22 Td\n(Qty 500  Net 43.1 kg  Value EUR 4720.25) Tj\n` +
    `ET\n`
  const stream = streamBytes(content)
  return Buffer.concat([
    Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),
    stream,
    Buffer.from("\nendstream"),
  ])
}

const objects = []

objects.push(streamBytes("<< /Type /Catalog /Pages 2 0 R >>"))
objects.push(streamBytes("<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>"))
objects.push(
  streamBytes(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
  ),
)
objects.push(
  streamBytes(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
  ),
)
objects.push(streamBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"))
objects.push(pageStream("Mock Invoice — page 1"))
objects.push(pageStream("Mock Invoice — page 2"))

const header = Buffer.from("%PDF-1.4\n%\xc3\xa4\xc3\xa3\xc3\xaf\xc3\xb3\n", "binary")
const offsets = []
let cursor = header.length
const bodyParts = []
objects.forEach((body, idx) => {
  offsets.push(cursor)
  const wrapped = buildObj(idx + 1, body)
  bodyParts.push(wrapped)
  cursor += wrapped.length
})

const body = Buffer.concat(bodyParts)
const xrefStart = cursor
const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "]
for (const off of offsets) {
  xrefLines.push(String(off).padStart(10, "0") + " 00000 n ")
}
const trailer =
  `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

const pdf = Buffer.concat([
  header,
  body,
  Buffer.from(xrefLines.join("\n") + "\n"),
  Buffer.from(trailer),
])

await fs.mkdir(outDir, { recursive: true })
await fs.writeFile(outPath, pdf)
console.log(`Wrote ${outPath} (${pdf.length} bytes)`)
