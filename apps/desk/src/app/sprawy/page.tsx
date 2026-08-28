import { Powloka } from '@/components/powloka'
import { ListaSpraw, type WierszSprawy } from '@/components/lista-spraw'
import { ktoTo } from '@/core/tozsamosc'
import { pool, migracja } from '@/core/db'
import * as biurko from '@/core/biurko'

export default async function Strona() {
  await migracja()
  const u = await ktoTo()
  const s = await pool.query(
    `select id, tytul, stan, powod, zmieniona from desk.sprawa where wlasciciel=$1 order by zmieniona desc limit 200`,
    [u.id],
  )
  const sprawy: WierszSprawy[] = await Promise.all(
    s.rows.map(async (r) => ({
      id: r.id, tytul: r.tytul, stan: r.stan, powod: r.powod,
      zmieniona: r.zmieniona.toISOString(),
      dokumenty: (await biurko.lista(u.id, biurko.katalogSprawy(u.id, r.id)).catch(() => []))
        .filter((x) => !x.katalog).length,
    })),
  )
  return (
    <Powloka>
      <div className="h-full overflow-y-auto pb-pasek md:pb-0">
        <div className="mx-auto max-w-strumien px-5 py-8">
          <h1 className="t-display">Wszystkie sprawy</h1>
          <p className="mt-1 t-tresc text-muted">Sprawy zostają na biurku — możesz wrócić do każdej.</p>
          <div className="mt-6">
            {sprawy.length === 0
              ? <div className="rounded-lg border border-dashed p-6 text-center t-meta">Twoje sprawy pojawią się tutaj.</div>
              : <ListaSpraw sprawy={sprawy} />}
          </div>
        </div>
      </div>
    </Powloka>
  )
}
