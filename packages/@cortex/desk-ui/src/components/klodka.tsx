'use client'
import { useState } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { Ikona } from './ikona'
import { useToast } from './toast'
import { api } from '../trasy'

/**
 * Moment, w którym governance przestaje być slajdem i staje się rzeczą na ekranie.
 * Kłódka jest szara, nie pomarańczowa ani czerwona — to nie awaria, tylko polityka firmy.
 */
export function Klodka({ opis, nazwa, dzial, zdolnoscId, juzPoproszono }: {
  opis: string
  nazwa?: string
  dzial?: string
  zdolnoscId?: string
  juzPoproszono?: boolean
}) {
  const [wyslane, setWyslane] = useState(Boolean(juzPoproszono))
  const [zajete, setZajete] = useState(false)
  const { pokaz } = useToast()

  async function popros() {
    if (!zdolnoscId) return
    setZajete(true)
    const r = await fetch(api('/prosba'), { method: 'POST', body: JSON.stringify({ zdolnosc: zdolnoscId }) })
    setZajete(false)
    if (!r.ok) { pokaz({ tekst: 'Nie udało się wysłać prośby.', ton: 'blad' }); return }
    setWyslane(true)
    pokaz({ tekst: `Prośba o „${nazwa}" poszła do działu ${dzial}.` })
  }

  return (
    <div className="flex max-w-miara gap-2.5 rounded-lg border bg-surface px-3.5 py-3">
      <Ikona jako={Lock} px={16} klasa="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0">
        <div className="t-tresc">
          {nazwa
            ? <>Do tego potrzebuję zdolności <span className="font-medium">„{nazwa}"</span>, której nie masz włączonej.</>
            : <>Tego nie umiem zrobić przy Twoich uprawnieniach.</>}
        </div>
        <div className="mt-0.5 t-meta">
          Chodziło o: {opis}{dzial ? ` · zgodę wydaje dział ${dzial}` : ''}
        </div>
        {zdolnoscId && (
          wyslane ? (
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ok">
              <Ikona jako={ShieldCheck} px={12} /> Prośba wysłana — czeka na rozpatrzenie
            </div>
          ) : (
            <button
              onClick={popros} disabled={zajete}
              className="mt-2 rounded-md border px-2.5 py-1 t-btn hover:bg-raised disabled:opacity-50"
            >Poproś o dostęp</button>
          )
        )}
      </div>
    </div>
  )
}
