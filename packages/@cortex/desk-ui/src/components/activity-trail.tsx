"use client"
import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import {
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
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "./icon"

function fileIcon(name: string): LucideIcon {
  if (/\.(csv|xlsx?|tsv)$/i.test(name)) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return FileImage
  return FileText
}

/** Nazwa pliku jako osobny, rozpoznawalny obiekt — nie fragment zdania. */
function Pill({ name }: { name: string }) {
  return (
    <span className="inline-flex h-5 max-w-[220px] shrink-0 items-center gap-1 rounded-sm bg-raised px-1.5 align-middle">
      <Icon as={fileIcon(name)} px={12} className="shrink-0 text-cichy" />
      <span className="truncate text-[13px]">{name}</span>
    </span>
  )
}

const STEP_STATUS: Record<Step["status"], { icon: LucideIcon; className: string; spin?: boolean }> =
  {
    running: { icon: LoaderCircle, className: "text-akcent", spin: true },
    ok: { icon: Check, className: "text-cichy" },
    failed: { icon: TriangleAlert, className: "text-warn" },
  }

function Row({ k, at, now }: { k: Step; at: string; now: number }) {
  const [open, setOpen] = useState(k.status === "failed")
  const o = describeStep(k)
  const s = STEP_STATUS[k.status]
  const ms = k.status === "running" ? now - new Date(at).getTime() : k.ms
  const duration = stepDuration(ms)
  const hasDetail = Boolean(o.path || o.detail)

  return (
    <li>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((x) => !x)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
        className="group flex h-9 w-full items-center gap-2 rounded-sm px-3 text-left enabled:hover:bg-raised/60 md:h-krok"
      >
        <span className={`grid w-5 shrink-0 place-items-center ${s.className}`}>
          <Icon as={s.icon} px={16} className={s.spin ? "obrot" : undefined} />
        </span>
        <span className="t-tresc flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0">{o.title}</span>
          {o.file && <Pill name={o.file} />}
        </span>
        {duration && <span className="t-meta shrink-0 tabular-nums">{duration}</span>}
        {hasDetail && (
          <Icon
            as={ChevronDown}
            px={14}
            className={`shrink-0 text-cichy-2 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && hasDetail && (
        <div className="pb-2 pl-10 pr-3 pt-0.5 text-[13px] leading-5 text-cichy">
          {o.path && <div>Na pliku: {o.path}</div>}
          {o.detail && <div>Zobaczyłem: {o.detail}</div>}
          <div className="t-micro pt-0.5">{new Date(at).toLocaleTimeString("pl-PL")}</div>
        </div>
      )}
    </li>
  )
}

export function ActivityTrail({
  entries,
  isWorking,
  now,
}: {
  entries: AuditEntry[]
  isWorking: boolean
  now: number
}) {
  const steps = pairSteps(entries.map((w) => w.event))
  const evidence = evidenceFromEvents(entries.map((w) => w.event))
  const stumble = steps.some((k) => k.status === "failed")
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
    ? { icon: LoaderCircle, className: "text-akcent", spin: true, text: "Pracuję nad tym…" }
    : stumble
      ? {
          icon: TriangleAlert,
          className: "text-warn",
          text: `Zrobione z potknięciem: ${summariseGroup(steps).toLowerCase()}`,
        }
      : { icon: Check, className: "text-ok", text: summariseGroup(steps) }

  return (
    <section
      className="wjazd overflow-hidden rounded-lg border bg-surface"
      aria-label="Przebieg pracy"
    >
      <h3>
        <button
          type="button"
          onClick={() => setCollapsed((z) => !z)}
          aria-expanded={!collapsed}
          className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-raised/50"
        >
          <span className={`grid w-5 shrink-0 place-items-center ${header.className}`}>
            <Icon as={header.icon} px={16} className={header.spin ? "obrot" : undefined} />
          </span>
          <span className="t-tresc-m min-w-0 flex-1 truncate">{header.text}</span>
          {isWorking && running && (
            <span className="t-meta shrink-0">krok {steps.indexOf(running) + 1}</span>
          )}
          {!isWorking && totalDuration && (
            <span className="t-meta shrink-0 tabular-nums">{totalDuration}</span>
          )}
          {!isWorking && uncertain && (
            <span className="t-meta flex shrink-0 items-center gap-1 text-warn">
              <Icon as={TriangleAlert} px={12} />
              {evidence.unverified.length === 1
                ? "1 rzecz niesprawdzona"
                : `${evidence.unverified.length} rzeczy niesprawdzone`}
            </span>
          )}
          <Icon
            as={ChevronDown}
            px={16}
            className={`shrink-0 text-cichy-2 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
      </h3>

      {!collapsed && (
        <ul aria-label="Kroki pracy" className="relative space-y-0.5 border-t py-1.5">
          {/* oś: kreska biegnie pod kolumną ikon, nie przez nie */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-3 left-[22px] top-3 w-px bg-line"
          />
          {steps.map((k) => (
            <Row key={k.i} k={k} at={entries[k.i]?.at ?? new Date().toISOString()} now={now} />
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
        <div className="space-y-1 border-t bg-raised/40 px-3 py-2.5">
          {(evidence.intake.length > 0 || evidence.produced.length > 0) && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={ShieldCheck} px={14} className="mt-0.5 shrink-0 text-ok" />
              <div>
                <span className="text-ink">Sprawdzone:</span>{" "}
                <span className="text-cichy">
                  {[...evidence.intake, ...evidence.produced].join(" · ")}
                </span>
              </div>
            </div>
          )}
          {external && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={Globe} px={14} className="mt-0.5 shrink-0 text-cichy" />
              <div>
                {/* „Zapytałem", nie „sprawdziłem": z tego, że obcy serwer odpowiedział,
                    nie wynika, że odpowiedział prawdę ani że rzecz się wydarzyła. */}
                <span className="text-ink">Pytałem poza firmą:</span>{" "}
                <span className="text-cichy">{evidence.external.join(" · ")}</span>
              </div>
            </div>
          )}
          {uncertain && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={TriangleAlert} px={14} className="mt-0.5 shrink-0 text-warn" />
              <div>
                <span className="text-ink">Nie sprawdziłem:</span>{" "}
                <span className="text-cichy">{evidence.unverified.join(" · ")}</span>
              </div>
            </div>
          )}
          {blocked && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Icon as={Lock} px={14} className="mt-0.5 shrink-0 text-cichy" />
              <div>
                <span className="text-ink">Na to nie masz zgody:</span>{" "}
                <span className="text-cichy">{evidence.notAllowed.join(" · ")}</span>
              </div>
            </div>
          )}
          <p className="t-micro pt-0.5">
            To jest lista tego, co faktycznie się wydarzyło — nie tego, co napisałem powyżej.
          </p>
        </div>
      )}
    </section>
  )
}
