import Link from 'next/link'
import { ktoTo, UZYTKOWNICY } from '@/core/tozsamosc'
import { polityka } from '@/core/brama-zdolnosci'
import { pool, migracja } from '@/core/db'
import { Persona } from './persona'
import { Toolbox } from './toolbox'
import { kiedy } from '@/lib'

const STAN: Record<string, { k: string; t: string }> = {
  nowa: { k: 'bg-muted', t: 'nowa' },
  pracuje: { k: 'bg-accent puls', t: 'pracuje' },
  gotowe: { k: 'bg-ok', t: 'gotowe' },
  przerwane: { k: 'bg-warn', t: 'przerwane' },
  blad: { k: 'bg-bad', t: 'nie udało się' },
}

export async function Powloka({ children, aktywna }: { children: React.ReactNode; aktywna?: string }) {
  await migracja()
  const u = await ktoTo()
  const p = polityka(u)
  const s = await pool.query(
    `select id, tytul, stan, zmieniona from desk.sprawa where wlasciciel=$1 order by zmieniona desc limit 30`, [u.id],
  )
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-[286px] shrink-0 flex-col border-r bg-surface md:flex">
        <div className="border-b p-3"><Persona ja={u} wszyscy={UZYTKOWNICY} /></div>
        <div className="p-3">
          <Link href="/?nowa=1"
            className="block rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-accent-ink hover:opacity-90">
            + Nowa sprawa
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Moje sprawy</div>
          <ul className="space-y-0.5 px-1.5">
            {s.rows.length === 0 && <li className="px-1.5 py-2 text-sm text-muted">Jeszcze nic tu nie ma.</li>}
            {s.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/sprawa/${r.id}`}
                  className={`flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-raised ${aktywna === r.id ? 'bg-raised font-medium' : ''}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STAN[r.stan]?.k ?? 'bg-muted'}`} />
                  <span className="min-w-0 flex-1 truncate">{r.tytul}</span>
                  <span className="shrink-0 text-[11px] text-muted">{kiedy(r.zmieniona.toISOString())}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Moje pliki</div>
          <div className="px-1.5">
            <Link href="/pliki" className="block rounded-md px-1.5 py-1.5 text-sm hover:bg-raised">📁 Otwórz teczkę</Link>
          </div>
          <Toolbox p={p} />
          <div className="p-3 text-[11px] leading-relaxed text-muted">
            Twoje pliki nie opuszczają serwera firmy.
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
