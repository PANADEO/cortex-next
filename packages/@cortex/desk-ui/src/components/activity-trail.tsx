"use client"
import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import {
  describeFailure,
  describeStep,
  pairSteps,
  stepDuration,
  summariseGroup,
  type Step,
} from "@cortex/desk-core/steps"
import type { AuditEntry } from "@cortex/desk-core/types"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  ChevronDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  LoaderCircle,
  Lock,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { Icon } from "./icon"

function fileIcon(name: string): LucideIcon {
  if (/\.(csv|xlsx?|tsv)$/i.test(name)) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return FileImage
  return FileText
}

/** Nazwa pliku jako osobny, rozpoznawalny obiekt — nie fragment zdania. */
function Pill({ name }: { name: string }) {
  return (
    <span className="inline-flex h-5 max-w-[220px] shrink-0 items-center gap-1 rounded-sm bg-desk-raised px-1.5 align-middle">
      <Icon as={fileIcon(name)} px={12} className="shrink-0 text-desk-muted" />
      <span className="truncate text-[13px]">{name}</span>
    </span>
  )
}

/**
 * Krok, który padł, ma WŁASNĄ ikonę i WŁASNY token koloru — nie pożycza ich od
 * ostrzeżenia. Wcześniej stał tu ten sam trójkąt i ten sam `desk-warn`, co przy
 * „niesprawdzone", więc dwie różne rzeczy wyglądały identycznie: „zrobiłem, ale nie
 * odczytałem po zapisie" i „nie zrobiłem wcale". Krzyżyk mówi „tego nie ma", trójkąt
 * mówi „to jest, ale uważaj" — i tę różnicę widać zanim człowiek przeczyta tytuł.
 *
 * Samo rozróżnienie graficzne niczego jednak nie niesie: porażkę niesie SŁOWO w tytule
 * („Nie zapisałem"), a ikona i kolor tylko je wspierają.
 */
const STEP_STATUS: Record<Step["status"], { icon: LucideIcon; className: string; spin?: boolean }> =
  {
    running: { icon: LoaderCircle, className: "text-desk-accent", spin: true },
    ok: { icon: Check, className: "text-desk-muted" },
    failed: { icon: X, className: "text-desk-bad" },
  }

/**
 * TRZY ZDANIA KROKU, KTÓRY SIĘ NIE UDAŁ — w stałej kolejności i z nagłówkami.
 *
 * Nagłówki są tu po to, żeby środkowe zdanie dało się znaleźć wzrokiem, nie czytając
 * całości. Jest ono najważniejsze z trójki: najgorsza awaria to taka, po której człowiek
 * nie wie, czy coś się już wydarzyło — i wtedy jedynym bezpiecznym ruchem jest nie ruszać
 * niczego. Zdania powstają w `describeFailure`, ze zdarzenia; ten komponent ich nie pisze.
 */
function Failure({ text }: { text: { happened: string; changed: string; next: string } }) {
  const translate = useDeskT()
  const parts = [
    { title: translate("trail.failure.titleHappened"), body: text.happened },
    { title: translate("trail.failure.titleChanged"), body: text.changed },
    { title: translate("trail.failure.titleNext"), body: text.next },
  ]
  return (
    <div className="space-y-2 pt-1">
      {parts.map((part) => (
        <div key={part.title}>
          {/*
            `desk-muted`, nie `desk-muted-2`: ten drugi ma na tle podniesionym 2,59:1,
            czyli poniżej progu 4,5:1 dla tekstu (pomiar: `npm run kontrast:pomiar`).
            Nagłówek, którego nie widać, jest gorszy niż jego brak — a to jest ostatnie
            miejsce w produkcie, które wolno przeoczyć wzrokiem.
          */}
          <div className="t-micro text-desk-muted">{part.title}</div>
          <p className="text-desk-ink">{part.body}</p>
        </div>
      ))}
    </div>
  )
}

