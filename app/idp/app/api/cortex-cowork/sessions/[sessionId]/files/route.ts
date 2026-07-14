import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  getSandboxSession,
  listInputFiles,
} from "@/features/cortex-cowork/server/sandbox-store"
import { NextResponse } from "next/server"

// Upload of user input files into the session sandbox's input/ directory -
// the staging area the agent reads task materials from (transcripts, data
// files, pasted screenshots). Multipart form, field name "files".

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 10

/**
 * Flattens a client filename to a safe basename: strips any path segments and
 * control characters, keeps unicode word characters (Polish names survive).
 */
function sanitizeFilename(raw: string): string {
  const base = path.basename(raw).replaceAll(/[\u0000-\u001f/\\:]+/g, "").trim()
  return base && base !== "." && base !== ".." ? base : `plik-${Date.now()}`
}

/** First free variant of `filename` in `dir` ("report.pdf" -> "report-2.pdf"). */
async function unusedName(dir: string, filename: string): Promise<string> {
  const ext = path.extname(filename)
  const stem = filename.slice(0, filename.length - ext.length)
  let candidate = filename
  for (let counter = 2; ; counter++) {
    const exists = await stat(path.join(dir, candidate)).then(
      () => true,
      () => false,
    )
    if (!exists) return candidate
    candidate = `${stem}-${counter}${ext}`
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }
  return NextResponse.json({ files: await listInputFiles(session) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }

  const form = await request.formData().catch(() => null)
  const uploads = form?.getAll("files").filter((entry): entry is File => entry instanceof File)
  if (!uploads || uploads.length === 0) {
    return NextResponse.json({ message: 'multipart field "files" is required' }, { status: 400 })
  }
  if (uploads.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { message: `Too many files (max ${MAX_FILES_PER_REQUEST} per upload)` },
      { status: 400 },
    )
  }
  for (const file of uploads) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { message: `"${file.name}" exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit` },
        { status: 413 },
      )
    }
  }

  // Sessions created before the input/ directory existed get it lazily here.
  await mkdir(session.inputDir, { recursive: true })
  for (const file of uploads) {
    const filename = await unusedName(session.inputDir, sanitizeFilename(file.name))
    await writeFile(
      path.join(session.inputDir, filename),
      Buffer.from(await file.arrayBuffer()),
    )
  }

  return NextResponse.json({ files: await listInputFiles(session) }, { status: 201 })
}
