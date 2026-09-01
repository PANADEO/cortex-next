import * as audit from "@cortex/desk-core/audit-log"
import { describeEntry } from "@cortex/desk-core/audit-log-text"
import { policyFor, spentToday } from "@cortex/desk-core/capability-gate"
import { pool } from "@cortex/desk-core/db"
import { USERS, whoAmI } from "@cortex/desk-core/identity"
import { Icon } from "@cortex/desk-ui/components/icon"
import { McpSupervision } from "@cortex/desk-ui/components/mcp-supervision"
import { RequestSupervision } from "@cortex/desk-ui/components/request-supervision"
import { SectionTabs } from "@cortex/desk-ui/components/section-tabs"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskLocale, deskT } from "@cortex/desk-ui/i18n/server"
import { zl } from "@cortex/desk-ui/lib"
import { ShieldCheck } from "lucide-react"
import { notFound } from "next/navigation"

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

const SECTIONS = ["decisions", "tools", "spending", "log"] as const
type Section = (typeof SECTIONS)[number]

const isSection = (value: unknown): value is Section =>
  typeof value === "string" && (SECTIONS as readonly string[]).includes(value)

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const u = await whoAmI()
  if (u.role !== "management") notFound()
  const [locale, translate] = await Promise.all([deskLocale(), deskT()])

  const asked = (await searchParams)?.section
  const section: Section = isSection(asked) ? asked : "decisions"

  // Liczby do plakietek lecą ZAWSZE — to one mówią, czy warto tam zajrzeć — ale są
  // trzema tanimi zapytaniami zbiorczymi, a nie pobraniem treści czterech sekcji.
  const [waiting, suspended, spentAll] = await Promise.all([
    pool.query<{ n: string }>(
      `select count(*)::text as n from desk.access_request where status='pending'`,
    ),
    pool.query<{ n: string }>(
      `select count(*)::text as n from desk.mcp_tool where status='suspended'`,
    ),
    pool.query<{ total: string }>(
      `select coalesce(sum(cost_usd),0)::text as total from desk.case_file
       where updated_at::date = now()::date`,
    ),
  ])
  const today = Number(spentAll.rows[0]?.total ?? 0)

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
                key: "tools",
                label: translate("supervision.tabTools"),
                count: Number(suspended.rows[0]?.n ?? 0),
                tone: "warn",
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
            {section === "tools" && <McpSupervision />}
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
  const translate = await deskT()
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
                <span className="t-meta w-20 shrink-0">
                  {USERS.find((x) => x.id === w.who)?.firstName ?? w.who}
                </span>
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
    USERS.map(async (x) => ({
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

async function Log() {
  const [locale, translate] = await Promise.all([deskLocale(), deskT()])
  const entries = await audit.latest(40)
  return (
    <section>
      <h2 className="t-section mb-2">{translate("supervision.log")}</h2>
      <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
        {entries.length === 0 && (
          <li className="t-meta px-4 py-3">{translate("supervision.logEmpty")}</li>
        )}
        {entries.map((w, i) => {
          const o = describeEntry({ ...w, at: w.at.toISOString?.() ?? String(w.at) })
          const who = USERS.find((x) => x.id === w.who)
          return (
            <li key={i} className="flex gap-3 px-4 py-2.5">
              <span className="t-meta w-20 shrink-0 tabular-nums">
                {new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(w.at))}
              </span>
              <span
                className={`t-body min-w-0 flex-1 ${o.weight === "important" ? "" : "text-desk-ink-2"}`}
              >
                <span className="font-medium">{who?.firstName ?? w.who}</span> {o.text}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="t-micro pt-2">{translate("supervision.logNote")}</p>
    </section>
  )
}
