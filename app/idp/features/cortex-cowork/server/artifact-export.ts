import { copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { getProject } from "@/lib/cortex-governance/store"
import type { CoworkArtifact } from "../types"
import { artifactFilePath, type SandboxSession } from "./sandbox-store"

export interface ArtifactExportResult {
  /** Server-local absolute path the file was copied to. */
  exportedPath: string
  /** Path shown to the user for copy-paste (UNC / network path), or the server path. */
  displayPath: string
}

/**
 * Copies an artifact into the project's configured export directory (a
 * mounted network share on the server). Browsers cannot open file:// or UNC
 * paths from a click, so the flow is: copy server-side, then hand the user a
 * path string to paste into Explorer/Finder. `displayPath` is the operator's
 * user-facing path (e.g. a UNC share) when configured, else the real path.
 */
export async function exportArtifactToShare(
  session: SandboxSession,
  artifact: CoworkArtifact,
): Promise<ArtifactExportResult> {
  const project = await getProject(session.projectId)
  const exportConfig = project?.artifactExport
  if (!exportConfig?.exportDir) {
    throw new Error("Export folder is not configured for this project")
  }

  const sourcePath = artifactFilePath(session, artifact)
  const destPath = path.join(exportConfig.exportDir, artifact.filename)
  await mkdir(exportConfig.exportDir, { recursive: true })
  await copyFile(sourcePath, destPath)

  // Build the display path from the operator's configured prefix, joining with
  // the share's own separator (a UNC display path uses backslashes).
  const displayPath = exportConfig.displayPath
    ? joinDisplayPath(exportConfig.displayPath, artifact.filename)
    : destPath

  return { exportedPath: destPath, displayPath }
}

function joinDisplayPath(base: string, filename: string): string {
  const usesBackslash = base.includes("\\")
  const separator = usesBackslash ? "\\" : "/"
  const trimmed = base.replace(/[\\/]+$/, "")
  return `${trimmed}${separator}${filename}`
}
