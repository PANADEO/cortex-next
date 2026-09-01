"use client"
import type { Policy } from "@cortex/desk-core/types"
import { ArrowUp, ChevronDown, LoaderCircle, Paperclip } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useDeskT } from "../i18n/client"
import { api, t as href } from "../routes"
import { AttachmentList, type Attachment } from "./attachments"
import { CapabilityButton } from "./capability-list"
import { Icon } from "./icon"
import { useToast } from "./toast"

/**
 * Zlecenie startowe przychodzi IDENTYFIKATOREM, a słowa dobiera słownik. Wstawiany
 * tekst jest tym, co człowiek wysyła modelowi — więc idzie w języku, w którym ta
 * osoba pracuje, a nie w tym, w którym napisano zasiew.
 */
type QuickTask = { id: string; title: string; hint: string; text: string }

export function Composer({
  quickTasks,
  policyFor: p,
  hasCases,
}: {
  quickTasks: string[]
  policyFor: Policy
  hasCases: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()
  const [text, setText] = useState("")
  const [taken, setTaken] = useState(false)
  const [attachments, setAttachments] = useState<(Attachment & { file: File })[]>([])
  const [showHints, setShowHints] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const translate = useDeskT()

  const tasks: QuickTask[] = quickTasks.map((id) => ({
    id,
    title: translate(`quickTask.${id}.title`),
    hint: translate(`quickTask.${id}.hint`),
    text: translate(`quickTask.${id}.text`),
  }))

  // ?new=1 z paska bocznego ustawia kursor w polu, zamiast tylko przeładowywać stronę
  useEffect(() => {
    if (!params.get("new")) return
    box.current?.focus()
    box.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    // `t("/")`, a nie `"/"`. Pod powłoką korzeń należy do katalogu aplikacji, więc
    // ten jeden znak przepisywał adres Biurka na cudzy — i wychodziło to dopiero
    // przy odświeżeniu strony, czyli nigdy w czasie klikania.
    window.history.replaceState(null, "", href("/"))
  }, [params])

  /**
   * Załączniki czekają lokalnie do momentu wysłania: dopiero wtedy powstaje sprawa i pliki
   * trafiają do JEJ teczki. „Moje pliki" zostają przestrzenią, do której człowiek kładzie
   * rzeczy świadomie, a nie workiem na wszystko, co przewinęło się przez rozmowę.
   */
  async function start(t: string) {
    if ((!t.trim() && !attachments.length) || taken) return
    setTaken(true)
    try {
      const title = t.trim()
        ? t.slice(0, 60)
        : (attachments[0]?.name ?? translate("composer.untitled"))
      const r = await fetch(api("/case/new"), {
        method: "POST",
        body: JSON.stringify({ title }),
      })
      const { id } = await r.json()

      let names: string[] = []
      if (attachments.length) {
        const fd = new FormData()
        fd.append("caseId", id)
        attachments.forEach((z) => fd.append("file", z.file))
        const w = await fetch(api("/files/upload"), { method: "POST", body: fd })
        const d = await w.json().catch(() => ({}))
        if (!w.ok) throw new Error(d.error ?? translate("composer.attachFailed"))
        names = d.names ?? []
      }

      const turn = await fetch(`${api("")}/case/${id}/turn`, {
        method: "POST",
        body: JSON.stringify({ text: t, attachments: names }),
      })
      if (!turn.ok) {
        // serwer odmawia m.in. przy wyczerpanym limicie dziennym; bez tego tekst przepadał,
        // a człowiek lądował w pustej sprawie i nie wiedział, czy w ogóle kliknął
        const d = await turn.json().catch(() => ({}))
        throw new Error(d.error ?? translate("composer.rejected"))
      }
      router.push(href(`/case/${id}`))
    } catch (e) {
      setTaken(false)
      setText(t)
      box.current?.focus()
      toast({
        text: e instanceof Error ? e.message : translate("composer.startFailed"),
        tone: "error",
      })
    }
  }

  function addFile(files: FileList | null) {
    if (!files?.length) return
    setAttachments((z) => [
      ...z,
      ...Array.from(files).map((f) => ({
        name: f.name,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        file: f,
      })),
    ])
    box.current?.focus()
  }

  // przy pustym biurku podpowiedzi są głównym wejściem, później schodzą do chipów
  const cardMode = hasCases === 0
  const chipMode = hasCases > 0 && hasCases < 5

  return (
    <div>
      <div className="rounded-xl border bg-desk-surface shadow-desk-pop">
        <AttachmentList
          files={attachments}
          remove={(n) => setAttachments((z) => z.filter((x) => x.name !== n))}
          className="px-4 pt-4"
        />
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            if (window.matchMedia("(hover: hover)").matches && !e.shiftKey) {
              e.preventDefault()
              start(text)
            }
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files)
            if (!files.length) return
            e.preventDefault()
            const dt = new DataTransfer()
            files.forEach((f) => dt.items.add(f))
            addFile(dt.files)
          }}
          placeholder={translate("composer.placeholder")}
          rows={3}
          className="t-body w-full resize-none bg-transparent px-4 pt-3.5 outline-none placeholder:text-desk-muted-2"
        />
        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFile(e.target.files)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-desk-muted hover:bg-desk-raised hover:text-desk-ink"
          >
            <Icon as={Paperclip} px={14} /> {translate("case.addFile")}
          </button>
          <CapabilityButton p={p} />
          <div className="flex-1" />
          <button
            onClick={() => start(text)}
            disabled={(!text.trim() && !attachments.length) || taken}
            aria-label={translate("composer.send")}
            className="grid h-9 w-9 place-items-center rounded-md bg-desk-accent text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-35"
          >
            <Icon
              as={taken ? LoaderCircle : ArrowUp}
              px={16}
              className={taken ? "spin" : undefined}
            />
          </button>
        </div>
      </div>

      {cardMode && (
        <>
          <p className="t-meta mb-2.5 mt-5">{translate("composer.startFrom")}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {tasks.map((z) => (
              <button
                key={z.id}
                onClick={() => {
                  setText(z.text)
                  box.current?.focus()
                }}
                className="rounded-lg border bg-desk-surface p-3.5 text-left transition hover:border-desk-line-strong hover:bg-desk-raised/40"
              >
                <div className="t-body-m">{z.title}</div>
                <div className="t-meta mt-0.5">{z.hint}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {chipMode && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tasks.map((z) => (
            <button
              key={z.id}
              onClick={() => {
                setText(z.text)
                box.current?.focus()
              }}
              className="h-8 rounded-desk-pill border bg-desk-surface px-3 text-[13px] text-desk-muted hover:border-desk-line-strong hover:text-desk-ink"
            >
              {z.title}
            </button>
          ))}
        </div>
      )}

      {!cardMode && !chipMode && (
        <div className="mt-3">
          <button
            onClick={() => setShowHints((x) => !x)}
            className="t-meta flex items-center gap-1 hover:text-desk-ink"
          >
            {translate("composer.hints")}
            <Icon as={ChevronDown} px={12} className={showHints ? "rotate-180" : ""} />
          </button>
          {showHints && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tasks.map((z) => (
                <button
                  key={z.id}
                  onClick={() => {
                    setText(z.text)
                    box.current?.focus()
                  }}
                  className="h-8 rounded-desk-pill border bg-desk-surface px-3 text-[13px] text-desk-muted hover:border-desk-line-strong hover:text-desk-ink"
                >
                  {z.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
