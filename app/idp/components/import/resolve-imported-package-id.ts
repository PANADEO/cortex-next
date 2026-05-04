import { endpoints } from "@cortex/api"
import type { PackageReadModel } from "@cortex/types"
import { detectIntakeKind } from "./file-intake"

const TOLERANCE_MS = 5_000
const LOOSE_FILENAME_PATTERN = /^import_\d{8}_\d{6}\.zip$/
const RETRY_DELAYS_MS = [0, 500, 1500, 3000] as const

/**
 * After a successful import, the backend's POST /packages/import response is empty —
 * we need to resolve the new package id via a follow-up GET /packages/get_all lookup.
 *
 * Best-effort: returns undefined on any failure (no toast, no throw). The slot still
 * flips to "done"; the link/button just stays disabled when id can't be resolved.
 *
 * Backend creates packages async (ingest queue), so the first lookup may miss. We
 * retry 3 more times at 500ms, 1500ms, 3000ms (cumulative ~5s). First attempt is
 * immediate to preserve the user-perceived "instant" feel on happy path.
 *
 * `claimedIds` lets the caller exclude ids already resolved by sibling slots so that
 * concurrent same-user multi-slot loose-files imports (e.g. "Import all" with two
 * folder slots) do not all settle on the same most-recent `import_*.zip`. Both
 * branches honour the set; for single-zip imports filename equality already
 * prevents collision but excluding claimed ids is harmless and keeps the logic
 * symmetric.
 */
export async function resolveImportedPackageId(
  slotFiles: readonly File[],
  submittedAt: string,
  claimedIds: ReadonlySet<string> = new Set<string>(),
): Promise<string | undefined> {
  if (slotFiles.length === 0) return undefined

  const submittedAtTolerant = new Date(
    new Date(submittedAt).getTime() - TOLERANCE_MS,
  ).toISOString()

  const kind = detectIntakeKind(slotFiles)
  const targetName = kind === "zip" ? slotFiles[0]!.name : null

  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    try {
      const match = await tryMatch(kind, targetName, submittedAtTolerant, claimedIds)
      if (match) return match.id
    } catch {
      // continue to next attempt
    }
  }
  return undefined
}

async function tryMatch(
  kind: "zip" | "loose",
  targetName: string | null,
  submittedAtTolerant: string,
  claimedIds: ReadonlySet<string>,
): Promise<PackageReadModel | undefined> {
  if (kind === "zip" && targetName) {
    const res = await endpoints.packages.list({
      search: targetName,
      sort_by: "created_date",
      sort_order: "desc",
      limit: 5,
    })
    return res.items.find(
      (p) =>
        p.file_name === targetName &&
        p.created_date >= submittedAtTolerant &&
        !claimedIds.has(p.id),
    )
  }

  const res = await endpoints.packages.list({
    search: "import_",
    sort_by: "created_date",
    sort_order: "desc",
    limit: 10,
  })
  return res.items.find(
    (p) =>
      LOOSE_FILENAME_PATTERN.test(p.file_name) &&
      p.created_date >= submittedAtTolerant &&
      !claimedIds.has(p.id),
  )
}
