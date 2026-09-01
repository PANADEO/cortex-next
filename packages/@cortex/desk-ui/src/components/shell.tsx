import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { USERS, identity } from "@cortex/desk-core/identity"
import { ChevronRight, FolderOpen, LayoutGrid, ListChecks, Plus, ShieldCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { DeskLocaleProvider } from "../i18n/client"
import { deskLocale, deskT } from "../i18n/server"
import { when } from "../lib"
import { BASE, HUB, MOUNTED_IN_SHELL, t } from "../routes"
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
  const [locale, translate] = await Promise.all([deskLocale(), deskT()])
  const { user: u, switchable } = await identity()
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
    <DeskLocaleProvider locale={locale}>
      <ToastProvider>
        {/* `desk` nie jest klasą narzędziową — to zakres arkusza Biurka. Reguły bazowe
          (krawędzie, tło, paski przewijania, redukcja ruchu) wiszą pod nią, żeby pod
          powłoką nie przemalowały pozostałych kafelków. */}
        <div className="desk flex h-screen overflow-hidden">
          <aside className="hidden w-desk-side shrink-0 flex-col border-r bg-desk-surface md:flex">
            {/* Wyjście do katalogu aplikacji stoi NA GÓRZE, a osoba na dole — odwrotnie
              niż dotąd. Powód jest jeden i nie jest estetyczny: z kafelka nie dało się
              wyjść inaczej niż przez pasek adresu, bo jedyną rzeczą u góry była
              wizytówka. Logo w lewym górnym rogu wraca do początku w każdym produkcie,
              który ten użytkownik zna, więc tam go szuka. Tak samo robi Cortex Cowork. */}
            {MOUNTED_IN_SHELL && (
              <Link
                href={HUB}
                title={translate("shell.hub")}
                aria-label={translate("shell.hub")}
                className="flex h-desk-bar shrink-0 items-center gap-2 border-b px-4 hover:bg-desk-raised/70"
              >
                <Image
                  src="/cortex-logo.png"
                  alt=""
                  width={20}
                  height={20}
                  className="shrink-0 dark:hue-rotate-180 dark:invert"
                />
                <span className="t-body-m min-w-0 flex-1 truncate">
                  {translate("shell.product")}
                </span>
                <Icon as={LayoutGrid} px={16} className="shrink-0 text-desk-muted" />
              </Link>
            )}

            <div className="p-3">
              <Link
                href={`${t("/")}?new=1`}
                className="t-btn flex h-9 items-center justify-center gap-1.5 rounded-md bg-desk-accent text-desk-accent-ink hover:bg-desk-accent-hover"
              >
                <Icon as={Plus} px={16} /> {translate("shell.newCase")}
              </Link>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto pb-2">
              <div className="t-section px-3 pb-1.5">{translate("shell.cases")}</div>
              <ul className="px-2">
                {visible.length === 0 && (
                  <li className="t-meta px-1.5 py-1.5">{translate("shell.casesEmpty")}</li>
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
                      <span className="t-micro shrink-0">
                        {when(r.updatedAt.toISOString(), locale)}
                      </span>
                    </Link>
                  </li>
                ))}
                {total > IN_BAR && (
                  <li>
                    <Link
                      href={t("/cases")}
                      className="t-meta flex h-8 items-center gap-1 rounded-sm px-2.5 hover:bg-desk-raised/70"
                    >
                      {translate("shell.allCases", { count: total })}{" "}
                      <Icon as={ChevronRight} px={12} />
                    </Link>
                  </li>
                )}
              </ul>

              <div className="mt-4 px-2">
                <Link
                  href={t("/files")}
                  className="t-body flex h-9 items-center gap-2 rounded-sm px-2.5 hover:bg-desk-raised/70"
                >
                  <Icon as={FolderOpen} px={16} className="text-desk-muted" />{" "}
                  {translate("shell.myFiles")}
                </Link>
                {u.role === "management" && (
                  <Link
                    href={t("/supervision")}
                    className="t-body flex h-9 items-center gap-2 rounded-sm px-2.5 hover:bg-desk-raised/70"
                  >
                    <Icon as={ShieldCheck} px={16} className="text-desk-muted" />{" "}
                    {translate("shell.supervision")}
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
                {translate("shell.skills", {
                  granted: p.granted.length,
                  count: p.granted.length + p.blocked.length,
                })}
                <Icon as={ChevronRight} px={12} />
              </Link>
              <p className="t-micro pt-1.5">{translate("shell.privacy")}</p>
            </div>

            <div className="border-t p-3">
              {/* Menu stoi ZAWSZE, bo niesie też język i wygląd. Lista osób jest pusta,
                gdy przełączenie nic by nie zmieniło — patrz `identity().switchable`. */}
              <Persona me={u} everyone={switchable ? USERS : []} />
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        </div>
        {!withoutBottomBar && <BottomBar />}
      </ToastProvider>
    </DeskLocaleProvider>
  )
}
