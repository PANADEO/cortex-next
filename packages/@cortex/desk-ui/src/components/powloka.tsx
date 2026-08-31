import Link from 'next/link'
import { Plus, FolderOpen, ListChecks, ChevronRight, ShieldCheck } from 'lucide-react'
import { ktoTo, UZYTKOWNICY } from '@cortex/desk-core/tozsamosc'
import { polityka } from '@cortex/desk-core/brama-zdolnosci'
import { pool, migracja } from '@cortex/desk-core/db'
import { Persona } from './persona'
import { PasekDolny } from './pasek-dolny'
import { DostawcaTostow } from './toast'
import { Ikona } from './ikona'
import { kiedy, ile } from '../lib'
import { BAZA, t } from '../trasy'

const KROPKA: Record<string, string> = {
  nowa: 'bg-muted-cichy',
  pracuje: 'bg-accent puls',
  gotowe: 'bg-ok',
  przerwane: 'bg-warn',
  blad: 'bg-bad',
}

const W_PASKU = 8

export async function Powloka({ children, aktywna, bezPaskaDolnego }: {
  children: React.ReactNode
  aktywna?: string
  bezPaskaDolnego?: boolean
}) {
  await migracja()
  const u = await ktoTo()
  const p = await polityka(u)
  const s = await pool.query(
    `select id, tytul, stan, zmieniona from desk.sprawa where wlasciciel=$1 order by zmieniona desc limit $2`,
    [u.id, W_PASKU + 1],
  )
  const wszystkich = await pool.query<{ n: string }>(
    `select count(*)::text as n from desk.sprawa where wlasciciel=$1`, [u.id],
  )
  const razem = Number(wszystkich.rows[0]?.n ?? 0)
  const widoczne = s.rows.slice(0, W_PASKU)

  return (
    <DostawcaTostow>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden w-boczny shrink-0 flex-col border-r bg-surface md:flex">
          <div className="border-b p-3"><Persona ja={u} wszyscy={UZYTKOWNICY} /></div>

          <div className="p-3">
            <Link
              href={`${t("/")}?nowa=1`}
              className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-accent t-btn text-accent-ink hover:bg-accent-hover"
            >
              <Ikona jako={Plus} px={16} /> Nowa sprawa
            </Link>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto pb-2">
            <div className="px-3 pb-1.5 t-sekcja">Sprawy</div>
            <ul className="px-2">
              {widoczne.length === 0 && (
                <li className="px-1.5 py-1.5 t-meta">Twoje sprawy pojawią się tutaj.</li>
              )}
              {widoczne.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`${BAZA}/sprawa/${r.id}`}
                    aria-current={aktywna === r.id ? 'page' : undefined}
                    className={`relative flex h-9 items-center gap-2 rounded-sm pl-2.5 pr-2 t-tresc hover:bg-raised/70 ${
                      aktywna === r.id ? 'bg-raised font-medium' : ''}`}
                  >
                    {aktywna === r.id && (
                      <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-pill bg-accent" />
                    )}
                    <span className={`h-2 w-2 shrink-0 rounded-pill ${KROPKA[r.stan] ?? 'bg-muted-cichy'}`} />
                    <span className="min-w-0 flex-1 truncate">{r.tytul}</span>
                    <span className="shrink-0 t-micro">{kiedy(r.zmieniona.toISOString())}</span>
                  </Link>
                </li>
              ))}
              {razem > W_PASKU && (
                <li>
                  <Link href={t("/sprawy")} className="flex h-8 items-center gap-1 rounded-sm px-2.5 t-meta hover:bg-raised/70">
                    Wszystkie sprawy ({razem}) <Ikona jako={ChevronRight} px={12} />
                  </Link>
                </li>
              )}
            </ul>

            <div className="mt-4 px-2">
              <Link href={t("/pliki")} className="flex h-9 items-center gap-2 rounded-sm px-2.5 t-tresc hover:bg-raised/70">
                <Ikona jako={FolderOpen} px={16} klasa="text-muted" /> Moje pliki
              </Link>
              {u.rola === 'zarzad' && (
                <Link href={t("/nadzor")} className="flex h-9 items-center gap-2 rounded-sm px-2.5 t-tresc hover:bg-raised/70">
                  <Ikona jako={ShieldCheck} px={16} klasa="text-muted" /> Nadzór
                </Link>
              )}
            </div>
          </nav>

          <div className="border-t p-3">
            <Link href={t("/co-potrafie")} className="flex items-center gap-1.5 t-meta hover:text-ink">
              <Ikona jako={ListChecks} px={14} />
              Umiem {p.przyznane.length} z {ile(p.przyznane.length + p.zablokowane.length, 'rzeczy', 'rzeczy', 'rzeczy')}
              <Ikona jako={ChevronRight} px={12} />
            </Link>
            <p className="pt-1.5 t-micro">{'Pliki zostają na serwerze firmy. Do modelu trafia tylko ta treść, którą asystent musi przeczytać, żeby wykonać zlecenie.'}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      {!bezPaskaDolnego && <PasekDolny />}
    </DostawcaTostow>
  )
}