function Row({
  k,
  at,
  now,
  approver,
}: {
  k: Step
  at: string
  now: number
  /** „Imię Nazwisko" osoby wydającej zgody; pusto, gdy Biurko nie umie jej wskazać. */
  approver?: string | undefined
}) {
  const translate = useDeskT()
  const locale = useDeskLocale()
  const [open, setOpen] = useState(k.status === "failed")
  const o = describeStep(k, translate)
  const failure = describeFailure(k, translate, approver)
  const s = STEP_STATUS[k.status]
  const ms = k.status === "running" ? now - new Date(at).getTime() : k.ms
  const duration = stepDuration(ms)
  const hasDetail = Boolean(o.path || o.detail || failure)

  return (
    <li>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((x) => !x)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
        className="group flex h-9 w-full items-center gap-2 rounded-sm px-3 text-left enabled:hover:bg-desk-raised/60 md:h-desk-step"
      >
        <span className={`grid w-5 shrink-0 place-items-center ${s.className}`}>
          <Icon as={s.icon} px={16} className={s.spin ? "spin" : undefined} />
        </span>
        <span className="t-body flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0">{o.title}</span>
          {o.file && <Pill name={o.file} />}
        </span>
        {duration && <span className="t-meta shrink-0 tabular-nums">{duration}</span>}
        {hasDetail && (
          <Icon
            as={ChevronDown}
            px={14}
            className={`shrink-0 text-desk-muted-2 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && hasDetail && (
        <div className="pb-2 pl-10 pr-3 pt-0.5 text-[13px] leading-5 text-desk-muted">
          {o.path && <div>{translate("trail.onFile", { path: o.path })}</div>}
          {o.detail && <div>{translate("trail.saw", { detail: o.detail })}</div>}
          {failure && <Failure text={failure} />}
          <div className="t-micro pt-0.5">
            {new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(at))}
          </div>
        </div>
      )}
    </li>
  )
}

export function ActivityTrail({
  entries,
  isWorking,
  now,
  approver,
}: {
  entries: AuditEntry[]
  isWorking: boolean
  now: number
  /** Przechodzi do zdania „co teraz" przy kroku, który padł — patrz `describeFailure`. */
  approver?: string | undefined
}) {
  const translate = useDeskT()
  const steps = pairSteps(entries.map((w) => w.event))
  const evidence = evidenceFromEvents(
    entries.map((w) => w.event),
    translate,
  )
  const stumble = steps.some((k) => k.status === "failed")
  // „Zrobione z potknięciem: nic nie zostało zrobione" jest zdaniem sprzecznym samym
  // ze sobą, a właśnie tak brzmiał nagłówek, gdy PADŁY WSZYSTKIE kroki. Grupa, z której
  // nie wyszła ani jedna czynność, mówi wprost, że się nie udało.
  const nothingDone = stumble && !steps.some((k) => k.status === "ok")
  const uncertain = evidence.unverified.length > 0
  const blocked = evidence.notAllowed.length > 0
  const external = evidence.external.length > 0
  const [collapsed, setCollapsed] = useState(false)
  const collapsedOnce = useRef(false)

  // Zwijamy 800 ms po zakończeniu — ale zła wiadomość nigdy nie chowa się sama.
  useEffect(() => {
    if (isWorking || collapsedOnce.current || !steps.length) return
    if (stumble || uncertain || blocked) {
      collapsedOnce.current = true
      return
    }
    const t = setTimeout(() => {
      setCollapsed(true)
      collapsedOnce.current = true
    }, 800)
    return () => clearTimeout(t)
  }, [isWorking, steps.length, stumble, uncertain, blocked])

  if (!steps.length) return null

  const running = steps.find((k) => k.status === "running")
  const totalMs = steps.reduce((a, k) => a + (k.ms ?? 0), 0)
  const totalDuration = stepDuration(totalMs)

  const header = isWorking
    ? {
        icon: LoaderCircle,
        className: "text-desk-accent",
        spin: true,
        text: translate("trail.working"),
      }
    : nothingDone
      ? { icon: X, className: "text-desk-bad", text: translate("trail.allFailed") }
      : stumble
        ? {
            icon: TriangleAlert,
            className: "text-desk-warn",
            text: translate("trail.stumbled", {
              what: summariseGroup(steps, translate).toLowerCase(),
            }),
          }
        : { icon: Check, className: "text-desk-ok", text: summariseGroup(steps, translate) }

  return (
    <section
      className="slide-in overflow-hidden rounded-lg border bg-desk-surface"
      aria-label={translate("trail.label")}
    >
      <h3>
        <button
          type="button"
          onClick={() => setCollapsed((z) => !z)}
          aria-expanded={!collapsed}
          className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-desk-raised/50"
        >
          <span className={`grid w-5 shrink-0 place-items-center ${header.className}`}>
            <Icon as={header.icon} px={16} className={header.spin ? "spin" : undefined} />
          </span>
          <span className="t-body-m min-w-0 flex-1 truncate">{header.text}</span>
          {isWorking && running && (
            <span className="t-meta shrink-0">
              {translate("trail.step", { n: steps.indexOf(running) + 1 })}
            </span>
          )}
          {!isWorking && totalDuration && (
            <span className="t-meta shrink-0 tabular-nums">{totalDuration}</span>
          )}
          {!isWorking && uncertain && (
            <span className="t-meta flex shrink-0 items-center gap-1 text-desk-warn">
              <Icon as={TriangleAlert} px={12} />
              {translate("trail.unverifiedCount", { count: evidence.unverified.length })}
            </span>
          )}
          <Icon
            as={ChevronDown}
            px={16}
            className={`shrink-0 text-desk-muted-2 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
      </h3>

      {/*
        Kreski osi tu NIE MA i to jest poprawka, nie przeoczenie. Biegła na `left-[22px]`,
        czyli dokładnie przez środek kolumny ikon (`px-3` + połowa `w-5`), mimo komentarza
        twierdzącego, że biegnie pod nimi — przecinała każdy krzyżyk i każdą fajkę w poprzek.
      */}
      {!collapsed && (
        <ul aria-label={translate("trail.steps")} className="space-y-0.5 border-t py-1.5">
          {steps.map((k) => (
            <Row
              key={k.i}
              k={k}
              at={entries[k.i]?.at ?? new Date().toISOString()}
              now={now}
              approver={approver}
            />
          ))}
        </ul>
      )}

      {/* Stopka dowodu zostaje widoczna także po zwinięciu — bez niej zwinięcie chowa
          jedyną rzecz, która odróżnia to narzędzie od zwykłego czatu. */}
      {(evidence.intake.length > 0 ||
        evidence.produced.length > 0 ||
        external ||
        uncertain ||
        blocked) && (
        <div className="space-y-1 border-t bg-desk-raised/40 px-3 py-2.5">
          {(evidence.intake.length > 0 || evidence.produced.length > 0) && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={ShieldCheck} px={14} className="mt-0.5 shrink-0 text-desk-ok" />
              <div>
                <span className="text-desk-ink">{translate("trail.checked")}</span>{" "}
                <span className="text-desk-muted">
                  {[...evidence.intake, ...evidence.produced].join(" · ")}
                </span>
              </div>
            </div>
          )}
          {external && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={Globe} px={14} className="mt-0.5 shrink-0 text-desk-muted" />
              <div>
                {/* „Zapytałem", nie „sprawdziłem": z tego, że obcy serwer odpowiedział,
                    nie wynika, że odpowiedział prawdę ani że rzecz się wydarzyła. */}
                <span className="text-desk-ink">{translate("trail.asked")}</span>{" "}
                <span className="text-desk-muted">{evidence.external.join(" · ")}</span>
              </div>
            </div>
          )}
          {uncertain && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={TriangleAlert} px={14} className="mt-0.5 shrink-0 text-desk-warn" />
              <div>
                <span className="text-desk-ink">{translate("trail.notChecked")}</span>{" "}
                <span className="text-desk-muted">{evidence.unverified.join(" · ")}</span>
              </div>
            </div>
          )}
          {blocked && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={Lock} px={14} className="mt-0.5 shrink-0 text-desk-muted" />
              <div>
                <span className="text-desk-ink">{translate("trail.notAllowed")}</span>{" "}
                <span className="text-desk-muted">{evidence.notAllowed.join(" · ")}</span>
              </div>
            </div>
          )}
          <p className="t-micro pt-0.5">{translate("trail.note")}</p>
        </div>
      )}
    </section>
  )
}
