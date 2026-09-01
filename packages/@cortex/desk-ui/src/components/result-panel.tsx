"use client"
import type { Evidence } from "@cortex/desk-core/evidence"
import type { FileMeta } from "@cortex/desk-core/types"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FolderInput,
  Inbox,
  Paperclip,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"
import { size, when } from "../lib"
import { api } from "../routes"
import { fileIcon } from "./file-row"
import { Icon } from "./icon"
import { Preview, fileUrl } from "./preview"
import { useToast } from "./toast"

/**
 * Wynik pracy to najważniejszy obiekt w całej aplikacji — dostaje własne miejsce,
 * z którego nie ucieka razem z przewijaniem historii.
 *
 * Wybór pliku trzyma rodzic, bo do panelu wchodzi się nie tylko stąd: także kliknięciem
 * w kartę artefaktu albo w załącznik w rozmowie. Dwa niezależne stany rozjeżdżały się
 * przy pierwszym takim kliknięciu.
 */
export function ResultPanel({
  results,
  attachments,
  active,
  onPick,
  evidence,
  toEvidence,
}: {
  results: FileMeta[]
  attachments: FileMeta[]
  active: FileMeta | null
  onPick: (p: FileMeta) => void
  evidence: Evidence
  toEvidence?: () => void
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  if (!active) {
    return (
      <div className="flex h-full flex-col">
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <Icon as={Inbox} px={24} className="mx-auto text-desk-muted-2" />
            <p className="t-body mt-2 text-desk-muted">Tu pojawi się gotowy dokument.</p>
          </div>
        </div>
        <FromYou files={attachments} active={null} onPick={onPick} />
      </div>
    )
  }

  const fromHuman = attachments.some((z) => z.path === active.path)

  /**
   * Plakietka mówi wyłącznie to, co widać w zdarzeniach. „Sprawdzony" należy się dopiero wtedy,
   * gdy plik faktycznie odczytano po zapisie; brak sprawdzenia to brak plakietki, nie pochwała.
   * Załącznika człowieka nie oceniamy w ogóle — nikt go tu nie wytworzył.
   */
  const fileStatus: "sprawdzony" | "niesprawdzony" | null = fromHuman
    ? null
    : evidence.unverified.some((n) => n.includes(active.name))
      ? "niesprawdzony"
      : evidence.produced.some((z) => z.startsWith(`odczytano ${active.name} po zapisie`))
        ? "sprawdzony"
        : null

  async function copy() {
    if (!active) return
    try {
      const t = await (await fetch(fileUrl(active), { cache: "no-store" })).text()
      await navigator.clipboard.writeText(t)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ text: "Nie udało się skopiować treści.", tone: "error" })
    }
  }

  async function toMyFiles() {
    if (!active) return
    const r = await fetch(api("/files"), {
      method: "POST",
      body: JSON.stringify({
        action: "copy",
        from: active.path,
        to: `Moje pliki/${active.name}`,
      }),
    })
    const d = await r.json()
    toast(
      r.ok
        ? { text: `Zapisane w Moich plikach: ${d.target?.split("/").pop() ?? active.name}` }
        : { text: "Nie udało się zapisać do Moich plików.", tone: "error" },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <Icon as={fileIcon(active)} px={20} className="mt-0.5 shrink-0 text-desk-muted" />
          <div className="min-w-0 flex-1">
            <div className="t-h3 break-words">{active.name}</div>
            <div className="t-meta">
              {fromHuman ? "Twój załącznik" : "Dokument"} · {size(active.size)} · zapisany{" "}
              {when(active.modifiedAt)}
            </div>
          </div>
        </div>
        {fileStatus && (
          <button
            onClick={toEvidence}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-desk-pill px-2 py-0.5 text-[12px] ${
              fileStatus === "niesprawdzony"
                ? "bg-desk-warn-soft text-desk-warn"
                : "bg-desk-raised text-desk-muted"
            }`}
          >
            <Icon as={fileStatus === "niesprawdzony" ? TriangleAlert : ShieldCheck} px={12} />
            {fileStatus === "niesprawdzony" ? "niesprawdzony" : "sprawdzony po zapisie"}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
        <Action
          icon={Download}
          title="Pobierz"
          na={() => window.open(fileUrl(active, true), "_blank")}
        />
        <Action icon={FolderInput} title="Zapisz do Moich plików" na={toMyFiles} />
        <Action
          icon={copied ? Check : Copy}
          title={copied ? "Skopiowane" : "Kopiuj treść"}
          na={copy}
        />
      </div>

      {results.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5">
          {results.map((p) => (
            <button
              key={p.path}
              onClick={() => onPick(p)}
              className={`shrink-0 rounded-sm px-2 py-1 text-[13px] ${
                p.path === active.path
                  ? "bg-desk-raised font-medium"
                  : "text-desk-muted hover:bg-desk-raised/60"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Preview file={active} />
      </div>

      <FromYou files={attachments} active={active} onPick={onPick} />
    </div>
  )
}

/** To, co wniósł człowiek, nie jest wynikiem pracy agenta i nie może się nim podszywać. */
function FromYou({
  files,
  active,
  onPick,
}: {
  files: FileMeta[]
  active: FileMeta | null
  onPick: (p: FileMeta) => void
}) {
  const [openItems, setOpenItems] = useState(false)
  if (!files.length) return null
  return (
    <div className="shrink-0 border-t">
      <button
        onClick={() => setOpenItems((o) => !o)}
        className="t-meta flex h-9 w-full items-center gap-1.5 px-4 hover:text-desk-ink"
      >
        <Icon as={Paperclip} px={12} />
        Od Ciebie ({files.length})
        <Icon as={ChevronDown} px={12} className={openItems ? "rotate-180" : ""} />
      </button>
      {openItems && (
        <ul className="max-h-40 overflow-y-auto px-2 pb-2">
          {files.map((p) => (
            <li key={p.path}>
              <button
                onClick={() => onPick(p)}
                className={`flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-[13px] hover:bg-desk-raised ${
                  p.path === active?.path ? "bg-desk-raised font-medium" : ""
                }`}
              >
                <Icon as={fileIcon(p)} px={14} className="shrink-0 text-desk-muted" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="t-micro shrink-0">{size(p.size)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Action({ icon, title, na }: { icon: LucideIcon; title: string; na: () => void }) {
  return (
    <button
      onClick={na}
      title={title}
      aria-label={title}
      className="grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
    >
      <Icon as={icon} px={16} />
    </button>
  )
}
