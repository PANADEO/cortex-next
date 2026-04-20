import type { PackageReadModel, PackageStatus } from "@cortex/types"

const STATUSES: PackageStatus[] = [
  "imported",
  "imported_with_error",
  "analysing",
  "analysis_failed",
  "ready_for_verification",
  "verification",
  "verified",
]

const SAMPLE_FILES = [
  "DHL-2024-shipment-%n.zip",
  "invoice-batch-%n.zip",
  "maersk-%n-export.zip",
  "kuehne-%n-import.zip",
  "fedex-air-%n.zip",
  "customs-EU-%n.zip",
  "transport-ORD%n.zip",
  "kn-container-%n.zip",
]

const ASSIGNEES: (string | null)[] = [
  null,
  "demo@cortex.local",
  "pat@cortex.local",
  "hubert@cortex.local",
  "maja@cortex.local",
]

function pseudoRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(d.getHours() - ((days * 7) % 24))
  return d.toISOString()
}

export function buildPackageFixtures(count = 54): PackageReadModel[] {
  const rand = pseudoRandom(42)
  const items: PackageReadModel[] = []

  for (let i = 0; i < count; i++) {
    const status = STATUSES[Math.floor(rand() * STATUSES.length)]!
    const template = SAMPLE_FILES[Math.floor(rand() * SAMPLE_FILES.length)]!
    const file_name = template.replace("%n", String(1000 + i))
    const assignee =
      status === "verification" || status === "verified"
        ? ASSIGNEES[1 + Math.floor(rand() * 4)]!
        : ASSIGNEES[Math.floor(rand() * ASSIGNEES.length)]!

    items.push({
      id: `pkg-${String(i + 1).padStart(4, "0")}`,
      file_name,
      file_hash: `sha256:${Math.floor(rand() * 1e16).toString(16)}`,
      created_date: daysAgo(Math.floor(rand() * 21)),
      status,
      assignee,
    })
  }

  items.sort((a, b) => (a.created_date < b.created_date ? 1 : -1))
  return items
}
