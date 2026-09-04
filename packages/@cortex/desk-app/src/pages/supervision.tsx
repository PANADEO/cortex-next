import * as audit from "@cortex/desk-core/audit-log"
import { describeEntry } from "@cortex/desk-core/audit-log-text"
import { capabilityCatalogue, policyFor, spentToday } from "@cortex/desk-core/capability-gate"
import { pool } from "@cortex/desk-core/db"
import { viewer } from "@cortex/desk-core/identity"
import { failedCaseCount } from "@cortex/desk-core/outcomes"
import { DEPARTMENTS, everyone, names, ROLES } from "@cortex/desk-core/people"
import { activeProcedures } from "@cortex/desk-core/procedures/store"
import { Icon } from "@cortex/desk-ui/components/icon"
import { McpSupervision } from "@cortex/desk-ui/components/mcp-supervision"
import { Outcomes } from "@cortex/desk-ui/components/outcomes"
import { ProcedureSupervision } from "@cortex/desk-ui/components/procedure-supervision"
import { RequestSupervision } from "@cortex/desk-ui/components/request-supervision"
import { SectionTabs } from "@cortex/desk-ui/components/section-tabs"
import { Shell } from "@cortex/desk-ui/components/shell"
import { Team } from "@cortex/desk-ui/components/team"
import type { DeskLocale } from "@cortex/desk-ui/i18n/locale"
import { deskLocale, deskT } from "@cortex/desk-ui/i18n/server"
import { zl } from "@cortex/desk-ui/lib"
import { t } from "@cortex/desk-ui/routes"
import { ShieldCheck } from "lucide-react"
import { notFound, redirect } from "next/navigation"
import { Fragment } from "react"

/**
 * Ekran przełożonego: kto o co prosi, co się dzisiaj działo i ile to kosztowało.
 *
 * PODZIELONY NA SEKCJE, bo w jednej kolumnie stały cztery rzeczy o różnej pilności:
 * prośby czekające na decyzję, katalog narzędzi obcych serwerów, dzisiejsze wydatki
 * i czterdzieści wierszy dziennika. Najważniejsza z nich — decyzja do podjęcia — była
 * najkrótsza i najczęściej pusta, więc ekran wyglądał jak ściana dziennika, a to,
 * co wymaga człowieka, ginęło. Teraz pilność widać w plakietce przy zakładce, zanim
 * cokolwiek się otworzy.
 *
 * Sekcja jest w ADRESIE, nie w stanie komponentu — patrz `SectionTabs`.
 */

// „Nieudane" stoi DRUGIE, zaraz za tym, co czeka na decyzję. Pierwsza pozycja jest
// domyślna (jej adres nie niesie parametru), a domyślnym ekranem przełożonego zostaje
// to, co wymaga go dziś. Zaraz potem idzie odpowiedź na pytanie, które zadaje mu jego
// szef — przed katalogiem narzędzi i przed dziennikiem, bo tamte dwa czyta się wtedy,
// gdy już się wie, czego szukać.
// „Procedury" stoją zaraz za narzędziami, bo to ta sama klasa rzeczy: jedno i drugie
// przełożony PODPISUJE nazwiskiem i jedno i drugie może wycofać. Przed wydatkami
// i dziennikiem, które czyta się dopiero wtedy, gdy już się wie, czego szukać.
const SECTIONS = [
  "decisions",
  "outcomes",
  "team",
  "tools",
  "procedures",
  "spending",
  "log",
] as const
type Section = (typeof SECTIONS)[number]

