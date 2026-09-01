import { ChevronRight, FileText } from "lucide-react"
import Link from "next/link"
import { count, when } from "../lib"
import { BASE } from "../routes"
import { Icon } from "./icon"

export type CaseRow = {
  id: string
  title: string
  status: string
  reason: string | null
  updatedAt: string
  documents: number
}

const LABEL: Record<string, string> = {
  new: "new",
  working: "working",
  done: "done",
  stopped: "stopped",
  failed: "nie udało się",
}
const DOT: Record<string, string> = {
  new: "bg-cichy-2",
  working: "bg-akcent puls",
  done: "bg-ok",
  stopped: "bg-warn",
  failed: "bg-bad",
}

export function CaseList({ cases }: { cases: CaseRow[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
      {cases.map((r) => (
        <li key={r.id}>
          <Link
            href={`${BASE}/case/${r.id}`}
            className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-raised/50"
          >
            <span className={`h-2 w-2 shrink-0 rounded-pill ${DOT[r.status] ?? "bg-cichy-2"}`} />
            <span className="min-w-0 flex-1">
              <span className="t-tresc-m block truncate">{r.title}</span>
              <span className="t-meta mt-0.5 flex items-center gap-1.5">
                <span>{LABEL[r.status] ?? r.status}</span>
                <span aria-hidden>·</span>
                <span>{when(r.updatedAt)}</span>
                {r.documents > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <Icon as={FileText} px={12} />
                      {count(r.documents, "dokument", "dokumenty", "dokumentów")}
                    </span>
                  </>
                )}
                {r.reason && <span className="truncate">· {r.reason}</span>}
              </span>
            </span>
            <Icon as={ChevronRight} px={16} className="shrink-0 text-cichy-2" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
