import { polityka } from "@cortex/desk-core/brama-zdolnosci"
import { ktoTo } from "@cortex/desk-core/tozsamosc"
import { ListaZdolnosci } from "@cortex/desk-ui/components/co-potrafie"
import { Powloka } from "@cortex/desk-ui/components/powloka"
import { ProsbaInna } from "@cortex/desk-ui/components/prosba-inna"

export default async function Strona() {
  const u = await ktoTo()
  const p = await polityka(u)
  return (
    <Powloka>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="t-display">Co potrafię</h1>
          <p className="t-tresc mt-1 text-cichy">
            To jest wszystko, co mogę dla Ciebie zrobić w dziale {u.dzial}. Reszta wymaga zgody
            działu, który za nią odpowiada.
          </p>
          <div className="mt-6 rounded-lg border bg-surface p-4">
            <ListaZdolnosci p={p} szukanie />
          </div>
          <div className="mt-4">
            <ProsbaInna />
          </div>
          <p className="t-micro mt-4">
            Zdolność, której nie mam, nie jest przede mną schowana — po prostu jej u Ciebie nie ma.
            Nie da się mnie namówić na jej użycie.
          </p>
        </div>
      </div>
    </Powloka>
  )
}
