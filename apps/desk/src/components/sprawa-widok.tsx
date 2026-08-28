'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import {
  ChevronLeft, ChevronDown, ArrowDown, ArrowUp, Paperclip, MoreHorizontal,
  Square, Info, RotateCcw, LoaderCircle, X,
} from 'lucide-react'
import { Ikona } from './ikona'
import { Md } from './md'
import { Przebieg } from './przebieg'
import { Wynik } from './wynik'
import { PrzyciskCoPotrafie } from './co-potrafie'
import { ikonaPliku } from './wiersz-pliku'
import { useToast } from './toast'
import { dowodZeZdarzen } from '@/core/dowod'
import type { PlikMeta, Polityka, Wpis } from '@/core/typy'
import { zl } from '@/lib'

type Sprawa = { id: string; tytul: string; stan: string; powod: string | null; koszt: number; zmieniona: string }

const ETYKIETA: Record<string, string> = {
  nowa: 'nowa', pracuje: 'pracuje', gotowe: 'gotowe', przerwane: 'przerwane', blad: 'nie udało się',
}
const KROPKA: Record<string, string> = {
  nowa: 'bg-muted-cichy', pracuje: 'bg-accent puls', gotowe: 'bg-ok', przerwane: 'bg-warn', blad: 'bg-bad',
}

type Tura = { klucz: number; polecenie: Wpis | null; praca: Wpis[]; po: Wpis[] }

/**
 * Strumień dzielimy na tury — jedno polecenie, jedna praca, jedna odpowiedź.
 * Bez tego przy drugim zleceniu w tej samej sprawie wszystkie kroki wpadają do jednej karty,
 * a przebieg ląduje pod odpowiedzią, choć wydarzył się przed nią.
 */
function naTury(wpisy: Wpis[]): Tura[] {
  const tury: Tura[] = []
  let biezaca: Tura | null = null
  for (const w of wpisy) {
    const t = w.event.typ
    if (t === 'mysl' || !biezaca) {
      biezaca = { klucz: w.seq, polecenie: t === 'mysl' ? w : null, praca: [], po: [] }
      tury.push(biezaca)
      if (t === 'mysl') continue
    }
    if (t === 'narzedzie_start' || t === 'narzedzie_koniec') biezaca.praca.push(w)
    else if (t === 'assistant' || t === 'lifecycle') biezaca.po.push(w)
  }
  return tury
}

