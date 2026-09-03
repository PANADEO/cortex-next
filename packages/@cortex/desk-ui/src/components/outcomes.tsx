"use client"
import { capabilityLabel, departmentLabel } from "@cortex/desk-core/capability-text"
import { failureHappened } from "@cortex/desk-core/steps"
import type { Capability, CaseStatus, Outcomes as Tally } from "@cortex/desk-core/types"
import { ArrowRight, Lock, TriangleAlert, Wallet } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useDeskLocale, useDeskT } from "../i18n/client"
import { reasonText, zl } from "../lib"
import { api, t } from "../routes"
import { Icon } from "./icon"

/**
 * CO SIĘ NIE UDAŁO — ekran, który zamienia porażkę w decyzję.
 *
 * Robert ma odpowiedzieć swojemu szefowi na dwa pytania i tylko na te dwa: „czy to
 * działa" i „czy warto płacić". Dane na oba leżały w bazie od pierwszego dnia — stany
 * spraw, powody zatrzymania, zdarzenia nieudanych czynności, kłódki — ale nikt ich nie
 * zestawiał, więc odpowiedź brzmiała „chyba tak" i tyle było z niej pożytku.
 *
 * KOLEJNOŚĆ BLOKÓW JEST TREŚCIĄ, nie układem. Najpierw wynik, bo od niego zaczyna się
 * rozmowa. Zaraz potem kłódki — czyli JEDYNY blok, po którym przełożony ma co zrobić
 * dziś: włączyć komuś zdolność, jednym kliknięciem, w „Zespole". Diagnoza („co się
 * psuje") stoi niżej, bo z niej wynika praca dla nas, a nie dla niego. Pieniądze na
 * końcu, bo bez trzech poprzednich liczb sama kwota nie mówi nic.
 *
 * CZEGO NA TYM EKRANIE NIE MA I NIE BĘDZIE: tytułu cudzej sprawy, nazwy pliku, opisu,
 * którym agent nazwał brakującą czynność, ani imienia przy kłódce. Sprawa jest prywatna,
 * a wszystkie te rzeczy są jej treścią — tytuł bierze się dosłownie z pierwszego zdania
 * człowieka. Przełożony dostaje LICZBY, POWODY i ZDOLNOŚCI. Kto sam się o dostęp
 * upomniał, stoi w „Do decyzji" — bo tam poprosił własnym imieniem i z własnej woli.
 */

/**
 * Cztery liczby, którymi zaczyna się rozmowa o tym, czy to działa.
 *
 * „W toku" zbiera `new` i `working` razem, bo dla przełożonego to jest jedno i to samo:
 * praca, o której jeszcze nie wiadomo, czym się skończy. Rozdzielanie ich kazałoby mu
 * znać różnicę między sprawą założoną a sprawą, w której model właśnie pisze.
 */
const RESULT_CELLS: { key: string; statuses: CaseStatus[]; tone: string }[] = [
  { key: "done", statuses: ["done"], tone: "text-desk-ink" },
  { key: "failed", statuses: ["failed"], tone: "text-desk-bad" },
  { key: "stopped", statuses: ["stopped"], tone: "text-desk-warn" },
  { key: "unfinished", statuses: ["new", "working"], tone: "text-desk-ink" },
]

