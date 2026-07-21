/** A film tracked in the "Okna czasowe" release-window register. */
export interface Film {
  id: string
  title: string
  year: number
  tmdbId?: string
  /** Foreign / localized titles used to match against JustWatch search results. */
  foreignTitles: string[]
  /** First scan date on which the film flipped from unavailable to available on Rakuten TV PL. */
  firstSeenAvailable: string | null
  createdAt: string
  updatedAt: string
}

export interface FilmInput {
  title: string
  year: number
  tmdbId?: string
  foreignTitles: string[]
}

/** Result of matching one film against JustWatch for a single scan run. */
export interface Snapshot {
  id: string
  filmId: string
  scannedAt: string
  available: boolean
  /** JustWatch monetizationType of the cheapest Rakuten offer found (e.g. "RENT", "BUY"). */
  offerType: string | null
  /** Pre-formatted price string as returned by JustWatch (e.g. "9,99 zł"). */
  price: string | null
  /** Title JustWatch matched against — helps spot wrong matches. */
  matchedTitle: string | null
  /** Set when the search returned candidates but none matched title+year confidently. */
  ambiguous: boolean
}

export interface LogEntry {
  id: string
  startedAt: string
  finishedAt: string
  filmsScanned: number
  newAvailabilities: number
  changesDetected: number
  errors: string[]
}

export interface ScanResult {
  log: LogEntry
  snapshots: Snapshot[]
}

/** One row of the dashboard table: a film joined with its latest snapshot. */
export interface DashboardRow {
  film: Film
  latestSnapshot: Snapshot | null
}

export interface DashboardSummary {
  totalFilms: number
  availableNow: number
  lastScanAt: string | null
  rows: DashboardRow[]
}
