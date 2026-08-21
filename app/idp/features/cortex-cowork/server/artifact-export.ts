import { getProject } from "@/lib/cortex-governance/store"
import type { CoworkArtifactExportResult } from "@cortex/types"
import { copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import type { CoworkArtifact } from "../types"
import { artifactFilePath, type SandboxSession } from "./sandbox-store"

/** Expected state (project has no export share), as opposed to an I/O failure. */
export class ExportNotConfiguredError extends Error {
  constructor() {
    super("Export folder is not configured for this project")
  }
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
): Promise<CoworkArtifactExportResult> {
  const project = await getProject(session.projectId)
  const exportConfig = project?.artifactExport
  if (!exportConfig?.exportDir) {
    throw new ExportNotConfiguredError()
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
