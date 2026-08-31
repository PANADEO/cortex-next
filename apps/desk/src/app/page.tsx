import Link from 'next/link'
import { Suspense } from 'react'
import { Powloka } from '@/components/powloka'
import { Zlecenia } from '@/components/zlecenia'
import { ListaSpraw, type WierszSprawy } from '@/components/lista-spraw'
import { ktoTo } from '@/core/tozsamosc'
import { polityka } from '@/core/brama-zdolnosci'
import { pool, migracja } from '@/core/db'
import { policzWyniki } from '@/core/teczka-serwer'

const NA_BIURKU = 12

export default async function Biurko() {
  await migracja()
  const u = await ktoTo()
  const p = await polityka(u)
  const s = await pool.query(
    `select id, tytul, stan, powod, zmieniona from desk.sprawa where wlasciciel=$1 order by zmieniona desc limit $2`,
    [u.id, NA_BIURKU],
  )

  const wyniki = await policzWyniki(u.id, s.rows.map((r) => r.id))
  const sprawy: WierszSprawy[] = s.rows.map((r) => ({
    id: r.id, tytul: r.tytul, stan: r.stan, powod: r.powod,
    zmieniona: r.zmieniona.toISOString(),
    dokumenty: wyniki.get(r.id) ?? 0,
  }))

  return (
    <Powloka>
      <div className="h-full overflow-y-auto pb-pasek md:pb-0">
        <div className="mx-auto max-w-strumien px-5 py-8 md:py-10">
          {/* Powitanie zostaje na stałe — „nikt inny go nie widzi" to obietnica produktu,
              a obietnica wypowiedziana raz i nigdy więcej przestaje działać. Przy pełnym
              biurku schodzi o stopień, żeby nie zabierać miejsca polu zlecenia. */}
          <div className="mb-5">
            <h1 className={sprawy.length === 0 ? 't-display' : 't-h2'}>Dzień dobry, {u.imie}.</h1>
            <p className="mt-0.5 t-meta">To jest Twoje biurko. Nikt inny go nie widzi.</p>
          </div>

          <Suspense>
            <Zlecenia zlecenia={u.zlecenia} polityka={p} maSprawy={sprawy.length} />
          </Suspense>

          <div className="mt-9">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="t-sekcja">Sprawy</h2>
              {sprawy.length >= NA_BIURKU && (
                <Link href="/sprawy" className="t-meta hover:text-ink">Wszystkie →</Link>
              )}
            </div>
            {sprawy.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center t-meta">
                Nie masz jeszcze żadnej sprawy. Zacznij od kafelka powyżej albo napisz własne zlecenie.
              </div>
            ) : (
              <ListaSpraw sprawy={sprawy} />
            )}
          </div>
        </div>
      </div>
    </Powloka>
  )
}