export function Outcomes({ catalogue }: { catalogue: Capability[] }) {
  const [tally, setTally] = useState<Tally | null>(null)
  // Trzeci stan obok „mam" i „czekam": NIE UDAŁO SIĘ ODCZYTAĆ. Bez niego ekran
  // pokazywałby w tej sytuacji same zera — czyli mówiłby „nic się nie zepsuło" wtedy,
  // gdy w rzeczywistości nie wie nic. To jest dokładnie to kłamstwo, przed którym broni
  // się cały ten produkt, tylko postawione o piętro wyżej.
  const [unreadable, setUnreadable] = useState(false)
  const translate = useDeskT()
  const locale = useDeskLocale()

  useEffect(() => {
    let alive = true
    fetch(api("/outcomes"), { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as Tally) : null))
      .catch(() => null)
      .then((d) => {
        if (!alive) return
        if (d) setTally(d)
        else setUnreadable(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (unreadable) return <p className="t-body py-6">{translate("outcomes.unreadable")}</p>
  if (!tally) return <p className="t-meta py-6">{translate("outcomes.loading")}</p>

  const howMany = (statuses: CaseStatus[]) =>
    tally.cases
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row.cases, 0)

  /** Dział-właściciel zdolności. Katalog przychodzi propem — sięga do bazy, więc do
   *  przeglądarki nie wjeżdża; tą samą drogą dostaje go „Zespół". */
  const department = (id: string) => catalogue.find((one) => one.id === id)?.department

  return (
    <section>
      <h2 className="t-section mb-1">{translate("outcomes.title")}</h2>
      <p className="t-meta mb-5">{translate("outcomes.lead", { days: tally.days })}</p>

      {/* ── CZY TO DZIAŁA ────────────────────────────────────────────────── */}
      <h3 className="t-h3 mb-2">{translate("outcomes.worksTitle")}</h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RESULT_CELLS.map((cell) => (
          <li key={cell.key} className="rounded-lg border bg-desk-surface px-4 py-3">
            <div className={`t-h2 tabular-nums ${cell.tone}`}>{howMany(cell.statuses)}</div>
            <div className="t-meta">{translate(`outcomes.cell.${cell.key}`)}</div>
          </li>
        ))}
      </ul>
      <p className="t-body mt-2">
        {tally.resultShare === null
          ? translate("outcomes.shareUnknown")
          : translate("outcomes.share", { share: tally.resultShare })}
      </p>
      {tally.stops.length > 0 && (
        <ul className="t-meta mt-1.5 space-y-0.5">
          {tally.stops.map((row) => (
            <li key={row.reason} className="tabular-nums">
              {translate("outcomes.stopped", {
                reason: reasonText(translate, row.reason),
                count: row.cases,
              })}
            </li>
          ))}
        </ul>
      )}

      {/* ── CZEGO LUDZIOM BRAKUJE ────────────────────────────────────────── */}
      <h3 className="t-h3 mb-1 mt-8 flex items-center gap-1.5">
        <Icon as={Lock} px={16} className="text-desk-muted" />
        {translate("outcomes.missingTitle")}
      </h3>
      <p className="t-meta mb-2">{translate("outcomes.missingLead")}</p>
      <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
        {tally.missing.length === 0 && (
          <li className="t-meta px-4 py-3">{translate("outcomes.missingEmpty")}</li>
        )}
        {tally.missing.map((row) => (
          <li key={row.capabilityId ?? "outside"} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="t-body min-w-0 flex-1">
              {row.capabilityId === null
                ? translate("outcomes.missingOutside")
                : capabilityLabel(translate, row.capabilityId, row.capabilityId)}
              {row.capabilityId !== null && (
                <span className="t-micro pl-2">
                  {departmentLabel(translate, department(row.capabilityId))}
                </span>
              )}
            </span>
            <span className="t-meta shrink-0 tabular-nums">
              {translate("outcomes.times", { count: row.times })} ·{" "}
              {translate("outcomes.people", { count: row.people })}
            </span>
          </li>
        ))}
      </ul>
      {tally.missing.some((row) => row.capabilityId !== null) && (
        <Link
          href={t("/supervision?section=team")}
          className="t-btn mt-2 inline-flex items-center gap-1.5 text-desk-accent hover:underline"
        >
          {translate("outcomes.missingAction")}
          <Icon as={ArrowRight} px={14} />
        </Link>
      )}

      {/* ── CO SIĘ PSUJE ─────────────────────────────────────────────────── */}
      <h3 className="t-h3 mb-1 mt-8 flex items-center gap-1.5">
        <Icon as={TriangleAlert} px={16} className="text-desk-muted" />
        {translate("outcomes.stepsTitle")}
      </h3>
      <p className="t-meta mb-2">{translate("outcomes.stepsLead")}</p>
      <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
        {tally.steps.length === 0 && (
          <li className="t-meta px-4 py-3">{translate("outcomes.stepsEmpty")}</li>
        )}
        {tally.steps.map((row) => (
          <li key={row.reason} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="t-body min-w-0 flex-1">{failureHappened(translate, row.reason)}</span>
            <span className="t-meta shrink-0 tabular-nums">
              {translate("outcomes.times", { count: row.times })} ·{" "}
              {translate("outcomes.inCases", { count: row.cases })}
            </span>
          </li>
        ))}
      </ul>

      {/* ── CZY WARTO PŁACIĆ ─────────────────────────────────────────────── */}
      <h3 className="t-h3 mb-1 mt-8 flex items-center gap-1.5">
        <Icon as={Wallet} px={16} className="text-desk-muted" />
        {translate("outcomes.costTitle")}
      </h3>
      <p className="t-meta mb-2">{translate("outcomes.costLead")}</p>
      <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
        <li className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <span className="t-body">{translate("outcomes.costWithResult")}</span>
          <span className="t-body tabular-nums">{zl(tally.cost.withResult, locale)}</span>
        </li>
        <li className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <span className="t-body">{translate("outcomes.costWithoutResult")}</span>
          <span className="t-body tabular-nums text-desk-bad">
            {zl(tally.cost.withoutResult, locale)}
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <span className="t-body">{translate("outcomes.costUnfinished")}</span>
          <span className="t-body tabular-nums">{zl(tally.cost.unfinished, locale)}</span>
        </li>
      </ul>
      <p className="t-micro pt-2">{translate("outcomes.costNote")}</p>
    </section>
  )
}
