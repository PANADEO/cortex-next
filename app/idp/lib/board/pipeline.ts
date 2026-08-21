import type {
  DirtyPackageReadModel,
  PackageReadModel,
  ProcessingState,
  VerificationState,
} from "@cortex/types"

export type BoardStage = "intake" | "classified" | "processing" | "ready" | "verifying" | "done"

export interface BoardColumnMeta {
  id: BoardStage
  accent: string
  headerBg: string
  headerText: string
  countBg: string
}

export const BOARD_COLUMNS: readonly BoardColumnMeta[] = [
  {
    id: "processing",
    accent: "before:bg-indigo-500",
    headerBg: "bg-indigo-50 dark:bg-indigo-950/40",
    headerText: "text-indigo-800 dark:text-indigo-200",
    countBg: "bg-indigo-500/20 text-indigo-900 dark:text-indigo-100",
  },
  {
    id: "ready",
    accent: "before:bg-emerald-500",
    headerBg: "bg-emerald-50 dark:bg-emerald-950/40",
    headerText: "text-emerald-800 dark:text-emerald-200",
    countBg: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100",
  },
  {
    id: "verifying",
    accent: "before:bg-violet-500",
    headerBg: "bg-violet-50 dark:bg-violet-950/40",
    headerText: "text-violet-800 dark:text-violet-200",
    countBg: "bg-violet-500/20 text-violet-900 dark:text-violet-100",
  },
  {
    id: "done",
    accent: "before:bg-teal-600",
    headerBg: "bg-teal-50 dark:bg-teal-950/40",
    headerText: "text-teal-800 dark:text-teal-200",
    countBg: "bg-teal-600/20 text-teal-900 dark:text-teal-100",
  },
] as const

export type BoardCardKind = "dirty" | "clean"

export interface DirtyBoardCard {
  kind: "dirty"
  id: string
  stage: BoardStage
  title: string
  badgeId: string
  createdDate: string
  customer: string | null
  docCount: number
  needsReviewCount: number
  href: string
  searchText: string
  source: DirtyPackageReadModel
}

export interface CleanBoardCard {
  kind: "clean"
  id: string
  stage: BoardStage
  title: string
  badgeId: string
  createdDate: string
  fileName: string | null
  assignee: string | null
  processingState: ProcessingState
  verificationState: VerificationState
  hasError: boolean
  href: string
  searchText: string
  source: PackageReadModel
}

export type BoardCard = DirtyBoardCard | CleanBoardCard

function dirtyStage(pkg: DirtyPackageReadModel): BoardStage | null {
  switch (pkg.status) {
    case "needs_classification":
    case "classifying":
      return "intake"
    case "classified":
      return "classified"
    case "promoted":
    case "archived":
      return "done"
    default:
      return null
  }
}

function cleanStage(pkg: PackageReadModel): BoardStage {
  if (pkg.processing_state !== "ready") return "processing"
  if (pkg.verification_state === "in_progress") return "verifying"
  if (pkg.verification_state === "completed") return "done"
  return "ready"
}

function shortId(id: string): string {
  const cleaned = id.replace(/^pkg-|^dirty-/, "").replace(/^0+/, "")
  return (cleaned || id).toUpperCase()
}

/**
 * SIANO DLA WYSZUKIWARKI, nie napis dla użytkownika. Podpis karty składa się
 * dopiero w `kanban-card.tsx`, bo tylko tam jest `t()`; tutaj zostają wyłącznie
 * dane, po których filtruje `use-pipeline-board`. Człony policzalne („3 docs”)
 * świadomie wypadły — nikt nie szuka paczki po liczbie dokumentów, a po
 * przetłumaczeniu i tak nie zgadzałyby się z wpisanym zapytaniem.
 */
function joinSearchText(parts: readonly (string | null)[]): string {
  return parts.filter(Boolean).join(" ")
}

export function toDirtyCard(pkg: DirtyPackageReadModel): DirtyBoardCard | null {
  const stage = dirtyStage(pkg)
  if (!stage) return null
  return {
    kind: "dirty",
    id: pkg.id,
    stage,
    title: pkg.name,
    badgeId: `DIRTY-${shortId(pkg.id)}`,
    createdDate: pkg.created_date,
    customer: pkg.customer_tag,
    docCount: pkg.document_count,
    needsReviewCount: pkg.needs_review_count,
    href: `/idp/classification/${pkg.id}`,
    searchText: joinSearchText([pkg.customer_tag]),
    source: pkg,
  }
}

export function toCleanCard(pkg: PackageReadModel): CleanBoardCard {
  const stage = cleanStage(pkg)
  const hasError =
    pkg.processing_state === "imported_with_error" || pkg.processing_state === "analysis_failed"
  const title = pkg.package_name ?? pkg.file_name
  // Nazwa pliku trafia do podpisu tylko wtedy, gdy tytułem jest nazwa paczki —
  // inaczej karta powtarzałaby to samo dwa razy.
  const fileName = pkg.package_name ? pkg.file_name : null
  return {
    kind: "clean",
    id: pkg.id,
    stage,
    title,
    badgeId: `PKG-${shortId(pkg.id)}`,
    createdDate: pkg.created_date,
    fileName,
    assignee: pkg.assignee,
    processingState: pkg.processing_state,
    verificationState: pkg.verification_state,
    hasError,
    href: `/idp/packages/${pkg.id}`,
    searchText: joinSearchText([pkg.file_name, pkg.assignee]),
    source: pkg,
  }
}

export type BoardColumns = Record<BoardStage, BoardCard[]>

export function emptyColumns(): BoardColumns {
  return {
    intake: [],
    classified: [],
    processing: [],
    ready: [],
    verifying: [],
    done: [],
  }
}

export function groupByStage(
  dirty: readonly DirtyPackageReadModel[],
  clean: readonly PackageReadModel[],
): BoardColumns {
  const columns = emptyColumns()
  for (const pkg of dirty) {
    const card = toDirtyCard(pkg)
    if (card) columns[card.stage].push(card)
  }
  for (const pkg of clean) {
    const card = toCleanCard(pkg)
    columns[card.stage].push(card)
  }
  for (const stage of Object.keys(columns) as BoardStage[]) {
    columns[stage].sort((a, b) => (a.createdDate < b.createdDate ? 1 : -1))
  }
  return columns
}