export function SprawaWidok({ id, polityka: p }: { id: string; polityka: Polityka }) {
  const [wpisy, setWpisy] = useState<Wpis[]>([])
  const [sprawa, setSprawa] = useState<Sprawa | null>(null)
  const [teczka, setTeczka] = useState<PlikMeta[]>([])
  const [tresc, setTresc] = useState('')
  const [teraz, setTeraz] = useState(() => Date.now())
  const [odkad, setOdkad] = useState<number | null>(null)
  const [przyDole, setPrzyDole] = useState(true)
  const [wgrywa, setWgrywa] = useState(false)
  const [arkusz, setArkusz] = useState(false)
  const od = useRef(0)
  const strumien = useRef<HTMLDivElement>(null)
  const dol = useRef<HTMLDivElement>(null)
  const stopkaDowodu = useRef<HTMLDivElement>(null)
  const wybor = useRef<HTMLInputElement>(null)
  const pole = useRef<HTMLTextAreaElement>(null)
  const { pokaz } = useToast()

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
        const start = d.zdarzenia.find((z: Wpis) => z.event.typ === 'lifecycle' && (z.event as { stan?: string }).stan === 'start')
        if (start) setOdkad(new Date(start.at).getTime())
      }
    }
    tick()
    const t = setInterval(tick, 700)
    const z = setInterval(() => setTeraz(Date.now()), 1000)
    return () => { zyje = false; clearInterval(t); clearInterval(z) }
  }, [id])

  // przewijamy tylko wtedy, gdy człowiek stoi przy dole — inaczej wyrywamy mu ekran z rąk
  useEffect(() => {
    if (przyDole) dol.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [wpisy.length, przyDole])

  const naSkroll = useCallback(() => {
    const el = strumien.current
    if (!el) return
    setPrzyDole(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }, [])

  const pracuje = sprawa?.stan === 'pracuje'
  const dowod = dowodZeZdarzen(wpisy.map((w) => w.event))
  const sekundy = odkad && pracuje ? Math.max(0, Math.round((teraz - odkad) / 1000)) : 0
  const tury = naTury(wpisy)
  const dokumenty = teczka.filter((x) => !x.katalog)
  const ostatni = dokumenty[dokumenty.length - 1]

  async function wyslij() {
    if (!tresc.trim() || pracuje) return
    const t = tresc
    setTresc(''); setPrzyDole(true)
    await fetch(`/api/sprawa/${id}/tura`, { method: 'POST', body: JSON.stringify({ tresc: t }) })
  }

  async function dolacz(files: FileList | null) {
    if (!files?.length) return
    setWgrywa(true)
    const fd = new FormData()
    fd.append('katalog', 'Moje pliki')
    Array.from(files).forEach((f) => fd.append('plik', f))
    const r = await fetch('/api/pliki/wgraj', { method: 'POST', body: fd })
    setWgrywa(false)
    if (!r.ok) { pokaz({ tekst: 'Nie udało się dodać pliku.', ton: 'blad' }); return }
    const nazwy = Array.from(files).map((f) => f.name)
    pokaz({ tekst: `Dodane do Moich plików: ${nazwy.join(', ')}` })
    setTresc((t) => (t ? `${t.trimEnd()}\n\nPracuj na pliku: ${nazwy.join(', ')}` : `Pracuj na pliku: ${nazwy.join(', ')}`))
    pole.current?.focus()
  }

  const doDowodu = () => stopkaDowodu.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── nagłówek ─────────────────────────────────────────── */}
        <header className="flex h-pasek shrink-0 items-center gap-2 border-b bg-surface px-3">
          <Link href="/" aria-label="Wróć do biurka" className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-raised md:hidden">
            <Ikona jako={ChevronLeft} px={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate t-h3">{sprawa?.tytul ?? 'Sprawa'}</div>
            <div className="flex items-center gap-1.5 t-meta">
              <span className={`h-1.5 w-1.5 rounded-pill ${KROPKA[sprawa?.stan ?? 'nowa']}`} />
              {pracuje
                ? <span className="text-accent">pracuje · {sekundy < 60 ? `${sekundy} s` : `${Math.round(sekundy / 60)} min`}</span>
                : <span>{ETYKIETA[sprawa?.stan ?? 'nowa']}</span>}
            </div>
          </div>
          {pracuje && (
            <button
              onClick={() => fetch(`/api/sprawa/${id}/stop`, { method: 'POST' })}
              className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 t-btn hover:bg-raised"
            ><Ikona jako={Square} px={14} /> Stop</button>
          )}
          <Menu.Root>
            <Menu.Trigger aria-label="Więcej o sprawie" className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-raised">
              <Ikona jako={MoreHorizontal} px={16} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} className="z-50 min-w-[240px] rounded-md border bg-surface p-3 shadow-pop">
                <div className="flex items-center gap-2 pb-2 t-sekcja"><Ikona jako={Info} px={14} /> Szczegóły sprawy</div>
                <dl className="space-y-1 t-meta">
                  <div className="flex justify-between gap-4"><dt>Czynności</dt><dd className="text-ink">{wpisy.filter((w) => w.event.typ === 'narzedzie_start').length}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Dokumenty</dt><dd className="text-ink">{dokumenty.length}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Koszt</dt><dd className="text-ink">{zl(sprawa?.koszt ?? 0)}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Zakres uprawnień</dt><dd className="font-mono text-ink">{p.odcisk}</dd></div>
                </dl>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>

        {/* ── strumień ─────────────────────────────────────────── */}
        <div ref={strumien} onScroll={naSkroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex max-w-strumien flex-col gap-4">
            {tury.map((tura, i) => {
              const ostatniaTura = i === tury.length - 1
              return (
                <div key={tura.klucz} className="flex flex-col gap-4">
                  {tura.polecenie?.event.typ === 'mysl' && (
                    <div className="max-w-miara rounded-md border-l-2 border-accent bg-accent-soft px-3.5 py-2.5 t-tresc text-accent-soft-ink whitespace-pre-wrap">
                      {tura.polecenie.event.tekst}
                    </div>
                  )}

                  {tura.praca.length > 0 && (
                    <div ref={ostatniaTura ? stopkaDowodu : undefined}>
                      <Przebieg wpisy={tura.praca} pracuje={pracuje && ostatniaTura} teraz={teraz} />
                    </div>
                  )}

                  {tura.po.map((w) => {
                    const e = w.event
                    if (e.typ === 'assistant')
                      return <div key={w.seq} className="max-w-miara"><Md tekst={e.tekst} /></div>
                    if (e.typ === 'lifecycle' && (e.stan === 'blad' || e.stan === 'przerwane'))
                      return (
                        <div
                          key={w.seq}
                          className={`rounded-lg border bg-surface px-4 py-3 ${e.stan === 'blad' ? 'border-bad' : 'border-warn'}`}
                        >
                          <div className="t-tresc-m">
                            {e.stan === 'blad' ? 'Nie dokończyłem tego zlecenia.' : 'Praca przerwana.'}
                          </div>
                          {e.powod && <p className="mt-0.5 t-meta">{e.powod}</p>}
                          {e.stan === 'blad' && (
                            <button
                              onClick={() => pole.current?.focus()}
                              className="mt-2 flex h-8 items-center gap-1.5 rounded-md border px-2.5 t-btn hover:bg-raised"
                            ><Ikona jako={RotateCcw} px={14} /> Napisz inaczej</button>
                          )}
                        </div>
                      )
                    return null
                  })}
                </div>
              )
            })}
            <div ref={dol} />
          </div>

          {!przyDole && (
            <button
              onClick={() => { setPrzyDole(true); dol.current?.scrollIntoView({ behavior: 'smooth' }) }}
              className="sticky bottom-2 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-pill border bg-surface px-3 t-meta shadow-pop hover:text-ink"
            ><Ikona jako={ArrowDown} px={14} /> Nowe kroki</button>
          )}
        </div>

        {/* ── wynik na telefonie: pasek nad polem pisania ───────── */}
        {ostatni && (
          <button
            onClick={() => setArkusz(true)}
            className="flex h-12 shrink-0 items-center gap-2 border-t bg-surface px-4 text-left lg:hidden"
          >
            <Ikona jako={ikonaPliku(ostatni)} px={16} klasa="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate t-tresc-m">{ostatni.nazwa}</span>
            <span className="shrink-0 t-meta">Otwórz</span>
            <Ikona jako={ChevronDown} px={16} klasa="shrink-0 -rotate-90 text-muted" />
          </button>
        )}

        {/* ── kompozytor ───────────────────────────────────────── */}
        <div className="shrink-0 border-t bg-surface p-3">
          <div className="mx-auto max-w-strumien rounded-xl border bg-bg">
            <textarea
              ref={pole} value={tresc} onChange={(e) => setTresc(e.target.value)} rows={2}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (window.matchMedia('(hover: hover)').matches && !e.shiftKey) { e.preventDefault(); wyslij() }
              }}
              placeholder={pracuje ? 'Pracuję — poczekaj albo naciśnij Stop' : 'Napisz, co mam zrobić…'}
              className="w-full resize-none bg-transparent px-3.5 pt-3 t-tresc outline-none placeholder:text-muted-cichy"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <input ref={wybor} type="file" multiple hidden onChange={(e) => dolacz(e.target.files)} />
              <button
                type="button" onClick={() => wybor.current?.click()} disabled={wgrywa}
                className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink"
              >
                <Ikona jako={wgrywa ? LoaderCircle : Paperclip} px={14} klasa={wgrywa ? 'obrot' : undefined} />
                {wgrywa ? 'Dodaję…' : 'Dodaj plik'}
              </button>
              <PrzyciskCoPotrafie p={p} />
              <div className="flex-1" />
              <button
                onClick={wyslij} disabled={!tresc.trim() || pracuje}
                aria-label="Wyślij zlecenie"
                className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-35"
              ><Ikona jako={ArrowUp} px={16} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* ── panel wyniku (desktop) ──────────────────────────────── */}
      <aside className="hidden w-wynik shrink-0 border-l bg-surface lg:block">
        <Wynik pliki={teczka} dowod={dowod} doDowodu={doDowodu} />
      </aside>

      {/* ── panel wyniku (telefon) — arkusz od dołu ─────────────── */}
      <Dialog.Root open={arkusz} onOpenChange={setArkusz}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 lg:hidden" />
          <Dialog.Content className="arkusz fixed inset-x-0 bottom-0 z-50 h-[88vh] overflow-hidden rounded-t-xl border-t bg-surface lg:hidden">
            <div className="flex h-11 items-center justify-between border-b px-3">
              <Dialog.Title className="t-h3">Wynik</Dialog.Title>
              <Dialog.Close aria-label="Zamknij" className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-raised">
                <Ikona jako={X} px={16} />
              </Dialog.Close>
            </div>
            <div className="h-[calc(88vh-44px)]">
              <Wynik pliki={teczka} dowod={dowod} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
