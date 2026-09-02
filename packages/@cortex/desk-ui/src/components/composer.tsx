"use client"
import type { Policy } from "@cortex/desk-core/types"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useDeskT } from "../i18n/client"
import { api, t as href } from "../routes"
import type { Attachment } from "./attachments"
import { TaskField } from "./task-field"
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
}: {
  quickTasks: string[]
  policyFor: Policy
}) {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()
  const [text, setText] = useState("")
  const [taken, setTaken] = useState(false)
  const [attachments, setAttachments] = useState<(Attachment & { file: File })[]>([])
  const box = useRef<HTMLTextAreaElement>(null)
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
   * trafiają do JEJ teczki. „Moje pliki” zostają przestrzenią, do której człowiek kładzie
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

  return (
    <div>
      <TaskField
        text={text}
        onText={setText}
        hint={translate("case.example")}
        box={box}
        busy={taken}
        files={attachments}
        removeFile={(n) => setAttachments((z) => z.filter((x) => x.name !== n))}
        onFiles={addFile}
        onSend={() => start(text)}
        policyFor={p}
      />

      {/* Gotowe zlecenia stoją na wierzchu ZAWSZE. Wcześniej schodziły do chipów, a przy
          pełnym biurku chowały się pod „Podpowiedzi” — czyli znikały dokładnie tej osobie,
          która pracuje tu codziennie i której najbardziej opłaca się je znać. */}
      <p className="t-meta mb-2.5 mt-5">{translate("composer.startFrom")}</p>
      <div className="grid gap-2.5 sm:grid-cols-3">
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
    </div>
  )
}
