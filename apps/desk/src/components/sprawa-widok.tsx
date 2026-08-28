'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Md } from './md'
import { dowodZeZdarzen } from '@/core/dowod'
import type { DeskEvent, PlikMeta } from '@/core/typy'
import { rozmiar, zl } from '@/lib'

type Wpis = { seq: number; at: string; event: DeskEvent }
type Sprawa = { id: string; tytul: string; stan: string; powod: string | null; koszt: number; zmieniona: string }

const ETYKIETA: Record<string, string> = {
  nowa: 'nowa', pracuje: 'pracuje', gotowe: 'gotowe', przerwane: 'przerwane', blad: 'nie udało się',
}

export function SprawaWidok({ id, zdolnosci }: { id: string; zdolnosci: string[] }) {
  const [wpisy, setWpisy] = useState<Wpis[]>([])
  const [sprawa, setSprawa] = useState<Sprawa | null>(null)
  const [teczka, setTeczka] = useState<PlikMeta[]>([])
  const [szczegol, setSzczegol] = useState<Wpis | null>(null)
  const [tresc, setTresc] = useState('')
  const [odkad, setOdkad] = useState<number | null>(null)
  const [teraz, setTeraz] = useState(Date.now())
  const od = useRef(0)
  const dol = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let zyje = true
    async function tick() {
      const r = await fetch(`/api/sprawa/${id}/zdarzenia?od=${od.current}`, { cache: 'no-store' })
      if (!r.ok || !zyje) return
      const d = await r.json()
      setSprawa(d.sprawa); setTeczka(d.teczka ?? [])
      if (d.zdarzenia?.length) {
        od.current = d.zdarzenia[d.zdarzenia.length - 1].seq
        setWpisy((w) => [...w, ...d.zdarzenia])
        const start = d.zdarzenia.find((z: Wpis) => z.event.typ === 'lifecycle' && (z.event as any).stan === 'start')
        if (start) setOdkad(new Date(start.at).getTime())
      }
    }
    tick(); const t = setInterval(tick, 700)
    const z = setInterval(() => setTeraz(Date.now()), 1000)
    return () => { zyje = false; clearInterval(t); clearInterval(z) }
  }, [id])

  useEffect(() => { dol.current?.scrollIntoView({ behavior: 'smooth' }) }, [wpisy.length])

  const pracuje = sprawa?.stan === 'pracuje'
  const dowod = dowodZeZdarzen(wpisy.map((w) => w.event))
  const sekundy = odkad && pracuje ? Math.max(0, Math.round((teraz - odkad) / 1000)) : 0

  async function wyslij() {
    if (!tresc.trim() || pracuje) return
    const t = tresc; setTresc('')
    await fetch(`/api/sprawa/${id}/tura`, { method: 'POST', body: JSON.stringify({ tresc: t }) })
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-surface px-4 py-3">
          <Link href="/" className="rounded-md px-1 text-lg text-muted hover:bg-raised md:hidden" aria-label="Wróć">‹</Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{sprawa?.tytul ?? 'Sprawa'}</div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>{ETYKIETA[sprawa?.stan ?? 'nowa']}</span>
              {pracuje && <span className="text-accent">· pracuje od {sekundy < 60 ? `${sekundy} s` : `${Math.round(sekundy / 60)} min`}</span>}
              {sprawa?.powod && <span>· {sprawa.powod}</span>}
              {!!sprawa?.koszt && <span>· koszt: {zl(sprawa.koszt)}</span>}
            </div>
          </div>
          {pracuje && (
            <button onClick={() => fetch(`/api/sprawa/${id}/stop`, { method: 'POST' })}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-raised">Stop</button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-2xl space-y-3">
            {wpisy.map((w) => <Wiersz key={w.seq} w={w} onKlik={setSzczegol} />)}
            {pracuje && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> pracuję…
              </div>
            )}
            {(teczka.length > 0 || dowod.zrobione.length > 0) && (
              <Teczka pliki={teczka} dowod={dowod} />
            )}
            <div ref={dol} />
          </div>
        </div>

        <div className="border-t bg-surface p-3">
          <div className="mx-auto max-w-2xl rounded-xl border bg-bg p-2">
            <textarea value={tresc} onChange={(e) => setTresc(e.target.value)} rows={2}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); wyslij() } }}
              placeholder={pracuje ? 'Agent pracuje — poczekaj albo naciśnij Stop' : 'Napisz, co mam zrobić…'}
              className="w-full resize-none bg-transparent px-2 py-1 text-[15px] outline-none placeholder:text-muted" />
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-muted">{zdolnosci.length} narzędzi dostępnych dla Ciebie</span>
              <button onClick={wyslij} disabled={!tresc.trim() || pracuje}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40">Wyślij</button>
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden w-[300px] shrink-0 flex-col border-l bg-surface lg:flex">
        <div className="border-b px-4 py-3 text-sm font-medium">Szczegóły</div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {!szczegol ? (
            <p className="text-muted">Kliknij wiersz z narzędziem, żeby zobaczyć, co dokładnie zrobiłem.</p>
          ) : (
            <Szczegoly w={szczegol} />
          )}
        </div>
      </aside>
    </div>
  )
}

