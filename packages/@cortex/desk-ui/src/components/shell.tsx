import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { USERS, whoAmI } from "@cortex/desk-core/identity"
import { ChevronRight, FolderOpen, ListChecks, Plus, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { count, when } from "../lib"
import { BASE, t } from "../routes"
import { BottomBar } from "./bottom-bar"
import { Icon } from "./icon"
import { Persona } from "./persona-switcher"
import { ToastProvider } from "./toast"

const DOT: Record<string, string> = {
  new: "bg-desk-muted-2",
  working: "bg-desk-accent pulse",
  done: "bg-desk-ok",
  stopped: "bg-desk-warn",
  failed: "bg-desk-bad",
}

const IN_BAR = 8

export async function Shell({
  children,
  active,
  withoutBottomBar,
}: {
  children: React.ReactNode
  active?: string
  withoutBottomBar?: boolean
}) {
  await migrate()
  const u = await whoAmI()
  const p = await policyFor(u)
  const s = await pool.query(
    `select id, title, status, updated_at as "updatedAt" from desk.case_file where owner=$1 order by updated_at desc limit $2`,
    [u.id, IN_BAR + 1],
  )
  const all = await pool.query<{ total: string }>(
    `select count(*)::text as total from desk.case_file where owner=$1`,
    [u.id],
  )
  const total = Number(all.rows[0]?.total ?? 0)
  const visible = s.rows.slice(0, IN_BAR)

  return (
    <ToastProvider>
      {/* `desk` nie jest klasą narzędziową — to zakres arkusza Biurka. Reguły bazowe
          (krawędzie, tło, paski przewijania, redukcja ruchu) wiszą pod nią, żeby pod
          powłoką nie przemalowały pozostałych kafelków. */}
      <div className="desk flex h-screen overflow-hidden">
        <aside className="hidden w-desk-side shrink-0 flex-col border-r bg-desk-surface md:flex">
          <div className="border-b p-3">
            <Persona ja={u} everyone={USERS} />
          </div>

          <div className="p-3">
            <Link
              href={`${t("/")}?new=1`}
              className="t-btn flex h-9 items-center justify-center gap-1.5 rounded-md bg-desk-accent text-desk-accent-ink hover:bg-desk-accent-hover"
            >
              <Icon as={Plus} px={16} /> Nowa sprawa
            </Link>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto pb-2">
            <div className="t-section px-3 pb-1.5">Sprawy</div>
            <ul className="px-2">
              {visible.length === 0 && (
                <li className="t-meta px-1.5 py-1.5">Twoje sprawy pojawią się tutaj.</li>
              )}
              {visible.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`${BASE}/case/${r.id}`}
                    aria-current={active === r.id ? "page" : undefined}
                    className={`t-body relative flex h-9 items-center gap-2 rounded-sm pl-2.5 pr-2 hover:bg-desk-raised/70 ${
                      active === r.id ? "bg-desk-raised font-medium" : ""
                    }`}
                  >
                    {active === r.id && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-desk-pill bg-desk-accent"
                      />
                    )}
                    <span
                      className={`h-2 w-2 shrink-0 rounded-desk-pill ${DOT[r.status] ?? "bg-desk-muted-2"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <span className="t-micro shrink-0">{when(r.updatedAt.toISOString())}</span>
                  </Link>
                </li>
              ))}
              {total > IN_BAR && (
                <li>
                  <Link
                    href={t("/cases")}
                    className="t-meta flex h-8 items-center gap-1 rounded-sm px-2.5 hover:bg-desk-raised/70"
                  >
                    Wszystkie sprawy ({total}) <Icon as={ChevronRight} px={12} />
                  </Link>
                </li>
              )}
            </ul>

            <div className="mt-4 px-2">
              <Link
                href={t("/files")}
                className="t-body flex h-9 items-center gap-2 rounded-sm px-2.5 hover:bg-desk-raised/70"
              >
                <Icon as={FolderOpen} px={16} className="text-desk-muted" /> Moje pliki
              </Link>
              {u.role === "management" && (
                <Link
                  href={t("/supervision")}
                  className="t-body flex h-9 items-center gap-2 rounded-sm px-2.5 hover:bg-desk-raised/70"
                >
                  <Icon as={ShieldCheck} px={16} className="text-desk-muted" /> Nadzór
                </Link>
              )}
            </div>
          </nav>

          <div className="border-t p-3">
            <Link
              href={t("/capabilities")}
              className="t-meta flex items-center gap-1.5 hover:text-desk-ink"
            >
              <Icon as={ListChecks} px={14} />
              Umiem {p.granted.length} z{" "}
              {count(p.granted.length + p.blocked.length, "rzeczy", "rzeczy", "rzeczy")}
              <Icon as={ChevronRight} px={12} />
            </Link>
            <p className="t-micro pt-1.5">
              {
                "Pliki zostają na serwerze firmy. Do modelu trafia tylko ta treść, którą asystent musi przeczytać, żeby wykonać zlecenie."
              }
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      {!withoutBottomBar && <BottomBar />}
    </ToastProvider>
  )
}
