import * as audit from "@cortex/desk-core/audit-log"
import { describeEntry } from "@cortex/desk-core/audit-log-text"
import { policyFor, spentToday } from "@cortex/desk-core/capability-gate"
import { USERS, whoAmI } from "@cortex/desk-core/identity"
import { Icon } from "@cortex/desk-ui/components/icon"
import { McpSupervision } from "@cortex/desk-ui/components/mcp-supervision"
import { RequestSupervision } from "@cortex/desk-ui/components/request-supervision"
import { Shell } from "@cortex/desk-ui/components/shell"
import { zl } from "@cortex/desk-ui/lib"
import { ShieldCheck } from "lucide-react"
import { notFound } from "next/navigation"

/** Ekran przełożonego: kto o co prosi, co się dzisiaj działo i ile to kosztowało. */
export default async function Page() {
  const u = await whoAmI()
  if (u.role !== "management") notFound()

  const entries = await audit.latest(40)
  // czego agent szukał, a katalog tego nie obejmuje — sygnał, że lista zdolności ma dziurę
  const gaps = (await audit.latest(300))
    .filter((w) => w.type === "capability.missing" && !w.details?.capability)
    .slice(0, 8)
  const spending = await Promise.all(
    USERS.map(async (x) => ({
      person: x,
      usd: await spentToday(x.id),
      limit: (await policyFor(x)).dailyLimitUsd,
    })),
  )

  return (
    <Shell>
      <div className="h-full overflow-y-auto pb-desk-bar md:pb-0">
        <div className="mx-auto max-w-desk-stream px-5 py-8">
          <h1 className="t-display">Nadzór</h1>
          <p className="t-body mt-1 text-desk-muted">
            Kto o co prosi, co się działo na biurkach i ile to dziś kosztowało.
          </p>

          <div className="mt-7">
            <RequestSupervision />
          </div>

          <McpSupervision />

          {gaps.length > 0 && (
            <section className="mt-8">
              <h2 className="t-section mb-1">Czego zabrakło w katalogu</h2>
              <p className="t-meta mb-2">
                Agent próbował to zrobić i nie znalazł u siebie odpowiedniej umiejętności — a
                katalog jej nie zna. To lista rzeczy do rozważenia jako nowe umiejętności.
              </p>
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

          <section className="mt-8">
            <h2 className="t-section mb-2">Dzisiejsze wydatki</h2>
            <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
              {spending.map(({ person, usd, limit }) => {
                const procent = Math.min(100, Math.round((usd / limit) * 100))
                return (
                  <li key={person.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="t-body">
                        {person.firstName} {person.lastName}
                      </span>
                      <span className="t-meta">
                        {zl(usd)} z {zl(limit)} · {procent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-desk-pill bg-desk-raised">
                      <div
                        className={`h-full rounded-desk-pill ${procent >= 90 ? "bg-desk-bad" : procent >= 70 ? "bg-desk-warn" : "bg-desk-ok"}`}
                        style={{ width: `${Math.max(procent, 2)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="t-section mb-2">Co się działo</h2>
            <ul className="divide-y overflow-hidden rounded-lg border bg-desk-surface">
              {entries.length === 0 && <li className="t-meta px-4 py-3">Dziennik jest pusty.</li>}
              {entries.map((w, i) => {
                const o = describeEntry({ ...w, at: w.at.toISOString?.() ?? String(w.at) })
                const who = USERS.find((x) => x.id === w.who)
                return (
                  <li key={i} className="flex gap-3 px-4 py-2.5">
                    <span className="t-meta w-20 shrink-0">
                      {new Date(w.at).toLocaleTimeString("pl-PL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
            <p className="t-micro pt-2">
              Dziennik zapisuje sama aplikacja. Agent nie ma do niego dostępu i nie może go zmienić.
            </p>
          </section>

          <p className="t-micro mt-8 flex items-center gap-1.5">
            <Icon as={ShieldCheck} px={12} /> Ten ekran widzi wyłącznie osoba z rolą zarządu.
          </p>
        </div>
      </div>
    </Shell>
  )
}
