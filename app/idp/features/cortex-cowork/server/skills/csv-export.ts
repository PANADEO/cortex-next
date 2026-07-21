import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import * as XLSX from "xlsx"
import type { CoworkArtifact } from "../../types"
import type { SandboxSession } from "../sandbox-store"

// Implements the steps described in ../../skills/csv-export/SKILL.md.
function buildDemoRows(prompt: string): (string | number)[][] {
  return [
    ["Metric", "Value", "Unit"],
    ["Sessions this week", 12, "count"],
    ["Skills invoked", 2, "count"],
    ["Prompt length", prompt.trim().length, "chars"],
  ]
}

export async function generateCsvExport(
  session: SandboxSession,
  prompt: string,
): Promise<CoworkArtifact> {
  const sheet = XLSX.utils.aoa_to_sheet(buildDemoRows(prompt))
  const csv = `﻿${XLSX.utils.sheet_to_csv(sheet)}`

  const filename = `cortex-cowork-export-${Date.now()}.csv`
  await writeFile(path.join(session.artifactsDir, filename), csv, "utf8")

  return {
    id: randomUUID(),
    filename,
    mimeType: "text/csv",
    sizeBytes: Buffer.byteLength(csv, "utf8"),
    createdAt: new Date().toISOString(),
    skill: "csv-export",
  }
}
