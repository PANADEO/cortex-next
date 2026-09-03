"use client"
import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import { splitFolder } from "@cortex/desk-core/folder"
import { produced, unbackedPromises } from "@cortex/desk-core/promises"
import type { AuditEntry, FileMeta, Policy } from "@cortex/desk-core/types"
import * as Dialog from "@radix-ui/react-dialog"
import * as Menu from "@radix-ui/react-dropdown-menu"
import {
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  Info,
  LoaderCircle,
  MoreHorizontal,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  Square,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { reasonText, zl } from "../lib"
import { api, t } from "../routes"
import { ActivityTrail } from "./activity-trail"
import { Artifacts } from "./artifacts"
import { AttachmentList, type Attachment } from "./attachments"
import { fileIcon } from "./file-row"
import { Icon } from "./icon"
import { CapabilityLock } from "./lock"
import { Markdown } from "./markdown"
import { PanelHandle, WIDTH_DEFAULT, clamp } from "./resize-handle"
import { ResultPanel } from "./result-panel"
import { ShareMenu, type CaseShare } from "./share-menu"
import { TaskField } from "./task-field"
import { useToast } from "./toast"
import { UnbackedPromises } from "./unbacked-promises"

type Case = {
  id: string
  title: string
  status: string
  reason: string | null
  cost: number
  updatedAt: string
}

const DOT: Record<string, string> = {
  new: "bg-desk-muted-2",
  working: "bg-desk-accent pulse",
  done: "bg-desk-ok",
  stopped: "bg-desk-warn",
  failed: "bg-desk-bad",
}

type Turn = { key: number; command: AuditEntry | null; work: AuditEntry[]; po: AuditEntry[] }

/**
 * Strumień dzielimy na tury — jedno polecenie, jedna praca, jedna odpowiedź.
 * Bez tego przy drugim zleceniu w tej samej sprawie wszystkie kroki wpadają do jednej karty,
 * a przebieg ląduje pod odpowiedzią, choć wydarzył się przed nią.
 */
function perTurn(entries: AuditEntry[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn | null = null
  for (const w of entries) {
    const t = w.event.type
    if (t === "prompt" || !current) {
      current = { key: w.seq, command: t === "prompt" ? w : null, work: [], po: [] }
      turns.push(current)
      if (t === "prompt") continue
    }
    if (t === "tool_start" || t === "tool_end") current.work.push(w)
    else if (t === "assistant" || t === "lifecycle" || t === "blocked") current.po.push(w)
  }
  return turns
}

const fileUrl = (path: string) => `${api("/file")}?path=${encodeURIComponent(path)}`
const isImage = (n: string) => /\.(png|jpe?g|gif|webp)$/i.test(n)

export function CaseView({
  id,
  policyFor: p,
  readOnly,
  people,
  everyone,
  me,
  approver,
  iAmTheApprover,
}: {
  id: string
  policyFor: Policy
  /** Gość ogląda cudzą sprawę: bez pola zlecenia, z rozmową. */
  readOnly?: boolean
  people?: Record<string, string>
  everyone?: { id: string; name: string }[]
  me?: string
  /**
   * „Imię Nazwisko" osoby wydającej zgodę — dla karty odmowy. Wchodzi PROPEM z ekranu
   * serwera, bo kto decyduje, wie baza, a kłódka jest komponentem klienta.
   */
  approver?: string | undefined
  iAmTheApprover?: boolean | undefined
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [caseFile, setCaseFile] = useState<Case | null>(null)
  const [folder, setFolder] = useState<FileMeta[]>([])
  const [text, setText] = useState("")
  const [pending, setPending] = useState<Attachment[]>([])
  const [sending, setSending] = useState<{ text: string; files: string[] } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [since, setSince] = useState<number | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [sheet, setSheet] = useState(false)
  // `null` znaczy „człowiek się nie wypowiedział". Wtedy panel MUSI ZAROBIĆ na swoje
  // miejsce treścią: przy pustej sprawie zabierał ćwierć szerokości ekranu pod zdanie
  // „Tu pojawi się gotowy dokument", także wtedy, gdy nic tam nigdy nie miało trafić.
  const [panelChoice, setPanelChoice] = useState<boolean | null>(null)
  const [width, setWidthState] = useState(WIDTH_DEFAULT)
  const [selected, setSelected] = useState<string | null>(null)
  // Lista wglądów przychodzi tą samą trasą co zdarzenia, ale OBOK nich — model dostaje
  // `events` i nigdy tego.
  const [shares, setShares] = useState<CaseShare[]>([])
  const [owner, setOwner] = useState<string | null>(null)
  const from = useRef(0)
  const stream = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const evidenceFooter = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const translate = useDeskT()
  const locale = useDeskLocale()
  const { toast } = useToast()

  useEffect(() => {
    try {
      const z = localStorage.getItem("desk_panel_wyniku")
      if (z !== null) setPanelChoice(z === "1")
      const s = Number(localStorage.getItem("desk_panel_szerokosc"))
      if (s) setWidthState(clamp(s))
    } catch {
      /* prywatne okno albo zablokowane dane witryny */
    }
  }, [])

  const setPanel = useCallback((v: boolean) => {
    setPanelChoice(v)
    try {
      localStorage.setItem("desk_panel_wyniku", v ? "1" : "0")
    } catch {
      /* nieistotne */
    }
  }, [])

  const setWidth = useCallback((px: number) => {
    setWidthState(px)
    try {
      localStorage.setItem("desk_panel_szerokosc", String(px))
    } catch {
      /* nieistotne */
    }
  }, [])

  // okno zwężone myszką po ustawieniu szerokości nie może zostawić panelu szerszego niż ekran
  useEffect(() => {
    const na = () => setWidthState((s) => clamp(s))
    window.addEventListener("resize", na)
    return () => window.removeEventListener("resize", na)
  }, [])

  const isWorking = caseFile?.status === "working"

  /**
   * Odpytujemy z wykrywaniem zmiany. Wcześniej `setSprawa` i `setTeczka` odpalały się co 700 ms
   * z nową tożsamością obiektu, więc React przerysowywał całe drzewo — i gubił zaznaczenie
   * tekstu, którego człowiek właśnie próbował skopiować.
   */
  useEffect(() => {
    let alive = true
    let handle: ReturnType<typeof setTimeout>
    let interval = 700

    async function tick() {
      try {
        const r = await fetch(`${api("")}/case/${id}/events?from=${from.current}`, {
          cache: "no-store",
        })
        if (!r.ok || !alive) return
        const d = await r.json()

        setCaseFile((s) =>
          s &&
          s.status === d.caseFile.status &&
          s.title === d.caseFile.title &&
          s.cost === d.caseFile.cost &&
          s.reason === d.caseFile.reason
            ? s
            : d.caseFile,
        )
        setFolder((t) => {
          const next: FileMeta[] = d.folder ?? []
          const same =
            t.length === next.length &&
            t.every(
              (x, i) =>
                x.path === next[i]?.path &&
                x.size === next[i]?.size &&
                x.modifiedAt === next[i]?.modifiedAt,
            )
          return same ? t : next
        })

        setOwner((w) => (w === d.owner ? w : (d.owner ?? null)))
        setShares((w) =>
          w.length === (d.shares ?? []).length && w.every((x, i) => x.who === d.shares[i]?.who)
            ? w
            : (d.shares ?? []),
        )

        if (d.events?.length) {
          from.current = d.events[d.events.length - 1].seq
          setEntries((w) => [...w, ...d.events])
          const start = d.events.find(
            (z: AuditEntry) =>
              z.event.type === "lifecycle" && (z.event as { status?: string }).status === "start",
          )
          if (start) setSince(new Date(start.at).getTime())
        }
        // zakończona sprawa nie potrzebuje odpytywania co 700 ms — zwalniamy, dopóki nie ruszy nowa tura
        interval = d.caseFile?.status === "working" ? 700 : 4000
      } finally {
        if (alive) handle = setTimeout(tick, interval)
      }
    }

    tick()
    return () => {
      alive = false
      clearTimeout(handle)
    }
  }, [id])

  // zegar chodzi wyłącznie wtedy, gdy jest co odliczać
  useEffect(() => {
    if (!isWorking && !sending) return
    const z = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(z)
  }, [isWorking, sending])

  useEffect(() => {
    if (atBottom) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries.length, atBottom])

  const onScroll = useCallback(() => {
    const el = stream.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }, [])

  // `zalacznik` to zdarzenie o pochodzeniu pliku, nie wypowiedź — w rozmowie nie ma czego pokazać
  const conversation = useMemo(
    () => entries.filter((w) => w.event.type !== "attachment"),
    [entries],
  )
  const turns = useMemo(() => perTurn(conversation), [conversation])
  // Czynności CAŁEJ sprawy — patrz komentarz przy `turns.map` niżej.
  const caseEvents = useMemo(() => turns.flatMap((turn) => turn.work.map((w) => w.event)), [turns])
  const evidence = useMemo(
    () =>
      evidenceFromEvents(
        entries.map((w) => w.event),
        translate,
      ),
    [entries, translate],
  )
  const seconds = since && isWorking ? Math.max(0, Math.round((now - since) / 1000)) : 0

  // plik wgrany, ale jeszcze niewysłany, też jest Twój — nie może udawać wyniku pracy
  const uploading = useMemo(() => pending.map((z) => z.name), [pending])
  const { results, attachments } = useMemo(
    () =>
      splitFolder(
        folder,
        entries.map((w) => w.event),
        uploading,
      ),
    [folder, entries, uploading],
  )

  // „ostatni" ma znaczyć NAJNOWSZY, nie alfabetycznie ostatni — storage.list sortuje po nazwie
  const inOrder = useMemo(
    () => [...results].sort((a, b) => a.modifiedAt.localeCompare(b.modifiedAt)),
    [results],
  )
  const last = inOrder.at(-1) ?? null
  const active = useMemo(
    () => [...results, ...attachments].find((x) => x.path === selected) ?? last,
    [results, attachments, selected, last],
  )

  // Decyzja człowieka bije wszystko; bez niej rozstrzyga to, czy jest CO CZYTAĆ.
  //
  // Sam załącznik panelu NIE otwiera, i to jest cała treść tego warunku. Wgranie pliku
  // do zlecenia jest wejściem, nie wynikiem — a wcześniej wystarczało, żeby zabrać ćwierć
  // szerokości ekranu w scenariuszu najczęstszym ze wszystkich: „wrzuciła plik, jeszcze
  // nic nie zleciła". Człowiek dostawał wtedy 360 px pod zdanie „Tu pojawi się gotowy
  // dokument" w chwili, w której na pewno jeszcze nic się nie pojawi. Załącznik widać
  // w rozmowie, przy poleceniu, do którego należy; panel czeka na pierwszy dokument,
  // który naprawdę powstał.
  const panel = panelChoice ?? results.length > 0

  const byName = useCallback((n: string) => folder.find((x) => x.name === n) ?? null, [folder])

  /** Jedno wejście do podglądu — z karty artefaktu, z załącznika w rozmowie i z panelu. */
  const showFile = useCallback(
    (file: FileMeta | null) => {
      if (!file) return
      setSelected(file.path)
      if (window.matchMedia("(min-width: 1024px)").matches) setPanel(true)
      else setSheet(true)
    },
    [setPanel],
  )

  // optymistyczna wiadomość znika, gdy dojdzie prawdziwe zdarzenie polecenia
  const commandCount = turns.filter((t) => t.command).length
  const commandsBeforeSend = useRef(0)
  useEffect(() => {
    if (sending && commandCount > commandsBeforeSend.current) setSending(null)
  }, [commandCount, sending])

  async function send() {
    const ready = pending.filter((z) => !z.uploading).map((z) => z.name)
    if ((!text.trim() && !ready.length) || isWorking || pending.some((z) => z.uploading)) return
    const t = text
    commandsBeforeSend.current = commandCount
    setSending({ text: t, files: ready })
    setText("")
    setPending([])
    setAtBottom(true)
    const r = await fetch(`${api("")}/case/${id}/turn`, {
      method: "POST",
      body: JSON.stringify({ text: t, attachments: ready }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setSending(null)
      setText(t)
      toast({ text: d.error ?? translate("case.sendFailed"), tone: "error" })
    }
  }

  /** Załącznik ląduje w teczce TEJ sprawy — „Moje pliki" zostają nietknięte. */
  async function attach(files: FileList | null) {
    if (!files?.length) return
    const fresh: Attachment[] = Array.from(files).map((f) => ({
      name: f.name,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      uploading: true,
    }))
    setPending((z) => [...z, ...fresh])

    const fd = new FormData()
    fd.append("caseId", id)
    Array.from(files).forEach((f) => fd.append("file", f))
    const r = await fetch(api("/files/upload"), { method: "POST", body: fd })
    const d = await r.json().catch(() => ({}))

    if (!r.ok) {
      setPending((z) => z.filter((x) => !fresh.some((n) => n.name === x.name)))
      toast({ text: d.error ?? translate("case.attachFailed"), tone: "error" })
      return
    }
    // serwer mógł nadać inną nazwę, gdy taka już była w teczce
    setPending((z) =>
      z.map((x) => {
        const i = fresh.findIndex((n) => n.name === x.name)
        return i >= 0 ? { ...x, name: d.names?.[i] ?? x.name, uploading: false } : x
      }),
    )
    field.current?.focus()
  }

  const toEvidence = () =>
    evidenceFooter.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  const taken = isWorking || Boolean(sending)

  const retry = (name: string) => {
    setText(translate("case.retry", { name }))
    field.current?.focus()
  }

  const table = (
    <ResultPanel
      results={inOrder}
      attachments={attachments}
      active={active}
      onPick={(x) => setSelected(x.path)}
      evidence={evidence}
      toEvidence={toEvidence}
    />
  )

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-desk-bar shrink-0 items-center gap-2 border-b bg-desk-surface px-3">
          <Link
            href={t("/")}
            aria-label={translate("case.back")}
            className="grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised md:hidden"
          >
            <Icon as={ChevronLeft} px={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="t-h3 truncate">{caseFile?.title ?? translate("case.untitled")}</div>
            <div className="t-meta flex items-center gap-1.5">
              {/* Gość musi wiedzieć, CZYJĄ pracę ogląda — inaczej cudza sprawa
                  wygląda w pasku bocznym jak jego własna. */}
              {readOnly && owner && (
                <span className="shrink-0">
                  {translate("case.guestOf", { name: people?.[owner] ?? owner })} ·
                </span>
              )}
              <span className={`h-1.5 w-1.5 rounded-desk-pill ${DOT[caseFile?.status ?? "new"]}`} />
              {isWorking ? (
                <span className="text-desk-accent">
                  {translate("case.workingFor", {
                    time:
                      seconds < 60
                        ? translate("case.seconds", { count: seconds })
                        : translate("case.minutes", { count: Math.round(seconds / 60) }),
                  })}
                </span>
              ) : (
                <span>{translate(`case.status.${caseFile?.status ?? "new"}`)}</span>
              )}
            </div>
          </div>
          {isWorking && (
            <button
              onClick={() => fetch(`${api("")}/case/${id}/stop`, { method: "POST" })}
              className="t-btn flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-desk-raised"
            >
              <Icon as={Square} px={14} /> {translate("case.stop")}
            </button>
          )}
          <button
            onClick={() => setPanel(!panel)}
            aria-pressed={panel}
            aria-label={
              panel ? translate("case.hideResultPanel") : translate("case.showResultPanel")
            }
            title={panel ? translate("case.hideResult") : translate("case.showResult")}
            className="hidden h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised lg:grid"
          >
            <Icon as={panel ? PanelRightClose : PanelRight} px={16} />
          </button>
          {/* Udostępnienie stoi TUTAJ, przy trzech kropkach — czynność rzadka trafia
            do miejsca dla czynności rzadkich. Do 03.09.2026 był to pas nad polem
            zlecenia, czyli nad rzeczą, której używa się co minutę. */}
          {!readOnly && (
            <ShareMenu
              id={id}
              shares={shares}
              people={people ?? {}}
              everyone={everyone ?? []}
              me={me ?? ""}
              refresh={() => setNow(Date.now())}
            />
          )}
          <Menu.Root>
            <Menu.Trigger
              aria-label={translate("case.more")}
              className="grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised"
            >
              <Icon as={MoreHorizontal} px={16} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={4}
                collisionPadding={12}
                className="z-50 min-w-[240px] rounded-md border bg-desk-surface p-3 shadow-desk-pop"
              >
                <div className="t-section flex items-center gap-2 pb-2">
                  <Icon as={Info} px={14} /> {translate("case.details")}
                </div>
                <dl className="t-meta space-y-1">
                  <div className="flex justify-between gap-4">
                    <dt>{translate("case.actions")}</dt>
                    <dd className="text-desk-ink">
                      {entries.filter((w) => w.event.type === "tool_start").length}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>{translate("case.documents")}</dt>
                    <dd className="text-desk-ink">{results.length}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>{translate("case.cost")}</dt>
                    <dd className="text-desk-ink">{zl(caseFile?.cost ?? 0, locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>{translate("case.permissions")}</dt>
                    <dd className="text-desk-ink">
                      {translate("case.permissionsValue", {
                        department: translate(`case.department.${p.role}`),
                        granted: p.granted.length,
                        total: p.granted.length + p.blocked.length,
                      })}
                    </dd>
                  </div>
                </dl>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>

        <div
          ref={stream}
          onScroll={onScroll}
          className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5"
        >
          <div className="mx-auto flex max-w-desk-stream flex-col gap-4">
            {/*
              Wszystkie czynności SPRAWY, nie jednej tury. „Czy ten plik kiedykolwiek
              wszedł do sprawy" jest pytaniem o sprawę: agent czyta faktury w turze
              pierwszej, a w trzeciej streszcza, co zrobił — i tura streszczająca nie ma
              ANI JEDNEGO zdarzenia, więc liczona osobno oskarżała go o zmyślenie nazw,
              które sama sprawa widziała na oczy dwie tury wcześniej.
            */}
            {turns.map((turn, i) => {
              const lastTurn = i === turns.length - 1 && !sending
              const e = turn.command?.event
              const attached = e?.type === "prompt" ? (e.attachments ?? []) : []
              const turnEvents = turn.work.map((w) => w.event)
              const artifacts = produced(turnEvents)
                .map(byName)
                .filter((x): x is FileMeta => Boolean(x))
              return (
                <div key={turn.key} className="flex flex-col gap-4">
                  {e?.type === "prompt" && (
                    <Command
                      text={e.text}
                      attachments={attached.map((n) => ({
                        name: n,
                        preview: isImage(n) ? fileUrl(`Sprawy/${id}/${n}`) : undefined,
                      }))}
                      open={(n) => showFile(byName(n))}
                    />
                  )}

                  {turn.work.length > 0 && (
                    <div ref={lastTurn ? evidenceFooter : undefined}>
                      <ActivityTrail
                        entries={turn.work}
                        isWorking={isWorking && lastTurn}
                        now={now}
                        approver={approver}
                        iAmTheApprover={iAmTheApprover}
                        /* Plik z dowodu prowadzi DO TEGO PLIKU — tą samą drogą, co karta
                           artefaktu i załącznik w rozmowie. Dowód, w którym nazwa jest
                           tylko napisem, każe człowiekowi szukać jej jeszcze raz ręcznie. */
                        openFile={(n) => showFile(byName(n))}
                        /* Bez tego plakietka „Co weszło" była przyciskiem bez czynności:
                           `byName` szuka wyłącznie w teczce sprawy, a pliki wniesione leżą
                           na biurku. Predykat, nie próba otwarcia — element ma nie WYGLĄDAĆ
                           na klikalny, zamiast milczeć po kliknięciu. */
                        canOpenFile={(n) => byName(n) !== null}
                      />
                    </div>
                  )}

                  {isWorking && lastTurn && turn.work.length === 0 && <Removing />}

                  <Artifacts files={artifacts} open={showFile} />

                  {turn.po.map((w) => {
                    const ev = w.event
                    if (ev.type === "blocked")
                      return (
                        <CapabilityLock
                          key={w.seq}
                          description={ev.description}
                          name={ev.name}
                          capabilityId={ev.capabilityId}
                          approver={approver}
                          iAmTheApprover={iAmTheApprover}
                        />
                      )
                    if (ev.type === "assistant")
                      return (
                        <div key={w.seq} className="flex flex-col gap-3">
                          <div className="max-w-desk-measure">
                            <Markdown text={ev.text} />
                          </div>
                          <UnbackedPromises
                            names={unbackedPromises(ev.text, caseEvents, folder)}
                            request={retry}
                          />
                        </div>
                      )
                    // `exhausted` — model nie zmieścił się w limicie kroków. Do tej pory
                    // wyglądało to na ekranie jak sukces: żadnej karty, sprawa „gotowa",
                    // a robota skończona w połowie. Karta jest ostrzeżeniem, nie awarią,
                    // i proponuje to samo co awaria: podziel zlecenie i powtórz.
                    if (
                      ev.type === "lifecycle" &&
                      (ev.status === "failed" ||
                        ev.status === "stopped" ||
                        ev.status === "exhausted")
                    )
                      return (
                        <div
                          key={w.seq}
                          className={`rounded-lg border bg-desk-surface px-4 py-3 ${ev.status === "failed" ? "border-desk-bad" : "border-desk-warn"}`}
                        >
                          <div className="t-body-m">
                            {ev.status === "failed"
                              ? translate("case.unfinished")
                              : ev.status === "exhausted"
                                ? translate("case.exhausted")
                                : translate("case.interrupted")}
                          </div>
                          {ev.reason && (
                            <p className="t-meta mt-0.5">{reasonText(translate, ev.reason)}</p>
                          )}
                          {ev.status !== "stopped" && (
                            <button
                              // Przy awarii ŁĄCZA sensowna jest jedna rzecz: to samo zlecenie
                              // jeszcze raz. „Napisz inaczej" kazałoby przepisywać zdanie,
                              // z którym nic nie było nie tak. Wpisujemy je z powrotem w pole
                              // zamiast wysyłać od razu — wysłanie kosztuje i decyduje o nim człowiek.
                              onClick={() => {
                                const again =
                                  ev.kind === "infrastructure" &&
                                  turn.command?.event.type === "prompt"
                                    ? turn.command.event.text
                                    : null
                                if (again) setText(again)
                                field.current?.focus()
                              }}
                              className="t-btn mt-2 flex h-8 items-center gap-1.5 rounded-md border px-2.5 hover:bg-desk-raised"
                            >
                              <Icon as={RotateCcw} px={14} />{" "}
                              {translate(
                                ev.kind === "infrastructure" ? "case.tryAgain" : "case.rephrase",
                              )}
                            </button>
                          )}
                        </div>
                      )
                    return null
                  })}
                </div>
              )
            })}

            {/* zlecenie widać od razu po kliknięciu, zanim serwer zdąży zapisać zdarzenie */}
            {sending && (
              <div className="flex flex-col gap-4">
                <Command
                  text={sending.text}
                  attachments={sending.files.map((n) => ({
                    name: n,
                    preview: isImage(n) ? fileUrl(`Sprawy/${id}/${n}`) : undefined,
                  }))}
                />
                <Removing />
              </div>
            )}

            <div ref={bottom} />
          </div>

          {!atBottom && (
            <button
              onClick={() => {
                setAtBottom(true)
                bottom.current?.scrollIntoView({ behavior: "smooth" })
              }}
              className="t-meta sticky bottom-2 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-desk-pill border bg-desk-surface px-3 shadow-desk-pop hover:text-desk-ink"
            >
              <Icon as={ArrowDown} px={14} /> {translate("case.newSteps")}
            </button>
          )}
        </div>

        {active && (
          <button
            onClick={() => setSheet(true)}
            className="flex h-12 shrink-0 items-center gap-2 border-t bg-desk-surface px-4 text-left lg:hidden"
          >
            <Icon as={fileIcon(active)} px={16} className="shrink-0 text-desk-muted" />
            <span className="t-body-m min-w-0 flex-1 truncate">{active.name}</span>
            <span className="t-meta shrink-0">{translate("case.open")}</span>
            <Icon as={ChevronDown} px={16} className="shrink-0 -rotate-90 text-desk-muted" />
          </button>
        )}

        <div className="shrink-0 border-t bg-desk-surface p-3">
          {/* Pole zlecenia dostaje wyłącznie właściciel: gość ogląda, nie zleca.
              To DOKŁADNIE to samo pole co na biurku — jeden komponent, jedna postać,
              więc osoba, która nauczyła się go raz, nie uczy się go tu drugi raz. */}
          <div className={`mx-auto max-w-desk-stream ${readOnly ? "hidden" : ""}`}>
            <TaskField
              text={text}
              onText={setText}
              hint={taken ? translate("case.busyNote") : translate("case.example")}
              box={field}
              busy={taken}
              files={pending}
              removeFile={(n) => setPending((z) => z.filter((x) => x.name !== n))}
              onFiles={attach}
              onSend={send}
              policyFor={p}
            />
          </div>
        </div>
      </div>

      {panel && (
        <>
          <PanelHandle width={width} set={setWidth} collapse={() => setPanel(false)} />
          <aside
            style={{ width: width }}
            className="hidden shrink-0 border-l bg-desk-surface lg:block"
            aria-label={translate("case.resultPanel")}
          >
            {table}
          </aside>
        </>
      )}

      <Dialog.Root open={sheet} onOpenChange={setSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-desk-ink/25 lg:hidden" />
          <Dialog.Content className="sheet fixed inset-x-0 bottom-0 z-50 h-[88vh] overflow-hidden rounded-t-xl border-t bg-desk-surface lg:hidden">
            <div className="flex h-11 items-center justify-between border-b px-3">
              <Dialog.Title className="t-h3">{translate("case.result")}</Dialog.Title>
              <Dialog.Close
                aria-label={translate("common.close")}
                className="grid h-8 w-8 place-items-center rounded-sm text-desk-muted hover:bg-desk-raised"
              >
                <Icon as={X} px={16} />
              </Dialog.Close>
            </div>
            <div className="h-[calc(88vh-44px)]">{table}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

/** Polecenie człowieka: bąbel po prawej, o szerokości treści, z zaznaczalnym tekstem. */
function Command({
  text,
  attachments,
  open,
}: {
  text: string
  attachments: Attachment[]
  open?: (n: string) => void
}) {
  return (
    <div className="flex flex-col items-end gap-2 self-end">
      <AttachmentList files={attachments} open={open} className="justify-end" />
      {text && (
        <div className="t-body max-w-[min(560px,85%)] select-text whitespace-pre-wrap rounded-xl rounded-br-sm bg-desk-accent-soft px-3.5 py-2.5 text-desk-accent-soft-ink">
          {text}
        </div>
      )}
    </div>
  )
}

/** Luka między kliknięciem a pierwszym krokiem to 1–2 sekundy ciszy — tu jest jej wypełnienie. */
function Removing() {
  const translate = useDeskT()
  return (
    <div className="t-meta flex items-center gap-2">
      <Icon as={LoaderCircle} px={14} className="spin text-desk-accent" />
      <span className="pulse">{translate("case.starting")}</span>
    </div>
  )
}
