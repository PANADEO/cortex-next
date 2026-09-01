"use client"
import { Brain, Check, Pencil, Plus, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { when } from "../lib"
import { api } from "../routes"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * PAMIĘĆ — ekran, na którym widać CAŁOŚĆ tego, co asystent o kimś wie.
 *
 * Nie próbka i nie podsumowanie: dokładnie te zdania, które idą do promptu każdej tury.
 * Propozycje asystenta stoją na górze i NIE DZIAŁAJĄ, dopóki człowiek ich nie przyjmie —
 * to ten sam kształt, co zatwierdzanie narzędzi obcego serwera MCP, i jedyny powód,
 * dla którego da się o tej pamięci powiedzieć „to jest twoje".
 */

type Memory = {
  id: number
  text: string
  status: "proposed" | "kept"
  sourceCaseId: string | null
  createdAt: string
}

export function MemoryList() {
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()
  const [memories, setMemories] = useState<Memory[]>([])
  const [limit, setLimit] = useState(30)
  const [maxChars, setMaxChars] = useState(400)
  const [editing, setEditing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)

  const refresh = useCallback(async () => {
    const r = await fetch(api("/memory"), { cache: "no-store" })
    const d = await r.json()
    setMemories(d.memories ?? [])
    setLimit(d.limit ?? 30)
    setMaxChars(d.maxChars ?? 400)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function act(body: Record<string, unknown>) {
    const r = await fetch(api("/memory"), { method: "POST", body: JSON.stringify(body) })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast({ text: d.error || translate("memory.failed"), tone: "error" })
      return false
    }
    await refresh()
    return true
  }

  const proposed = memories.filter((m) => m.status === "proposed")
  const kept = memories.filter((m) => m.status === "kept")
  const full = kept.length >= limit

  return (
    <div>
      {proposed.length > 0 && (
        <section className="mb-6">
          <h2 className="t-section mb-1">{translate("memory.proposedTitle")}</h2>
          <p className="t-meta mb-2">{translate("memory.proposedLead")}</p>
          <ul className="divide-y overflow-hidden rounded-lg border border-desk-accent-soft-line bg-desk-accent-soft">
            {proposed.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="t-body">{m.text}</p>
                  <p className="t-micro mt-0.5">{when(m.createdAt, locale)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => act({ action: "accept", id: m.id })}
                    className="t-btn flex h-8 items-center gap-1 rounded-md bg-desk-accent px-3 text-desk-accent-ink hover:bg-desk-accent-hover"
                  >
                    <Icon as={Check} px={14} /> {translate("memory.accept")}
                  </button>
                  <button
                    onClick={() => act({ action: "forget", id: m.id })}
                    aria-label={translate("memory.reject")}
                    className="grid h-8 w-8 place-items-center rounded-md border hover:bg-desk-raised"
                  >
                    <Icon as={X} px={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="t-section">{translate("memory.keptTitle")}</h2>
        <span className="t-micro tabular-nums">
          {translate("memory.count", { count: kept.length, limit })}
        </span>
      </div>

      {kept.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Icon as={Brain} px={24} className="mx-auto text-desk-muted-2" />
          <p className="t-body mt-2">{translate("memory.empty")}</p>
          <p className="t-meta">{translate("memory.emptyHint")}</p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
          {kept.map((m) => (
            <li key={m.id} className="group flex items-start gap-3 px-4 py-3">
              {editing === m.id ? (
                <textarea
                  ref={field}
                  defaultValue={m.text}
                  maxLength={maxChars}
                  autoFocus
                  aria-label={translate("memory.editLabel")}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null)
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      const text = (e.target as HTMLTextAreaElement).value.trim()
                      if (text) void act({ action: "edit", id: m.id, text })
                      setEditing(null)
                    }
                  }}
                  onBlur={() => setEditing(null)}
                  className="t-body min-h-[3rem] w-full resize-y rounded-md border bg-desk-bg px-2 py-1.5"
                />
              ) : (
                <>
                  <p className="t-body min-w-0 flex-1">{m.text}</p>
                  <div className="flex shrink-0 gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    <button
                      onClick={() => setEditing(m.id)}
                      aria-label={translate("memory.edit", { text: m.text })}
                      className="grid h-7 w-7 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
                    >
                      <Icon as={Pencil} px={14} />
                    </button>
                    <button
                      onClick={() => act({ action: "forget", id: m.id })}
                      aria-label={translate("memory.forget", { text: m.text })}
                      className="grid h-7 w-7 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised hover:text-desk-bad"
                    >
                      <Icon as={X} px={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}

          {adding && (
            <li className="px-4 py-3">
              <textarea
                autoFocus
                maxLength={maxChars}
                placeholder={translate("memory.addPlaceholder")}
                aria-label={translate("memory.addLabel")}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") setAdding(false)
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    const text = (e.target as HTMLTextAreaElement).value.trim()
                    if (text) await act({ action: "add", text })
                    setAdding(false)
                  }
                }}
                onBlur={() => setAdding(false)}
                className="t-body min-h-[3rem] w-full resize-y rounded-md border bg-desk-bg px-2 py-1.5"
              />
            </li>
          )}
        </ul>
      )}

      <div className="mt-3">
        <button
          onClick={() => setAdding(true)}
          disabled={full}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md border px-3.5 hover:bg-desk-raised disabled:opacity-50"
        >
          <Icon as={Plus} px={16} /> {translate("memory.add")}
        </button>
        {full && <p className="t-meta mt-1.5">{translate("memory.full", { limit })}</p>}
      </div>

      <p className="t-micro mt-6">{translate("memory.privacy")}</p>
    </div>
  )
}
