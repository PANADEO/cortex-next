import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import * as XLSX from "xlsx"
import type { CoworkArtifact } from "../../types"
import type { SandboxSession } from "../sandbox-store"

// Implements the steps described in ../../skills/excel-report/SKILL.md. In a
// live Flue integration the model executes those steps itself inside the
// sandbox; here we run the same recipe directly so the download is real.
function buildDemoRows(prompt: string): (string | number)[][] {
  return [
    ["Metric", "Value", "Unit"],
    ["Sessions this week", 12, "count"],
    ["Skills invoked", 2, "count"],
    ["Prompt length", prompt.trim().length, "chars"],
  ]
}

export async function generateExcelReport(
  session: SandboxSession,
  prompt: string,
): Promise<CoworkArtifact> {
  const rows = buildDemoRows(prompt)
  const numericTotal = rows.slice(1).reduce((sum, row) => {
    const value = row[1]
    return sum + (typeof value === "number" ? value : 0)
  }, 0)

  const sheet = XLSX.utils.aoa_to_sheet([...rows, ["Total", numericTotal, ""]])
  sheet["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Cowork Report")
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer

  const filename = `cortex-cowork-report-${Date.now()}.xlsx`
  await writeFile(path.join(session.artifactsDir, filename), buffer)

  return {
    id: randomUUID(),
    filename,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: buffer.byteLength,
    createdAt: new Date().toISOString(),
    skill: "excel-report",
  }
}
