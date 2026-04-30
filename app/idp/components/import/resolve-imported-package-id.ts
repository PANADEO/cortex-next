import { endpoints } from "@cortex/api"
import { detectIntakeKind } from "./file-intake"

const TOLERANCE_MS = 5_000
const LOOSE_FILENAME_PATTERN = /^import_\d{8}_\d{6}\.zip$/

/**
 * After a successful import, the backend's POST /packages/import response is empty —
 * we need to resolve the new package id via a follow-up GET /packages/get_all lookup.
 *
 * Best-effort: returns undefined on any failure (no toast, no throw). The slot still
 * flips to "done"; the link/button just stays disabled when id can't be resolved.
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

  try {
    if (kind === "zip") {
      const targetName = slotFiles[0]!.name
      const res = await endpoints.packages.list({
        search: targetName,
        sort_by: "created_date",
        sort_order: "desc",
        limit: 5,
      })
      const match = res.items.find(
        (p) =>
          p.file_name === targetName &&
          p.created_date >= submittedAtTolerant &&
          !claimedIds.has(p.id),
      )
      return match?.id
    }

    const res = await endpoints.packages.list({
      search: "import_",
      sort_by: "created_date",
      sort_order: "desc",
      limit: 10,
    })
    const match = res.items.find(
      (p) =>
        LOOSE_FILENAME_PATTERN.test(p.file_name) &&
        p.created_date >= submittedAtTolerant &&
        !claimedIds.has(p.id),
    )
    return match?.id
  } catch {
    return undefined
  }
}
