import { Powloka } from '@cortex/desk-ui/components/powloka'
import { ListaSpraw, type WierszSprawy } from '@cortex/desk-ui/components/lista-spraw'
import { ktoTo } from '@cortex/desk-core/tozsamosc'
import { pool, migracja } from '@cortex/desk-core/db'
import { policzWyniki } from '@cortex/desk-core/teczka-serwer'

export default async function Strona() {
  await migracja()
  const u = await ktoTo()
  const s = await pool.query(
    `select id, tytul, stan, powod, zmieniona from desk.sprawa where wlasciciel=$1 order by zmieniona desc limit 200`,
    [u.id],
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
        <div className="mx-auto max-w-strumien px-5 py-8">
          <h1 className="t-display">Wszystkie sprawy</h1>
          <p className="mt-1 t-tresc text-cichy">Sprawy zostają na biurku — możesz wrócić do każdej.</p>
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