function Wiersz({ w, onKlik }: { w: Wpis; onKlik: (w: Wpis) => void }) {
  const e = w.event
  if (e.typ === 'mysl')
    return <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[15px] text-accent-ink whitespace-pre-wrap">{e.tekst}</div></div>
  if (e.typ === 'assistant')
    return <div className="max-w-[92%] text-[15px] leading-relaxed"><Md tekst={e.tekst} /></div>
  if (e.typ === 'narzedzie_start')
    return (
      <button onClick={() => onKlik(w)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm text-muted hover:bg-raised">
        <span className="grid h-5 w-5 place-items-center rounded bg-raised text-[10px]">⚙</span>
        <span className="truncate">{e.etykieta}</span>
      </button>
    )
  if (e.typ === 'narzedzie_koniec' && !e.ok)
    return <div className="flex items-center gap-2 rounded-lg bg-bad/10 px-2 py-1 text-sm text-bad"><span>●</span><span>Nie udało się: {e.podsumowanie}</span></div>
  if (e.typ === 'lifecycle' && (e.stan === 'blad' || e.stan === 'przerwane'))
    return (
      <div className={`rounded-xl border px-3 py-2 text-sm ${e.stan === 'blad' ? 'border-bad/40 bg-bad/10' : 'border-warn/40 bg-warn/10'}`}>
        {e.stan === 'blad' ? 'Nie udało się wykonać zlecenia.' : 'Praca przerwana.'} {e.powod && <span className="text-muted">{e.powod}</span>}
      </div>
    )
  return null
}

function Szczegoly({ w }: { w: Wpis }) {
  const e = w.event as Extract<DeskEvent, { typ: 'narzedzie_start' }>
  return (
    <div className="space-y-3">
      <div><div className="text-[11px] uppercase tracking-wide text-muted">Co zrobiłem</div><div>{e.etykieta}</div></div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted">Na czym</div>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-raised p-2 text-[12px]">{JSON.stringify(e.argumenty, null, 2)}</pre>
      </div>
      <div className="text-[11px] text-muted">{new Date(w.at).toLocaleTimeString('pl-PL')}</div>
    </div>
  )
}

function Teczka({ pliki, dowod }: { pliki: PlikMeta[]; dowod: ReturnType<typeof dowodZeZdarzen> }) {
  const [otwarty, setOtwarty] = useState(false)
  if (!pliki.length && !dowod.zrobione.length) return null
  return (
    <div className="rounded-xl border bg-surface p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Teczka sprawy</div>
      {pliki.length === 0 && <div className="text-sm text-muted">Nie powstał jeszcze żaden dokument.</div>}
      <ul className="space-y-1.5">
        {pliki.map((p) => (
          <li key={p.sciezka} className="flex items-center gap-2 rounded-lg border bg-bg px-3 py-2">
            <span>{/\.(png|jpe?g)$/i.test(p.nazwa) ? '🖼️' : '📄'}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{p.nazwa}</span>
            <span className="shrink-0 text-[11px] text-muted">{rozmiar(p.rozmiar)}</span>
            <a href={`/api/plik?sciezka=${encodeURIComponent(p.sciezka)}`} target="_blank" rel="noreferrer"
              className="shrink-0 rounded-md border px-2 py-0.5 text-xs hover:bg-raised">Otwórz</a>
          </li>
        ))}
      </ul>
      <button onClick={() => setOtwarty((o) => !o)} className="mt-2 text-xs text-muted underline-offset-2 hover:underline">
        {otwarty ? 'Ukryj dowód' : 'Pokaż dowód'}
      </button>
      {otwarty && (
        <div className="mt-2 space-y-2 rounded-lg bg-raised p-3 text-[13px]">
          <Lista tytul="Weszło" el={dowod.weszlo} />
          <Lista tytul="Zrobione" el={dowod.zrobione} />
          <Lista tytul="Nie sprawdzone" el={dowod.nieSprawdzone} ostrzez />
          <p className="pt-1 text-[11px] text-muted">Ta lista powstaje z tego, co narzędzia faktycznie zrobiły — nie z tego, co agent napisał.</p>
        </div>
      )}
    </div>
  )
}

function Lista({ tytul, el, ostrzez }: { tytul: string; el: string[]; ostrzez?: boolean }) {
  if (!el.length) return null
  return (
    <div>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${ostrzez ? 'text-warn' : 'text-muted'}`}>{tytul}</div>
      <ul className="mt-0.5 space-y-0.5">{el.map((e, i) => <li key={i}>· {e}</li>)}</ul>
    </div>
  )
}
