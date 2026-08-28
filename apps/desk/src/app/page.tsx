import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Powloka } from '@/components/powloka'
import { ktoTo } from '@/core/tozsamosc'
import { polityka } from '@/core/brama-zdolnosci'
import { pool, migracja } from '@/core/db'
import { Zlecenia } from '@/components/zlecenia'
import { kiedy } from '@/lib'

const ETYKIETA: Record<string, string> = {
  nowa: 'nowa', pracuje: 'pracuje', gotowe: 'gotowe', przerwane: 'przerwane', blad: 'nie udało się',
}
const KROPKA: Record<string, string> = {
  nowa: 'bg-muted', pracuje: 'bg-accent puls', gotowe: 'bg-ok', przerwane: 'bg-warn', blad: 'bg-bad',
}

export default async function Biurko({ searchParams }: { searchParams: Promise<{ nowa?: string }> }) {
  await migracja()
  const sp = await searchParams
  const u = await ktoTo()
  const p = polityka(u)
  const s = await pool.query(
    `select id, tytul, stan, powod, zmieniona from desk.sprawa where wlasciciel=$1 order by zmieniona desc limit 20`, [u.id],
  )
  if (sp.nowa) redirect('/')

  return (
    <Powloka>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
          <h1 className="text-2xl font-semibold md:text-[28px]">Dzień dobry, {u.imie}.</h1>
          <p className="mt-1 text-muted">To jest Twoje biurko. Nikt inny go nie widzi.</p>

          <Zlecenia zlecenia={u.zlecenia} />

          <div className="mt-10">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Moje sprawy</h2>
              <Link href="/pliki" className="text-sm text-muted underline-offset-2 hover:underline md:hidden">Moje pliki →</Link>
            </div>
            {s.rows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted">
                Nie masz jeszcze żadnej sprawy. Zacznij od kafelka powyżej albo napisz własne zlecenie.
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
                {s.rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/sprawa/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${KROPKA[r.stan]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.tytul}</span>
                        <span className="block truncate text-xs text-muted">
                          {ETYKIETA[r.stan]}{r.powod ? ` · ${r.powod}` : ''} · {kiedy(r.zmieniona.toISOString())}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-10 md:hidden">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Co potrafię</h2>
            <ul className="space-y-1 rounded-xl border bg-surface p-3 text-sm">
              {p.przyznane.map((z) => <li key={z.id} className="flex gap-2"><span className="text-ok">✓</span>{z.nazwa}</li>)}
              {p.zablokowane.map((z) => (
                <li key={z.id} className="flex gap-2 text-muted"><span>🔒</span>{z.nazwa} <span className="text-[11px]">· dział: {z.dzial}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Powloka>
  )
}
