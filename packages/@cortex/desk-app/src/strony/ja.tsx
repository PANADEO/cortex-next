import { polityka } from "@cortex/desk-core/brama-zdolnosci"
import { ktoTo, UZYTKOWNICY } from "@cortex/desk-core/tozsamosc"
import { Ikona } from "@cortex/desk-ui/components/ikona"
import { Awatar, Persona } from "@cortex/desk-ui/components/persona"
import { Powloka } from "@cortex/desk-ui/components/powloka"
import { t } from "@cortex/desk-ui/trasy"
import { ChevronRight, ListChecks } from "lucide-react"
import Link from "next/link"

/** Zakładka „Ja" istnieje po to, żeby na telefonie było gdzie trzymać rzeczy sprzed sprawy. */
export default async function Strona() {
  const u = await ktoTo()
  const p = await polityka(u)
  return (
    <Powloka>
      <div className="pb-pasek h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="flex items-center gap-3">
            <Awatar u={u} px={48} />
            <div>
              <div className="t-h2">
                {u.imie} {u.nazwisko}
              </div>
              <div className="t-meta">{u.dzial}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border bg-surface">
            <Link
              href={t("/co-potrafie")}
              className="flex h-wiersz items-center gap-2.5 px-4 hover:bg-raised/60"
            >
              <Ikona jako={ListChecks} px={16} klasa="text-cichy" />
              <span className="t-tresc flex-1">Co potrafię</span>
              <span className="t-meta">
                {p.przyznane.length} z {p.przyznane.length + p.zablokowane.length}
              </span>
              <Ikona jako={ChevronRight} px={16} klasa="text-cichy" />
            </Link>
          </div>

          <div className="mt-6 rounded-lg border bg-surface p-3">
            <Persona ja={u} wszyscy={UZYTKOWNICY} />
          </div>

          <p className="t-micro mt-6">
            {
              "Pliki zostają na serwerze firmy. Do modelu trafia tylko ta treść, którą asystent musi przeczytać, żeby wykonać zlecenie."
            }
          </p>
        </div>
      </div>
    </Powloka>
  )
}
