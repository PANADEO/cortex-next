"use client"
import { departmentLabel } from "@cortex/desk-core/capability-text"
import { Check, Plus, RotateCcw, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { api } from "../routes"
import { Icon } from "./icon"
import { Loading } from "./loading"
import { useToast } from "./toast"

/** Kiedy asystent czyta procedurę. Wartości takie same jak w bazie — to jest ta sama rzecz. */
type Mode = "index" | "always" | "paths"

type Issue = { edition: number; signedBy: string | null; at: string }

type Item = {
  name: string
  title: string
  description: string
  loading: Mode
  paths: string[]
  scope: string[]
  status: "active" | "withdrawn"
  body: string
  /** Ile znaków ta jedna dokłada do KAŻDEJ tury. Zero wszędzie poza trybem `always`. */
  alwaysChars: number
  edition: number
  signedBy: string | null
  at: string
  editions: Issue[]
}

type Cost = { department: string; chars: number }

type Draft = {
  /** Pusto = nowa procedura. Niepusto = kolejne wydanie tej samej. */
  name: string
  title: string
  description: string
  loading: Mode
  paths: string
  scope: string[]
  body: string
}

const EMPTY: Draft = {
  name: "",
  title: "",
  description: "",
  loading: "index",
  paths: "",
  scope: [],
  body: "",
}

const MODES: Mode[] = ["index", "always", "paths"]

/**
 * PROCEDURY OD STRONY PRZEŁOŻONEGO — bliźniak sekcji narzędzi MCP, i to jest wybór,
 * nie zbieg okoliczności. Oba ekrany odpowiadają na to samo pytanie: co podpisałem,
 * kiedy, i czy mogę to wycofać. Drugi wzorzec na to samo byłby drugim miejscem do
 * pamiętania przy każdej zmianie.
 *
 * ŻARGONU TU NIE MA. W bazie tryb nazywa się `always`, a zasięg `scope`; na ekranie stoi
 * „kiedy asystent to czyta" i „kogo dotyczy". Odbiorcą jest osoba, która tę procedurę
 * NAPISAŁA — zna swoją firmę, nie zna naszych kolumn.
 */
export function ProcedureSupervision() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [cost, setCost] = useState<Cost[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()

  const load = useCallback(async () => {
    const r = await fetch(api("/procedures/supervision"), { cache: "no-store" })
    if (!r.ok) return
    const d = await r.json()
    setItems(d.procedures ?? [])
    setDepartments(d.departments ?? [])
    setCost(d.alwaysCost ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function send(data: Record<string, unknown>, key: string) {
    setBusy(key)
    const r = await fetch(api("/procedures/supervision"), {
      method: "POST",
      body: JSON.stringify(data),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) {
      toast({ text: d.error ?? translate("procedures.failed"), tone: "error" })
      return null
    }
    return d
  }

  /**
   * LICZNIK MA WŁASNE WYJŚCIE NA TRASĘ, z rozmysłu — nie idzie przez `send`.
   *
   * `send` przestawia `busy`, czyli przerysowuje ten komponent. Przerysowanie tworzy NOWĄ
   * funkcję `measure`, ta unieważnia efekt w formularzu, a efekt przy sprzątaniu porzuca
   * odpowiedź, na którą właśnie czekał. Licznik nie pokazywał się wtedy NIGDY, a wyglądało
   * to na wolną sieć — znalazł to dopiero scenariusz e2e. `useCallback` z pustą listą daje
   * jedną tożsamość na całe życie ekranu i pętla znika u źródła.
   */
  const measure = useCallback(async (title: string, body: string): Promise<number | null> => {
    const r = await fetch(api("/procedures/supervision"), {
      method: "POST",
      body: JSON.stringify({ action: "measure", title, body }),
    })
    if (!r.ok) return null
    return (await r.json()).alwaysChars ?? null
  }, [])

  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(iso),
    )

  const signature = (one: { edition: number; signedBy: string | null; at: string }) =>
    one.signedBy
      ? translate("procedures.issued", {
          edition: one.edition,
          who: one.signedBy,
          date: day(one.at),
        })
      : translate("procedures.unsigned", { edition: one.edition, date: day(one.at) })

  const paying = cost.filter((one) => one.chars > 0)

  return (
    <section className="mt-8">
      <h2 className="t-section mb-1">{translate("procedures.manageTitle")}</h2>
      <p className="t-meta mb-3">{translate("procedures.manageLead")}</p>

      {/* JEDYNE MIEJSCE, W KTÓRYM TEN WYDATEK W OGÓLE WIDAĆ. Procedura czytana przy każdym
          poleceniu kosztuje bez przerwy i nie zostawia po sobie żadnego innego śladu —
          ani wiersza w dzienniku, ani pozycji w rachunku. Progu twardego tu NIE MA, bo
          nikt go nie zmierzył; jest liczba, którą człowiek może zobaczyć i sam ocenić. */}
      <div className="mb-3 rounded-lg border bg-desk-surface px-4 py-3">
        <div className="t-body-m">{translate("procedures.costTitle")}</div>
        <p className="t-meta">{translate("procedures.costLead")}</p>
        {paying.length === 0 ? (
          <p className="t-meta mt-1.5">{translate("procedures.costNone")}</p>
        ) : (
          <ul className="mt-1.5 space-y-0.5">
            {paying.map((one) => (
              <li key={one.department} className="t-body flex items-baseline gap-2">
                <span className="min-w-0 flex-1">{departmentLabel(translate, one.department)}</span>
                <span className="t-meta shrink-0 tabular-nums">
                  {translate("procedures.costChars", { count: one.chars })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        {items === null && <Loading rows={3} />}
        {items !== null && items.length === 0 && (
          <p className="t-meta rounded-lg border border-dashed px-4 py-6 text-center">
            {translate("procedures.nothingYet")}
          </p>
        )}
        {(items ?? []).map((p) => (
          <div key={p.name} className="overflow-hidden rounded-lg border bg-desk-surface px-4 py-3">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="t-body-m">
                  {p.title}
                  {p.status === "withdrawn" && (
                    <span className="t-micro ml-2 rounded-desk-pill bg-desk-raised px-1.5">
                      {translate("procedures.stateWithdrawn")}
                    </span>
                  )}
                </div>
                <div className="t-meta">{p.description}</div>
                <div className="t-micro pt-0.5">
                  {translate(`procedures.mode.${p.loading}`)}
                  {" · "}
                  {p.scope.length === 0
                    ? translate("procedures.scopeEveryone")
                    : translate("procedures.scopeSome", {
                        departments: p.scope
                          .map((one) => departmentLabel(translate, one))
                          .join(", "),
                      })}
                  {p.alwaysChars > 0 && (
                    <> · {translate("procedures.costChars", { count: p.alwaysChars })}</>
                  )}
                </div>
                {p.loading === "paths" && p.paths.length > 0 && (
                  <div className="t-micro">
                    {translate("procedures.folders", { folders: p.paths.join(" · ") })}
                  </div>
                )}
                <div className="t-micro">{signature(p)}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() =>
                    setDraft({
                      name: p.name,
                      title: p.title,
                      description: p.description,
                      loading: p.loading,
                      paths: p.paths.join("\n"),
                      scope: p.scope,
                      body: p.body,
                    })
                  }
                  className="t-btn flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-desk-raised"
                >
                  {translate("procedures.newEdition")}
                </button>
                <button
                  onClick={async () => {
                    const back = p.status === "withdrawn"
                    if (
                      await send(
                        { action: back ? "restore" : "withdraw", name: p.name },
                        `s:${p.name}`,
                      )
                    ) {
                      toast({
                        text: back
                          ? translate("procedures.restored", { title: p.title })
                          : translate("procedures.withdrawn", { title: p.title }),
                      })
                      load()
                    }
                  }}
                  disabled={busy === `s:${p.name}`}
                  className="t-btn flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-desk-raised disabled:opacity-50"
                >
                  <Icon as={p.status === "withdrawn" ? RotateCcw : X} px={14} />
                  {p.status === "withdrawn"
                    ? translate("procedures.restore")
                    : translate("procedures.withdraw")}
                </button>
              </div>
            </div>

            <details className="mt-2">
              <summary className="t-micro cursor-pointer">
                {translate("procedures.showBody")}
              </summary>
              <p className="t-body mt-1 whitespace-pre-wrap rounded-md bg-desk-sunken px-3 py-2">
                {p.body}
              </p>
            </details>

            {p.editions.length > 1 && (
              <details className="mt-1">
                <summary className="t-micro cursor-pointer">
                  {translate("procedures.history")}
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {p.editions.map((one) => (
                    <li key={one.edition} className="t-micro">
                      {signature(one)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {draft ? (
        <Editor
          draft={draft}
          departments={departments}
          busy={busy === "publish"}
          change={setDraft}
          cancel={() => setDraft(null)}
          measure={measure}
          save={async () => {
            const d = await send(
              {
                action: "publish",
                name: draft.name,
                title: draft.title,
                description: draft.description,
                loading: draft.loading,
                paths: draft.paths,
                scope: draft.scope,
                body: draft.body,
              },
              "publish",
            )
            if (d) {
              setDraft(null)
              toast({
                text: translate("procedures.published", {
                  title: draft.title,
                  edition: d.edition,
                }),
              })
              load()
            }
          }}
        />
      ) : (
        <button
          onClick={() => setDraft(EMPTY)}
          className="t-btn mt-3 flex h-9 items-center gap-1.5 rounded-md border px-3 hover:bg-desk-raised"
        >
          <Icon as={Plus} px={14} /> {translate("procedures.write")}
        </button>
      )}
    </section>
  )
}

/**
 * FORMULARZ NIE WYSYŁA `SKILL.md`. Wysyła pola, a tekst składa trasa i przepuszcza go
 * przez ten sam `parseSkill`, co plik wgrany ręcznie — patrz komentarz przy `composeSkill`.
 * Tutaj nie ma więc ANI JEDNEJ reguły poprawności poza tą, która wyłącza przycisk, gdy
 * pola są puste; wszystko inne rozstrzyga serwer i mówi o tym zdaniem.
 */
function Editor({
  draft,
  departments,
  busy,
  change,
  cancel,
  save,
  measure,
}: {
  draft: Draft
  departments: string[]
  busy: boolean
  change: (next: Draft) => void
  cancel: () => void
  save: () => Promise<void>
  measure: (title: string, body: string) => Promise<number | null>
}) {
  const translate = useDeskT()
  const [chars, setChars] = useState<number | null>(null)

  // Licznik odpytuje trasę, zamiast liczyć długość tekstu w przeglądarce: doklejany blok
  // ma jeszcze nagłówek z tytułem, a jego kształt należy do `promptBlock`. Wzór powtórzony
  // tutaj zgadzałby się dziś i rozjechał po pierwszej zmianie tamtego nagłówka.
  useEffect(() => {
    if (draft.loading !== "always") {
      setChars(null)
      return
    }
    let alive = true
    const wait = setTimeout(async () => {
      const n = await measure(draft.title, draft.body)
      if (alive) setChars(n)
    }, 400)
    return () => {
      alive = false
      clearTimeout(wait)
    }
  }, [draft.loading, draft.title, draft.body, measure])

  const field =
    "t-body w-full rounded-md border bg-desk-bg px-2.5 outline-none placeholder:text-desk-muted-2"
  const ready =
    draft.title.trim() !== "" && draft.description.trim() !== "" && draft.body.trim() !== ""

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-desk-surface p-4">
      <div className="t-body-m">
        {draft.name === ""
          ? translate("procedures.formNew")
          : translate("procedures.formNext", { title: draft.title })}
      </div>

      <label className="block">
        <span className="t-meta">{translate("procedures.fieldTitle")}</span>
        <input
          value={draft.title}
          onChange={(e) => change({ ...draft, title: e.target.value })}
          placeholder={translate("procedures.hintTitle")}
          className={`${field} mt-0.5 h-9`}
        />
      </label>

      <label className="block">
        <span className="t-meta">{translate("procedures.fieldDescription")}</span>
        <input
          value={draft.description}
          onChange={(e) => change({ ...draft, description: e.target.value })}
          placeholder={translate("procedures.hintDescription")}
          className={`${field} mt-0.5 h-9`}
        />
      </label>

      <div>
        <span className="t-meta">{translate("procedures.fieldMode")}</span>
        <div className="mt-0.5 space-y-1">
          {MODES.map((one) => (
            <label key={one} className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="procedure-mode"
                checked={draft.loading === one}
                onChange={() => change({ ...draft, loading: one })}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0">
                <span className="t-body block">{translate(`procedures.mode.${one}`)}</span>
                <span className="t-micro block">{translate(`procedures.modeWhat.${one}`)}</span>
              </span>
            </label>
          ))}
        </div>
        {draft.loading === "always" && (
          <p className="t-meta mt-1.5 rounded-md bg-desk-warn-soft px-2.5 py-1.5">
            {chars === null
              ? translate("procedures.costCounting")
              : translate("procedures.costDraft", { count: chars })}
          </p>
        )}
      </div>

      {draft.loading === "paths" && (
        <label className="block">
          <span className="t-meta">{translate("procedures.fieldPaths")}</span>
          <textarea
            value={draft.paths}
            onChange={(e) => change({ ...draft, paths: e.target.value })}
            rows={3}
            placeholder={translate("procedures.hintPaths")}
            className={`${field} mt-0.5 resize-none py-2`}
          />
        </label>
      )}

      <div>
        <span className="t-meta">{translate("procedures.fieldScope")}</span>
        <p className="t-micro">{translate("procedures.hintScope")}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {departments.map((one) => (
            <label key={one} className="t-body flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={draft.scope.includes(one)}
                onChange={(e) =>
                  change({
                    ...draft,
                    scope: e.target.checked
                      ? [...draft.scope, one]
                      : draft.scope.filter((x) => x !== one),
                  })
                }
              />
              {departmentLabel(translate, one)}
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="t-meta">{translate("procedures.fieldBody")}</span>
        <textarea
          value={draft.body}
          onChange={(e) => change({ ...draft, body: e.target.value })}
          rows={8}
          placeholder={translate("procedures.hintBody")}
          className={`${field} mt-0.5 resize-y py-2`}
        />
      </label>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !ready}
          className="t-btn flex h-9 items-center gap-1.5 rounded-md bg-desk-accent px-3 text-desk-accent-ink hover:bg-desk-accent-hover disabled:opacity-40"
        >
          <Icon as={Check} px={14} /> {translate("procedures.publish")}
        </button>
        <button onClick={cancel} className="t-btn h-9 rounded-md border px-3 hover:bg-desk-raised">
          {translate("common.cancel")}
        </button>
      </div>
    </div>
  )
}
