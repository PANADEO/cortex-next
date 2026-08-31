import { Powloka } from '@cortex/desk-ui/components/powloka'
import { ListaZdolnosci } from '@cortex/desk-ui/components/co-potrafie'
import { ProsbaInna } from '@cortex/desk-ui/components/prosba-inna'
import { ktoTo } from '@cortex/desk-core/tozsamosc'
import { polityka } from '@cortex/desk-core/brama-zdolnosci'

export default async function Strona() {
  const u = await ktoTo()
  const p = await polityka(u)
  return (
    <Powloka>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="t-display">Co potrafię</h1>
          <p className="mt-1 t-tresc text-muted">
            To jest wszystko, co mogę dla Ciebie zrobić w dziale {u.dzial}. Reszta wymaga zgody
            działu, który za nią odpowiada.
          </p>
          <div className="mt-6 rounded-lg border bg-surface p-4">
            <ListaZdolnosci p={p} szukanie />
          </div>
          <div className="mt-4">
            <ProsbaInna />
          </div>
          <p className="mt-4 t-micro">
            Zdolność, której nie mam, nie jest przede mną schowana — po prostu jej u Ciebie nie ma.
            Nie da się mnie namówić na jej użycie.
          </p>
        </div>
      </div>
    </Powloka>
  )
}