const isSection = (value: unknown): value is Section =>
  typeof value === "string" && (SECTIONS as readonly string[]).includes(value)

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const u = await viewer()
  if (u.role !== "management") notFound()
  const [locale, translate] = await Promise.all([deskLocale(), deskT()])

  const asked = (await searchParams)?.section
  // Nieznana sekcja PRZEKIEROWUJE na adres kanoniczny, zamiast po cichu pokazać
  // domyślną. Literówka w zakładce dawała ekran, który wygląda poprawnie i mówi
  // co innego, niż mówi adres — a to jest ten rodzaj cichej niezgodności, który
  // w produkcie o dowodach kosztuje najwięcej zaufania.
  if (asked !== undefined && !isSection(asked)) redirect(t("/supervision"))
  const section: Section = isSection(asked) ? asked : "decisions"

  // Liczby do plakietek lecą ZAWSZE — to one mówią, czy warto tam zajrzeć — ale są
  // trzema tanimi zapytaniami zbiorczymi, a nie pobraniem treści czterech sekcji.
  const [waiting, suspended, spentAll, team, failures, procedures] = await Promise.all([
    pool.query<{ n: string }>(
      `select count(*)::text as n from desk.access_request where status='pending'`,
    ),
    pool.query<{ n: string }>(
      `select count(*)::text as n from desk.mcp_tool where status='suspended'`,
    ),
    // DZISIEJSZY KOSZT ZE ZDARZEŃ, nie z kolumny sprawy — ta sama zasada, na której stoi
    // `spentToday` i `costByStatus`, i ostatnie miejsce w produkcie, które ją łamało.
    // Suma po kolumnie z `updated_at` z dzisiaj wnosiła CAŁY historyczny koszt sprawy
    // sprzed miesiąca, w której ktoś dziś dopisał zdanie — więc plakietka nad sekcją
    // pokazywała inną liczbę niż wykres pod nią, obie podpisane „dzisiaj".
    pool.query<{ total: string }>(
      `select coalesce(sum((payload->>'usd')::numeric),0)::text as total
         from desk.event
        where payload->>'type' = 'cost' and at::date = now()::date`,
    ),
    everyone(),
    // Porażki w plakietce, a nie dopiero po wejściu w sekcję: przełożony ma zobaczyć,
    // że jest o czym rozmawiać, ZANIM cokolwiek otworzy — tak samo jak przy prośbach
    // czekających na decyzję.
    failedCaseCount(),
    // Pełna lista zamiast `count(*)`: `activeProcedures()` wsypuje przy okazji zasiew,
    // więc świeże wdrożenie pokazuje procedury od pierwszego wejścia na ten ekran,
    // a nie dopiero po pierwszej turze. Wierszy są jednostki, nie tysiące.
    activeProcedures(),
  ])
  const today = Number(spentAll.rows[0]?.total ?? 0)
  const headcount = team.length

  return (
    <Shell>
      <div className="h-full overflow-y-auto pb-desk-bar md:pb-0">
        <div className="mx-auto max-w-desk-stream px-5 py-8">
          <h1 className="t-display">{translate("supervision.title")}</h1>
          <p className="t-body mt-1 text-desk-muted">{translate("supervision.lead")}</p>

          <SectionTabs
            base="/supervision"
            active={section}
            label={translate("supervision.sections")}
            tabs={[
              {
                key: "decisions",
                label: translate("supervision.tabDecisions"),
                count: Number(waiting.rows[0]?.n ?? 0),
              },
              {
                key: "outcomes",
                label: translate("supervision.tabOutcomes"),
                count: failures,
                tone: "warn",
              },
              { key: "team", label: translate("supervision.tabTeam"), note: String(headcount) },
              {
                key: "tools",
                label: translate("supervision.tabTools"),
                count: Number(suspended.rows[0]?.n ?? 0),
                tone: "warn",
              },
              {
                key: "procedures",
                label: translate("supervision.tabProcedures"),
                note: String(procedures.length),
              },
              {
                key: "spending",
                label: translate("supervision.tabSpending"),
                note: zl(today, locale),
              },
              { key: "log", label: translate("supervision.tabLog") },
            ]}
          />

          <div className="pt-6">
            {section === "decisions" && <Decisions />}
            {section === "outcomes" && <Outcomes catalogue={capabilityCatalogue} />}
            {section === "team" && (
              <section>
                <h2 className="t-section mb-1">{translate("team.title")}</h2>
                <p className="t-meta mb-2">{translate("team.lead")}</p>
                <Team
                  catalogue={capabilityCatalogue}
                  roles={ROLES}
                  departments={DEPARTMENTS}
                  me={u.id}
                />
              </section>
            )}
            {section === "tools" && <McpSupervision />}
            {section === "procedures" && <ProcedureSupervision />}
            {section === "spending" && <Spending />}
            {section === "log" && <Log />}
          </div>

          <p className="t-micro mt-8 flex items-center gap-1.5">
            <Icon as={ShieldCheck} px={12} /> {translate("supervision.managementOnly")}
          </p>
        </div>
      </div>
    </Shell>
  )
}

