import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { identity } from "@cortex/desk-core/identity"
import { everyone } from "@cortex/desk-core/people"
import type { LucideIcon } from "lucide-react"
import { Brain, FolderOpen, LayoutGrid, LayoutList, Plus, ShieldCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { DeskLocaleProvider } from "../i18n/client"
import { deskLocale, deskT } from "../i18n/server"
import { HUB, MOUNTED_IN_SHELL, t } from "../routes"
import { BottomBar } from "./bottom-bar"
import { DemoBar } from "./demo-bar"
import { Icon } from "./icon"
import { LocaleBridge } from "./locale-bridge"
import { Persona } from "./persona-switcher"
import { ToastProvider } from "./toast"



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
  if (u.active === false) {
    // Zdanie zamiast strony błędu. Konto zostaje razem ze swoimi sprawami i dziennikiem
    // — nie kasuje się dowodu razem z odejściem człowieka z firmy.
    return (
      <DeskLocaleProvider locale={locale}>
        <div className="desk grid h-full place-items-center p-8 text-center">
          <div>
            <div className="t-h2">{translate("shell.disabledTitle")}</div>
            <p className="t-body mt-1 text-desk-muted">{translate("shell.disabledLead")}</p>
          </div>
        </div>
      </DeskLocaleProvider>
    )
  }
  const p = await policyFor(u)
  // LICZBA, NIE LISTA. Do 03.09.2026 pasek pokazywał osiem ostatnich spraw — czyli
  // DOKŁADNIE TĘ SAMĄ listę, którą ekran główny rysuje pod polem zlecenia. Powielenie
  // kosztowało do trzynastu klikalnych elementów w kolumnie, po której pani Basia wodzi
  // wzrokiem szukając czterech stałych miejsc. Znika duplikat, nie droga: sprawy stoją
  // na „/" i na „/cases", a tutaj zostaje liczba, która mówi, ile ich jest.
  const all = await pool.query<{ total: string }>(
    `select count(*)::text as total from desk.case_file where owner=$1`,
    [u.id],
  )
  const total = Number(all.rows[0]?.total ?? 0)
  // Propozycja pamięci czeka na CZŁOWIEKA i nie działa, dopóki jej nie przyjmie —
  // więc musi być widoczna stąd, a nie dopiero po wejściu na ekran pamięci.
  const waitingMemory = await pool.query<{ n: string }>(
    `select count(*)::text as n from desk.memory where owner=$1 and status='proposed'`,
    [u.id],
  )
  const proposed = Number(waitingMemory.rows[0]?.n ?? 0)

  return (
    <DeskLocaleProvider locale={locale}>
      <ToastProvider>
        {/* `desk` nie jest klasą narzędziową — to zakres arkusza Biurka. Reguły bazowe
          (krawędzie, tło, paski przewijania, redukcja ruchu) wiszą pod nią, żeby pod
          powłoką nie przemalowały pozostałych kafelków. */}
        {/* Most języka wisi na POWŁOCE, nie na menu osoby, którego już nie ma. */}
        <LocaleBridge />
        <div className="desk flex h-screen flex-col overflow-hidden">
          {/* `switchable` czytamy z `identity()`, nie drugim odczytem zmiennej
            środowiskowej — dwa źródła tej samej prawdy rozjeżdżają się zawsze. */}
          {switchable && <DemoBar me={u} everyone={await everyone()} />}
          <div className="flex min-h-0 flex-1 overflow-hidden">
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

            {/* PIĘĆ MIEJSC. Tyle ich jest i tyle ma zostać — pracownica ma tu wodzić
              wzrokiem po stałej, krótkiej kolumnie, a nie czytać zmienną listę. Nadzór
              jest szósty i wyłącznie dla przełożonego. */}
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <Place href={t("/cases")} icon={LayoutList} label={translate("shell.cases")} count={total} />
              <Place href={t("/files")} icon={FolderOpen} label={translate("shell.myFiles")} />
              <Place
                href={t("/memory")}
                icon={Brain}
                label={translate("shell.memory")}
                count={proposed}
                highlight
              />
              {u.role === "management" && (
                <Place
                  href={t("/supervision")}
                  icon={ShieldCheck}
                  label={translate("shell.supervision")}
                />
              )}
            </nav>

            {/* Zdanie o prywatności zostaje: to jedyne miejsce w produkcie, które mówi
              wprost, gdzie są pliki. Nie jest klikalne, więc nie dokłada się do pięciu. */}
            <div className="border-t p-3">
              <p className="t-micro">{translate("shell.privacy")}</p>
            </div>

            {/* Wizytówka jest LINKIEM do „Ja", nie menu — patrz `persona-switcher.tsx`. */}
            <div className="border-t p-3">
              <Persona me={u} />
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
        {!withoutBottomBar && <BottomBar />}
      </ToastProvider>
    </DeskLocaleProvider>
  )
}

/**
 * JEDNO MIEJSCE W SZAFCE. Wszystkie mają ten sam wzrost, ten sam odstęp i tę samą
 * pozycję liczby — bo kolumna, po której wodzi się wzrokiem, działa dzięki powtarzalności,
 * a nie dzięki temu, że każdy wiersz jest ładny osobno.
 *
 * `highlight` niesie znaczenie, nie ozdobę: wyróżniona jest liczba rzeczy, które CZEKAJĄ
 * NA CZŁOWIEKA (propozycje pamięci). Liczba spraw czeka na nikogo i stoi szaro.
 */
function Place({
  href,
  icon,
  label,
  count,
  highlight,
}: {
  href: string
  icon: LucideIcon
  label: string
  count?: number
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className="t-body flex h-desk-row items-center gap-2.5 rounded-md px-2.5 hover:bg-desk-raised/70"
    >
      <Icon as={icon} px={16} className="shrink-0 text-desk-muted" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`t-micro shrink-0 tabular-nums ${
            highlight
              ? "rounded-desk-pill bg-desk-accent-soft px-1.5 text-desk-accent-soft-ink"
              : "text-desk-muted"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  )
}
