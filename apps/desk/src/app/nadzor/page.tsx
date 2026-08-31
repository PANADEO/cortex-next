import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Powloka } from '@/components/powloka'
import { NadzorProsby } from '@/components/nadzor-prosby'
import { Ikona } from '@/components/ikona'
import { ktoTo, UZYTKOWNICY } from '@cortex/desk-core/tozsamosc'
import { polityka, wydanoDzisiaj } from '@cortex/desk-core/brama-zdolnosci'
import { opiszWpis } from '@cortex/desk-core/dziennik-opis'
import * as dziennik from '@cortex/desk-core/dziennik'
import { zl } from '@/lib'

/** Ekran przełożonego: kto o co prosi, co się dzisiaj działo i ile to kosztowało. */
export default async function Strona() {
  const u = await ktoTo()
  if (u.rola !== 'zarzad') notFound()

  const wpisy = await dziennik.ostatnie(40)
  // czego agent szukał, a katalog tego nie obejmuje — sygnał, że lista zdolności ma dziurę
  const braki = (await dziennik.ostatnie(300))
    .filter((w) => w.typ === 'zdolnosc.brak' && !w.szczegoly?.zdolnosc)
    .slice(0, 8)
  const wydatki = await Promise.all(
    UZYTKOWNICY.map(async (x) => ({ osoba: x, usd: await wydanoDzisiaj(x.id), limit: (await polityka(x)).limitUsdNaDzien })),
  )

  return (
    <Powloka>
      <div className="h-full overflow-y-auto pb-pasek md:pb-0">
        <div className="mx-auto max-w-strumien px-5 py-8">
          <h1 className="t-display">Nadzór</h1>
          <p className="mt-1 t-tresc text-muted">
            Kto o co prosi, co się działo na biurkach i ile to dziś kosztowało.
          </p>

          <div className="mt-7"><NadzorProsby /></div>

          {braki.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 t-sekcja">Czego zabrakło w katalogu</h2>
              <p className="mb-2 t-meta">
                Agent próbował to zrobić i nie znalazł u siebie odpowiedniej umiejętności —
                a katalog jej nie zna. To lista rzeczy do rozważenia jako nowe umiejętności.
              </p>
              <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
                {braki.map((w, i) => (
                  <li key={i} className="flex gap-3 px-4 py-2.5 t-tresc">
                    <span className="w-20 shrink-0 t-meta">
                      {UZYTKOWNICY.find((x) => x.id === w.kto)?.imie ?? w.kto}
                    </span>
                    <span className="min-w-0 flex-1">{String(w.szczegoly?.opis ?? '')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-2 t-sekcja">Dzisiejsze wydatki</h2>
            <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
              {wydatki.map(({ osoba, usd, limit }) => {
                const procent = Math.min(100, Math.round((usd / limit) * 100))
                return (
                  <li key={osoba.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="t-tresc">{osoba.imie} {osoba.nazwisko}</span>
                      <span className="t-meta">{zl(usd)} z {zl(limit)} · {procent}%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-raised">
                      <div
                        className={`h-full rounded-pill ${procent >= 90 ? 'bg-bad' : procent >= 70 ? 'bg-warn' : 'bg-ok'}`}
                        style={{ width: `${Math.max(procent, 2)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 t-sekcja">Co się działo</h2>
            <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
              {wpisy.length === 0 && <li className="px-4 py-3 t-meta">Dziennik jest pusty.</li>}
              {wpisy.map((w, i) => {
                const o = opiszWpis({ ...w, at: w.at.toISOString?.() ?? String(w.at) })
                const kto = UZYTKOWNICY.find((x) => x.id === w.kto)
                return (
                  <li key={i} className="flex gap-3 px-4 py-2.5">
                    <span className="w-20 shrink-0 t-meta">
                      {new Date(w.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`min-w-0 flex-1 t-tresc ${o.waga === 'wazny' ? '' : 'text-ink-2'}`}>
                      <span className="font-medium">{kto?.imie ?? w.kto}</span> {o.tekst}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="pt-2 t-micro">
              Dziennik zapisuje sama aplikacja. Agent nie ma do niego dostępu i nie może go zmienić.
            </p>
          </section>

          <p className="mt-8 flex items-center gap-1.5 t-micro">
            <Ikona jako={ShieldCheck} px={12} /> Ten ekran widzi wyłącznie osoba z rolą zarządu.
          </p>
        </div>
      </div>
    </Powloka>
  )
}