/** Prośby czekające i rozpatrzone, a pod nimi to, czego katalog w ogóle nie zna. */
async function Decisions() {
  const [translate, people] = await Promise.all([deskT(), names()])
  // czego agent szukał, a katalog tego nie obejmuje — sygnał, że lista zdolności ma dziurę
  const gaps = (await audit.latest(300))
    .filter((w) => w.type === "capability.missing" && !w.details?.capability)
    .slice(0, 8)

  return (
    <>
      <RequestSupervision />

      {gaps.length > 0 && (
        <section className="mt-8">
          <h2 className="t-section mb-1">{translate("supervision.gaps")}</h2>
          <p className="t-meta mb-2">{translate("supervision.gapsLead")}</p>
          <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
            {gaps.map((w, i) => (
              <li key={i} className="t-body flex gap-3 px-4 py-2.5">
                <span className="t-meta w-20 shrink-0">{people[w.who] ?? w.who}</span>
                <span className="min-w-0 flex-1">{String(w.details?.description ?? "")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

async function Spending() {
  const [locale, translate] = await Promise.all([deskLocale(), deskT()])
  const spending = await Promise.all(
    (await everyone()).map(async (x) => ({
      person: x,
      usd: await spentToday(x.id),
      limit: (await policyFor(x)).dailyLimitUsd,
    })),
  )

  return (
    <section>
      <h2 className="t-section mb-2">{translate("supervision.spending")}</h2>
      <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
        {spending.map(({ person, usd, limit }) => {
          const share = Math.min(100, Math.round((usd / limit) * 100))
          return (
            <li key={person.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="t-body">
                  {person.firstName} {person.lastName}
                </span>
                <span className="t-meta tabular-nums">
                  {translate("supervision.ofLimit", {
                    spent: zl(usd, locale),
                    limit: zl(limit, locale),
                    share,
                  })}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-desk-pill bg-desk-raised">
                <div
                  className={`h-full rounded-desk-pill ${share >= 90 ? "bg-desk-bad" : share >= 70 ? "bg-desk-warn" : "bg-desk-ok"}`}
                  style={{ width: `${Math.max(share, 2)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="t-micro pt-2">{translate("supervision.limitNote")}</p>
    </section>
  )
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** „Dzisiaj" i „Wczoraj" nazwane, starsze — pełną datą z dniem tygodnia. */
function dayLabel(d: Date, locale: DeskLocale, translate: (k: string) => string) {
  const now = new Date()
  if (sameDay(d, now)) return translate("supervision.today")
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return translate("supervision.yesterday")
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

async function Log() {
  const [locale, translate] = await Promise.all([deskLocale(), deskT()])
  const [entries, people] = await Promise.all([audit.latest(40), names()])
  return (
    <section>
      <h2 className="t-section mb-2">{translate("supervision.log")}</h2>
      <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
        {entries.length === 0 && (
          <li className="t-meta px-4 py-3">{translate("supervision.logEmpty")}</li>
        )}
        {entries.map((w, i) => {
          const o = describeEntry(
            { ...w, at: w.at.toISOString?.() ?? String(w.at) },
            translate,
            people,
          )
          const who = people[w.who]
          // Kolumna niosła samą godzinę, więc wpis z wczoraj wyglądał identycznie jak
          // dzisiejszy — a dziennik audytowy ma pozwalać ustalić KIEDY, nie tylko O KTÓREJ.
          // Nagłówek dnia zamiast daty przy każdym wierszu: kolumna zostaje wąska
          // i pozostaje porównywalna między wierszami.
          const at = new Date(w.at)
          const previous = entries[i - 1]
          const newDay = !previous || !sameDay(new Date(previous.at), at)
          return (
            <Fragment key={i}>
              {newDay && (
                <li className="t-micro bg-desk-raised/40 px-4 py-1.5 tabular-nums">
                  {dayLabel(at, locale, translate)}
                </li>
              )}
              <li className="flex gap-3 px-4 py-2.5">
                <span className="t-meta w-20 shrink-0 tabular-nums">
                  {new Intl.DateTimeFormat(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(at)}
                </span>
                <span
                  className={`t-body min-w-0 flex-1 ${o.weight === "important" ? "" : "text-desk-ink-2"}`}
                >
                  <span className="font-medium">{who ?? w.who}</span> {o.text}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ul>
      <p className="t-micro pt-2">{translate("supervision.logNote")}</p>
    </section>
  )
}
