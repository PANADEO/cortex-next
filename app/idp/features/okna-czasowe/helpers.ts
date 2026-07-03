import { format, parseISO } from "date-fns"
import type { DashboardRow, DashboardSummary, Film, Snapshot } from "./types"

export function formatDate(value: string | null): string {
  if (!value) return "—"
  try {
    return format(parseISO(value), "dd.MM.yyyy")
  } catch {
    return value
  }
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—"
  try {
    return format(parseISO(value), "dd.MM.yyyy HH:mm")
  } catch {
    return value
  }
}

/** Latest snapshot per film, keyed by filmId. Snapshots are appended in scan order. */
export function latestSnapshotsByFilm(snapshots: readonly Snapshot[]): Map<string, Snapshot> {
  const latest = new Map<string, Snapshot>()
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.filmId)
    if (!current || snapshot.scannedAt >= current.scannedAt) {
      latest.set(snapshot.filmId, snapshot)
    }
  }
  return latest
}

export function buildDashboardSummary(
  films: readonly Film[],
  snapshots: readonly Snapshot[],
): DashboardSummary {
  const latest = latestSnapshotsByFilm(snapshots)
  const rows: DashboardRow[] = films.map((film) => ({
    film,
    latestSnapshot: latest.get(film.id) ?? null,
  }))
  const lastScanAt = snapshots.reduce<string | null>(
    (max, s) => (!max || s.scannedAt > max ? s.scannedAt : max),
    null,
  )
  return {
    totalFilms: films.length,
    availableNow: rows.filter((r) => r.latestSnapshot?.available).length,
    lastScanAt,
    rows,
  }
}

const CSV_COLUMNS = [
  "film",
  "year",
  "scannedAt",
  "available",
  "offerType",
  "price",
  "matchedTitle",
  "ambiguous",
] as const

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function snapshotsToCsv(snapshots: readonly Snapshot[], films: readonly Film[]): string {
  const filmById = new Map(films.map((f) => [f.id, f]))
  const lines = [CSV_COLUMNS.join(",")]
  for (const s of snapshots) {
    const film = filmById.get(s.filmId)
    const row = [
      film?.title ?? s.filmId,
      film ? String(film.year) : "",
      s.scannedAt,
      s.available ? "yes" : "no",
      s.offerType ?? "",
      s.price ?? "",
      s.matchedTitle ?? "",
      s.ambiguous ? "yes" : "no",
    ]
    lines.push(row.map((v) => csvEscape(v)).join(","))
  }
  return lines.join("\n")
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
