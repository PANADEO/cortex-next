'use client'
import { useCallback, useEffect, useState } from 'react'
import { Check, X, ShieldCheck, Inbox } from 'lucide-react'
import { Ikona } from './ikona'
import { useToast } from './toast'
import { kiedy } from '../lib'
import { api } from '../trasy'

type Prosba = {
  id: number; kto: string; ktoImie: string; zdolnosc: string
  nazwa: string; dzial: string; stan: string; at: string
  uzasadnienie: string | null
}

export function NadzorProsby() {
  const [prosby, setProsby] = useState<Prosba[]>([])
  const [zajete, setZajete] = useState<number | null>(null)
  const { pokaz } = useToast()

  const odswiez = useCallback(async () => {
    const r = await fetch(api('/prosba'), { cache: 'no-store' })
    const d = await r.json()
    setProsby(d.prosby ?? [])
  }, [])
  useEffect(() => { odswiez() }, [odswiez])

  async function cofnij(p: Prosba) {
    setZajete(p.id)
    const r = await fetch(api('/prosba'), { method: 'PATCH', body: JSON.stringify({ id: p.id, cofnij: true }) })
    setZajete(null)
    await odswiez()
    pokaz(r.ok
      ? { tekst: `Zdolność „${p.nazwa}" cofnięta osobie ${p.ktoImie}.` }
      : { tekst: 'Nie udało się cofnąć.', ton: 'blad' })
  }

  async function rozpatrz(p: Prosba, decyzja: 'przyznana' | 'odrzucona') {
    setZajete(p.id)
    const r = await fetch(api('/prosba'), {
      method: 'PATCH', body: JSON.stringify({ id: p.id, decyzja }),
    })
    setZajete(null)
    await odswiez()
    if (!r.ok) { pokaz({ tekst: 'Nie udało się zapisać decyzji.', ton: 'blad' }); return }
    pokaz({
      tekst: decyzja === 'przyznana'
        ? `${p.ktoImie} ma teraz zdolność „${p.nazwa}".`
        : `Odmowa zapisana. ${p.ktoImie} zobaczy, że prośba została rozpatrzona.`,
    })
  }

  const oczekujace = prosby.filter((p) => p.stan === 'oczekuje')
  const rozpatrzone = prosby.filter((p) => p.stan !== 'oczekuje')

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 t-sekcja">Czekają na Twoją decyzję</h2>
        {oczekujace.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Ikona jako={Inbox} px={20} klasa="mx-auto text-muted-cichy" />
            <p className="mt-1.5 t-meta">Nic nie czeka.</p>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
            {oczekujace.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  {p.zdolnosc === 'inne' ? (
                    <>
                      <span className="block t-tresc">
                        <span className="font-medium">{p.ktoImie}</span> prosi o coś, czego nie ma w katalogu:
                      </span>
                      <span className="mt-0.5 block rounded-md bg-raised/60 px-2.5 py-1.5 t-tresc">
                        {p.uzasadnienie}
                      </span>
                      <span className="mt-1 block t-meta">{kiedy(p.at)} · tego nie da się przyznać kliknięciem</span>
                    </>
                  ) : (
                    <>
                      <span className="block t-tresc">
                        <span className="font-medium">{p.ktoImie}</span> prosi o zdolność „{p.nazwa}"
                      </span>
                      <span className="block t-meta">{kiedy(p.at)} · zgodę wydaje dział {p.dzial}</span>
                    </>
                  )}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    onClick={() => rozpatrz(p, 'odrzucona')} disabled={zajete === p.id}
                    className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 t-btn hover:bg-raised disabled:opacity-50"
                  ><Ikona jako={X} px={14} /> {p.zdolnosc === 'inne' ? 'Zamknij' : 'Odmów'}</button>
                  {p.zdolnosc !== 'inne' && (
                    <button
                      onClick={() => rozpatrz(p, 'przyznana')} disabled={zajete === p.id}
                      className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 t-btn text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                    ><Ikona jako={Check} px={14} /> Przyznaj</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rozpatrzone.length > 0 && (
        <section>
          <h2 className="mb-2 t-sekcja">Rozpatrzone</h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
            {rozpatrzone.slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 t-tresc">
                <Ikona
                  jako={p.stan === 'przyznana' ? ShieldCheck : X} px={16}
                  klasa={p.stan === 'przyznana' ? 'shrink-0 text-ok' : 'shrink-0 text-muted'}
                />
                <span className="min-w-0 flex-1 truncate">
                  {p.ktoImie} · {p.nazwa}
                </span>
                <span className="shrink-0 t-meta">
                  {p.stan === 'przyznana' ? 'przyznane' : 'odmowa'}
                </span>
                {p.stan === 'przyznana' && (
                  <button
                    onClick={() => cofnij(p)} disabled={zajete === p.id}
                    className="shrink-0 rounded-sm border px-2 py-0.5 text-[12px] hover:bg-raised disabled:opacity-50"
                  >Cofnij</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
