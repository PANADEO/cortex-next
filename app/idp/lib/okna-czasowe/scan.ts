// Orchestrates one scan run: for every tracked film, query JustWatch for Rakuten TV PL
// availability, append a snapshot, and derive `firstSeenAvailable` the first time a film
// flips from not-available to available. The public JustWatch API doesn't expose an arrival
// date, so this transition — caught by comparing against the previous scan — is the only
// source of truth for "od kiedy".
import { randomUUID } from "node:crypto"
import { latestSnapshotsByFilm } from "@/features/okna-czasowe/helpers"
import type { Film, LogEntry, ScanResult, Snapshot } from "@/features/okna-czasowe/types"
import { findRakutenAvailability } from "./justwatch"
import { store } from "./store"

const CONCURRENCY = 3
const THROTTLE_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface FilmScanOutcome {
  snapshot: Snapshot
  error: string | null
}

async function scanFilm(film: Film, scannedAt: string): Promise<FilmScanOutcome> {
  try {
    const match = await findRakutenAvailability(film)
    return {
      snapshot: {
        id: randomUUID(),
        filmId: film.id,
        scannedAt,
        available: match.available,
        offerType: match.offerType,
        price: match.price,
        matchedTitle: match.matchedTitle,
        ambiguous: match.ambiguous,
      },
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      snapshot: {
        id: randomUUID(),
        filmId: film.id,
        scannedAt,
        available: false,
        offerType: null,
        price: null,
        matchedTitle: null,
        ambiguous: false,
      },
      error: `${film.title}: ${message}`,
    }
  }
}

/** Polite bounded-concurrency map: at most `CONCURRENCY` in-flight requests, throttled between calls. */
async function scanFilmsWithConcurrency(films: readonly Film[], scannedAt: string): Promise<FilmScanOutcome[]> {
  const queue = films.map((film, index) => ({ film, index }))
  const results: FilmScanOutcome[] = new Array(films.length)

  async function worker(): Promise<void> {
    for (;;) {
      const next = queue.shift()
      if (!next) return
      results[next.index] = await scanFilm(next.film, scannedAt)
      await sleep(THROTTLE_MS)
    }
  }

  const workerCount = Math.min(CONCURRENCY, films.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export async function runScan(): Promise<ScanResult> {
  const startedAt = new Date().toISOString()
  const films = await store.listFilms()
  const previousSnapshots = await store.listSnapshots()
  const previouslyAvailable = latestSnapshotsByFilm(previousSnapshots)

  const outcomes = await scanFilmsWithConcurrency(films, startedAt)

  let newAvailabilities = 0
  let changesDetected = 0
  const updatedFilms: Film[] = []

  for (const film of films) {
    const outcome = outcomes.find((o) => o.snapshot.filmId === film.id)
    if (!outcome) {
      updatedFilms.push(film)
      continue
    }

    const wasAvailable = previouslyAvailable.get(film.id)?.available ?? false
    if (outcome.snapshot.available !== wasAvailable) changesDetected += 1

    const becameAvailable = outcome.snapshot.available && !wasAvailable
    if (becameAvailable) newAvailabilities += 1

    const firstSeenAvailable =
      film.firstSeenAvailable ?? (outcome.snapshot.available ? startedAt : null)

    updatedFilms.push({ ...film, firstSeenAvailable, updatedAt: startedAt })
  }

  const snapshots = outcomes.map((o) => o.snapshot)
  const errors = outcomes.map((o) => o.error).filter((e): e is string => e !== null)
  const finishedAt = new Date().toISOString()

  const log: LogEntry = {
    id: randomUUID(),
    startedAt,
    finishedAt,
    filmsScanned: films.length,
    newAvailabilities,
    changesDetected,
    errors,
  }

  await store.saveFilms(updatedFilms)
  await store.appendSnapshots(snapshots)
  await store.appendLog(log)

  return { log, snapshots }
}
