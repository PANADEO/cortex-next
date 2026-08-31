import Link from 'next/link'
import { ChevronRight, ListChecks } from 'lucide-react'
import { Powloka } from '@cortex/desk-ui/components/powloka'
import { Persona, Awatar } from '@cortex/desk-ui/components/persona'
import { Ikona } from '@cortex/desk-ui/components/ikona'
import { ktoTo, UZYTKOWNICY } from '@cortex/desk-core/tozsamosc'
import { polityka } from '@cortex/desk-core/brama-zdolnosci'

/** Zakładka „Ja" istnieje po to, żeby na telefonie było gdzie trzymać rzeczy sprzed sprawy. */
export default async function Strona() {
  const u = await ktoTo()
  const p = await polityka(u)
  return (
    <Powloka>
      <div className="h-full overflow-y-auto pb-pasek">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="flex items-center gap-3">
            <Awatar u={u} px={48} />
            <div>
              <div className="t-h2">{u.imie} {u.nazwisko}</div>
              <div className="t-meta">{u.dzial}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border bg-surface">
            <Link href="/co-potrafie" className="flex h-wiersz items-center gap-2.5 px-4 hover:bg-raised/60">
              <Ikona jako={ListChecks} px={16} klasa="text-muted" />
              <span className="flex-1 t-tresc">Co potrafię</span>
              <span className="t-meta">{p.przyznane.length} z {p.przyznane.length + p.zablokowane.length}</span>
              <Ikona jako={ChevronRight} px={16} klasa="text-muted" />
            </Link>
          </div>

          <div className="mt-6 rounded-lg border bg-surface p-3">
            <Persona ja={u} wszyscy={UZYTKOWNICY} />
          </div>

          <p className="mt-6 t-micro">{'Pliki zostają na serwerze firmy. Do modelu trafia tylko ta treść, którą asystent musi przeczytać, żeby wykonać zlecenie.'}</p>
        </div>
      </div>
    </Powloka>
  )
}
