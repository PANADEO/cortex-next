import { notFound } from 'next/navigation'
import { Powloka } from '@/components/powloka'
import { SprawaWidok } from '@/components/sprawa-widok'
import { ktoTo } from '@/core/tozsamosc'
import { polityka } from '@/core/brama-zdolnosci'
import { pool, migracja } from '@/core/db'

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
            <div className="text-lg font-medium">To nie jest Twoja sprawa</div>
            <p className="mt-1 text-sm text-muted">Każdy pracownik widzi wyłącznie własne biurko.</p>
          </div>
        </div>
      </Powloka>
    )
  }
  const p = polityka(u)
  return (
    <Powloka aktywna={id}>
      <SprawaWidok id={id} zdolnosci={p.przyznane.map((z) => z.id)} />
    </Powloka>
  )
}
