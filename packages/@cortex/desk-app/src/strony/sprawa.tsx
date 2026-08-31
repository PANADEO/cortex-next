import { notFound } from 'next/navigation'
import { Powloka } from '@cortex/desk-ui/components/powloka'
import { SprawaWidok } from '@cortex/desk-ui/components/sprawa-widok'
import { ktoTo } from '@cortex/desk-core/tozsamosc'
import { polityka } from '@cortex/desk-core/brama-zdolnosci'
import { pool, migracja } from '@cortex/desk-core/db'

export default async function Strona({ params }: { params: Promise<{ id: string }> }) {
  await migracja()
  const { id } = await params
  const u = await ktoTo()
  const s = await pool.query(`select wlasciciel from desk.sprawa where id=$1`, [id])
  if (!s.rowCount) notFound()
  if (s.rows[0].wlasciciel !== u.id) {
    return (
      <Powloka>
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <div className="t-h2">To nie jest Twoja sprawa</div>
            <p className="mt-1 t-tresc text-cichy">Każdy pracownik widzi wyłącznie własne biurko.</p>
          </div>
        </div>
      </Powloka>
    )
  }
  const p = await polityka(u)
  return (
    <Powloka aktywna={id} bezPaskaDolnego>
      <SprawaWidok id={id} polityka={p} />
    </Powloka>
  )
}
