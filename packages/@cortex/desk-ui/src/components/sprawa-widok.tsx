'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import {
  ChevronLeft, ChevronDown, ArrowDown, ArrowUp, Paperclip, MoreHorizontal,
  Square, Info, RotateCcw, LoaderCircle, X, PanelRight, PanelRightClose,
} from 'lucide-react'
import { Ikona } from './ikona'
import { Md } from './md'
import { Przebieg } from './przebieg'
import { Wynik } from './wynik'
import { Artefakty } from './artefakty'
import { BezPokrycia } from './bez-pokrycia'
import { UchwytPanelu, SZER_DOM, zacisnij } from './uchwyt'
import { PrzyciskCoPotrafie } from './co-potrafie'
import { ikonaPliku } from './wiersz-pliku'
import { ListaZalacznikow, type Zalacznik } from './zalaczniki'
import { Klodka } from './klodka'
import { useToast } from './toast'
import { dowodZeZdarzen } from '@cortex/desk-core/dowod'
import { podzielTeczke } from '@cortex/desk-core/teczka'
import { obietniceBezPokrycia, wytworzone } from '@cortex/desk-core/obietnice'
import type { PlikMeta, Polityka, Wpis } from '@cortex/desk-core/typy'
import { zl } from '../lib'
import { api, t } from '../trasy'

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
    else if (t === 'assistant' || t === 'lifecycle' || t === 'zablokowane') biezaca.po.push(w)
  }
  return tury
}

const adres = (sciezka: string) => `${api('/plik')}?sciezka=${encodeURIComponent(sciezka)}`
const obraz = (n: string) => /\.(png|jpe?g|gif|webp)$/i.test(n)

export function SprawaWidok({ id, polityka: p }: { id: string; polityka: Polityka }) {
  const [wpisy, setWpisy] = useState<Wpis[]>([])
  const [sprawa, setSprawa] = useState<Sprawa | null>(null)
  const [teczka, setTeczka] = useState<PlikMeta[]>([])
  const [tresc, setTresc] = useState('')
  const [zal, setZal] = useState<Zalacznik[]>([])
  const [wysylane, setWysylane] = useState<{ tekst: string; pliki: string[] } | null>(null)
  const [teraz, setTeraz] = useState(() => Date.now())
  const [odkad, setOdkad] = useState<number | null>(null)
  const [przyDole, setPrzyDole] = useState(true)
  const [arkusz, setArkusz] = useState(false)
  const [panel, setPanel] = useState(true)
  const [szer, setSzer] = useState(SZER_DOM)
  const [wybrany, setWybrany] = useState<string | null>(null)
  const od = useRef(0)
  const strumien = useRef<HTMLDivElement>(null)
  const dol = useRef<HTMLDivElement>(null)
  const stopkaDowodu = useRef<HTMLDivElement>(null)
  const wybor = useRef<HTMLInputElement>(null)
  const pole = useRef<HTMLTextAreaElement>(null)
  const { pokaz } = useToast()

  useEffect(() => {
    try {
      const z = localStorage.getItem('desk_panel_wyniku')
      if (z !== null) setPanel(z === '1')
      const s = Number(localStorage.getItem('desk_panel_szerokosc'))
      if (s) setSzer(zacisnij(s))
    } catch { /* prywatne okno albo zablokowane dane witryny */ }
  }, [])

  const ustawPanel = useCallback((v: boolean) => {
    setPanel(v)
    try { localStorage.setItem('desk_panel_wyniku', v ? '1' : '0') } catch { /* nieistotne */ }
  }, [])

  const ustawSzer = useCallback((px: number) => {
    setSzer(px)
    try { localStorage.setItem('desk_panel_szerokosc', String(px)) } catch { /* nieistotne */ }
  }, [])

  // okno zwężone myszką po ustawieniu szerokości nie może zostawić panelu szerszego niż ekran
  useEffect(() => {
    const na = () => setSzer((s) => zacisnij(s))
    window.addEventListener('resize', na)
    return () => window.removeEventListener('resize', na)
  }, [])

  const pracuje = sprawa?.stan === 'pracuje'

  /**
   * Odpytujemy z wykrywaniem zmiany. Wcześniej `setSprawa` i `setTeczka` odpalały się co 700 ms
   * z nową tożsamością obiektu, więc React przerysowywał całe drzewo — i gubił zaznaczenie
   * tekstu, którego człowiek właśnie próbował skopiować.
   */
  useEffect(() => {
    let zyje = true
    let uchwyt: ReturnType<typeof setTimeout>
    let odstep = 700

    async function tick() {
      try {
        const r = await fetch(`${api('')}/sprawa/${id}/zdarzenia?od=${od.current}`, { cache: 'no-store' })
        if (!r.ok || !zyje) return
        const d = await r.json()

        setSprawa((s) => (s && s.stan === d.sprawa.stan && s.tytul === d.sprawa.tytul
          && s.koszt === d.sprawa.koszt && s.powod === d.sprawa.powod ? s : d.sprawa))
        setTeczka((t) => {
          const nowa: PlikMeta[] = d.teczka ?? []
          const takieSame = t.length === nowa.length
            && t.every((x, i) => x.sciezka === nowa[i].sciezka && x.rozmiar === nowa[i].rozmiar && x.zmieniony === nowa[i].zmieniony)
          return takieSame ? t : nowa
        })

        if (d.zdarzenia?.length) {
          od.current = d.zdarzenia[d.zdarzenia.length - 1].seq
          setWpisy((w) => [...w, ...d.zdarzenia])
          const start = d.zdarzenia.find((z: Wpis) => z.event.typ === 'lifecycle' && (z.event as { stan?: string }).stan === 'start')
          if (start) setOdkad(new Date(start.at).getTime())
        }
        // zakończona sprawa nie potrzebuje odpytywania co 700 ms — zwalniamy, dopóki nie ruszy nowa tura
        odstep = d.sprawa?.stan === 'pracuje' ? 700 : 4000
      } finally {
        if (zyje) uchwyt = setTimeout(tick, odstep)
      }
    }

    tick()
    return () => { zyje = false; clearTimeout(uchwyt) }
  }, [id])

  // zegar chodzi wyłącznie wtedy, gdy jest co odliczać
  useEffect(() => {
    if (!pracuje && !wysylane) return
    const z = setInterval(() => setTeraz(Date.now()), 1000)
    return () => clearInterval(z)
  }, [pracuje, wysylane])

  useEffect(() => {
    if (przyDole) dol.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [wpisy.length, przyDole])

  const naSkroll = useCallback(() => {
    const el = strumien.current
    if (!el) return
    setPrzyDole(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }, [])

  // `zalacznik` to zdarzenie o pochodzeniu pliku, nie wypowiedź — w rozmowie nie ma czego pokazać
  const rozmowa = useMemo(() => wpisy.filter((w) => w.event.typ !== 'zalacznik'), [wpisy])
  const tury = useMemo(() => naTury(rozmowa), [rozmowa])
  const dowod = useMemo(() => dowodZeZdarzen(wpisy.map((w) => w.event)), [wpisy])
  const sekundy = odkad && pracuje ? Math.max(0, Math.round((teraz - odkad) / 1000)) : 0

  // plik wgrany, ale jeszcze niewysłany, też jest Twój — nie może udawać wyniku pracy
  const wgrywane = useMemo(() => zal.map((z) => z.nazwa), [zal])
  const { wyniki, zalaczniki } = useMemo(
    () => podzielTeczke(teczka, wpisy.map((w) => w.event), wgrywane), [teczka, wpisy, wgrywane])

  // „ostatni" ma znaczyć NAJNOWSZY, nie alfabetycznie ostatni — biurko.lista sortuje po nazwie
  const wgKolejnosci = useMemo(
    () => [...wyniki].sort((a, b) => a.zmieniony.localeCompare(b.zmieniony)), [wyniki])
  const ostatni = wgKolejnosci.at(-1) ?? null
  const aktywny = useMemo(
    () => [...wyniki, ...zalaczniki].find((x) => x.sciezka === wybrany) ?? ostatni,
    [wyniki, zalaczniki, wybrany, ostatni])

  const poNazwie = useCallback(
    (n: string) => teczka.find((x) => x.nazwa === n) ?? null, [teczka])

  /** Jedno wejście do podglądu — z karty artefaktu, z załącznika w rozmowie i z panelu. */
  const pokazPlik = useCallback((plik: PlikMeta | null) => {
    if (!plik) return
    setWybrany(plik.sciezka)
    if (window.matchMedia('(min-width: 1024px)').matches) ustawPanel(true)
    else setArkusz(true)
  }, [ustawPanel])

  // optymistyczna wiadomość znika, gdy dojdzie prawdziwe zdarzenie polecenia
  const liczbaPolecen = tury.filter((t) => t.polecenie).length
  const poleceniaPrzedWyslaniem = useRef(0)
  useEffect(() => {
    if (wysylane && liczbaPolecen > poleceniaPrzedWyslaniem.current) setWysylane(null)
  }, [liczbaPolecen, wysylane])

  async function wyslij() {
    const gotowe = zal.filter((z) => !z.wgrywa).map((z) => z.nazwa)
    if ((!tresc.trim() && !gotowe.length) || pracuje || zal.some((z) => z.wgrywa)) return
    const t = tresc
    poleceniaPrzedWyslaniem.current = liczbaPolecen
    setWysylane({ tekst: t, pliki: gotowe })
    setTresc(''); setZal([]); setPrzyDole(true)
    const r = await fetch(`${api('')}/sprawa/${id}/tura`, {
      method: 'POST',
      body: JSON.stringify({ tresc: t, zalaczniki: gotowe }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setWysylane(null); setTresc(t)
      pokaz({ tekst: d.blad ?? 'Nie udało się wysłać zlecenia.', ton: 'blad' })
    }
  }

  /** Załącznik ląduje w teczce TEJ sprawy — „Moje pliki" zostają nietknięte. */
  async function dolacz(files: FileList | null) {
    if (!files?.length) return
    const nowe: Zalacznik[] = Array.from(files).map((f) => ({
      nazwa: f.name,
      podglad: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      wgrywa: true,
    }))
    setZal((z) => [...z, ...nowe])

    const fd = new FormData()
    fd.append('sprawaId', id)
    Array.from(files).forEach((f) => fd.append('plik', f))
    const r = await fetch(api('/pliki/wgraj'), { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))

    if (!r.ok) {
      setZal((z) => z.filter((x) => !nowe.some((n) => n.nazwa === x.nazwa)))
      pokaz({ tekst: d.blad ?? 'Nie udało się dołączyć pliku.', ton: 'blad' })
      return
    }
    // serwer mógł nadać inną nazwę, gdy taka już była w teczce
    setZal((z) => z.map((x) => {
      const i = nowe.findIndex((n) => n.nazwa === x.nazwa)
      return i >= 0 ? { ...x, nazwa: d.nazwy?.[i] ?? x.nazwa, wgrywa: false } : x
    }))
    pole.current?.focus()
  }

  const doDowodu = () => stopkaDowodu.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const zajete = pracuje || Boolean(wysylane)

  const ponow = (nazwa: string) => {
    setTresc(`Nie ma pliku ${nazwa} w teczce sprawy. Zrób go proszę naprawdę i zapisz.`)
    pole.current?.focus()
  }

  const tablica = (
    <Wynik
      wyniki={wgKolejnosci} zalaczniki={zalaczniki} aktywny={aktywny}
      naWybor={(x) => setWybrany(x.sciezka)} dowod={dowod} doDowodu={doDowodu}
    />
  )

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-pasek shrink-0 items-center gap-2 border-b bg-surface px-3">
          <Link href={t("/")} aria-label="Wróć do biurka" className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-raised md:hidden">
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
              onClick={() => fetch(`${api('')}/sprawa/${id}/stop`, { method: 'POST' })}
              className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 t-btn hover:bg-raised"
            ><Ikona jako={Square} px={14} /> Stop</button>
          )}
          <button
            onClick={() => ustawPanel(!panel)} aria-pressed={panel}
            aria-label={panel ? 'Ukryj panel wyniku' : 'Pokaż panel wyniku'}
            title={panel ? 'Ukryj wynik' : 'Pokaż wynik'}
            className="hidden h-8 w-8 place-items-center rounded-sm text-muted hover:bg-raised lg:grid"
          >
            <Ikona jako={panel ? PanelRightClose : PanelRight} px={16} />
          </button>
          <Menu.Root>
            <Menu.Trigger aria-label="Więcej o sprawie" className="grid h-8 w-8 place-items-center rounded-sm text-muted hover:bg-raised">
              <Ikona jako={MoreHorizontal} px={16} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} collisionPadding={12} className="z-50 min-w-[240px] rounded-md border bg-surface p-3 shadow-pop">
                <div className="flex items-center gap-2 pb-2 t-sekcja"><Ikona jako={Info} px={14} /> Szczegóły sprawy</div>
                <dl className="space-y-1 t-meta">
                  <div className="flex justify-between gap-4"><dt>Czynności</dt><dd className="text-ink">{wpisy.filter((w) => w.event.typ === 'narzedzie_start').length}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Dokumenty</dt><dd className="text-ink">{wyniki.length}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Koszt</dt><dd className="text-ink">{zl(sprawa?.koszt ?? 0)}</dd></div>
                  <div className="flex justify-between gap-4"><dt>Uprawnienia</dt><dd className="text-ink">jak w dziale {p.rola === 'zarzad' ? 'Zarząd' : 'Księgowość'} ({p.przyznane.length} z {p.przyznane.length + p.zablokowane.length})</dd></div>
                </dl>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>

        <div ref={strumien} onScroll={naSkroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex max-w-strumien flex-col gap-4">
            {tury.map((tura, i) => {
              const ostatniaTura = i === tury.length - 1 && !wysylane
              const e = tura.polecenie?.event
              const zalaczone = e?.typ === 'mysl' ? e.zalaczniki ?? [] : []
              const zdarzeniaTury = tura.praca.map((w) => w.event)
              const artefakty = wytworzone(zdarzeniaTury)
                .map(poNazwie).filter((x): x is PlikMeta => Boolean(x))
              return (
                <div key={tura.klucz} className="flex flex-col gap-4">
                  {e?.typ === 'mysl' && (
                    <Polecenie
                      tekst={e.tekst}
                      zalaczniki={zalaczone.map((n) => ({
                        nazwa: n,
                        podglad: obraz(n) ? adres(`Sprawy/${id}/${n}`) : undefined,
                      }))}
                      otworz={(n) => pokazPlik(poNazwie(n))}
                    />
                  )}

                  {tura.praca.length > 0 && (
                    <div ref={ostatniaTura ? stopkaDowodu : undefined}>
                      <Przebieg wpisy={tura.praca} pracuje={pracuje && ostatniaTura} teraz={teraz} />
                    </div>
                  )}

                  {pracuje && ostatniaTura && tura.praca.length === 0 && <Zabieram />}

                  <Artefakty pliki={artefakty} otworz={pokazPlik} />

                  {tura.po.map((w) => {
                    const ev = w.event
                    if (ev.typ === 'zablokowane')
                      return (
                        <Klodka
                          key={w.seq} opis={ev.opis} nazwa={ev.nazwa}
                          dzial={ev.dzial} zdolnoscId={ev.zdolnoscId}
                        />
                      )
                    if (ev.typ === 'assistant')
                      return (
                        <div key={w.seq} className="flex flex-col gap-3">
                          <div className="max-w-miara"><Md tekst={ev.tekst} /></div>
                          <BezPokrycia
                            nazwy={obietniceBezPokrycia(ev.tekst, zdarzeniaTury, teczka)}
                            popros={ponow}
                          />
                        </div>
                      )
                    if (ev.typ === 'lifecycle' && (ev.stan === 'blad' || ev.stan === 'przerwane'))
                      return (
                        <div
                          key={w.seq}
                          className={`rounded-lg border bg-surface px-4 py-3 ${ev.stan === 'blad' ? 'border-bad' : 'border-warn'}`}
                        >
                          <div className="t-tresc-m">
                            {ev.stan === 'blad' ? 'Nie dokończyłem tego zlecenia.' : 'Praca przerwana.'}
                          </div>
                          {ev.powod && <p className="mt-0.5 t-meta">{ev.powod}</p>}
                          {ev.stan === 'blad' && (
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

            {/* zlecenie widać od razu po kliknięciu, zanim serwer zdąży zapisać zdarzenie */}
            {wysylane && (
              <div className="flex flex-col gap-4">
                <Polecenie
                  tekst={wysylane.tekst}
                  zalaczniki={wysylane.pliki.map((n) => ({
                    nazwa: n,
                    podglad: obraz(n) ? adres(`Sprawy/${id}/${n}`) : undefined,
                  }))}
                />
                <Zabieram />
              </div>
            )}

            <div ref={dol} />
          </div>

          {!przyDole && (
            <button
              onClick={() => { setPrzyDole(true); dol.current?.scrollIntoView({ behavior: 'smooth' }) }}
              className="sticky bottom-2 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-pill border bg-surface px-3 t-meta shadow-pop hover:text-ink"
            ><Ikona jako={ArrowDown} px={14} /> Nowe kroki</button>
          )}
        </div>

        {aktywny && (
          <button
            onClick={() => setArkusz(true)}
            className="flex h-12 shrink-0 items-center gap-2 border-t bg-surface px-4 text-left lg:hidden"
          >
            <Ikona jako={ikonaPliku(aktywny)} px={16} klasa="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate t-tresc-m">{aktywny.nazwa}</span>
            <span className="shrink-0 t-meta">Otwórz</span>
            <Ikona jako={ChevronDown} px={16} klasa="shrink-0 -rotate-90 text-muted" />
          </button>
        )}

        <div className="shrink-0 border-t bg-surface p-3">
          <div className="edytor mx-auto max-w-strumien rounded-xl border bg-bg">
            {zal.length > 0 && (
              <div className="max-h-[136px] overflow-y-auto border-b px-3 py-2.5">
                <ListaZalacznikow
                  pliki={zal}
                  usun={(n) => setZal((z) => z.filter((x) => x.nazwa !== n))}
                />
              </div>
            )}
            <textarea
              ref={pole} value={tresc} onChange={(e) => setTresc(e.target.value)} rows={2}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (window.matchMedia('(hover: hover)').matches && !e.shiftKey) { e.preventDefault(); wyslij() }
              }}
              onPaste={(e) => {
                const pliki = Array.from(e.clipboardData.files)
                if (!pliki.length) return
                e.preventDefault()
                const dt = new DataTransfer()
                pliki.forEach((f) => dt.items.add(f))
                dolacz(dt.files)
              }}
              placeholder={zajete ? 'Pracuję — poczekaj albo naciśnij Stop' : 'Napisz, co mam zrobić…'}
              className="w-full resize-none bg-transparent px-3.5 pt-3 t-tresc outline-none placeholder:text-muted-cichy"
            />
            <div className="flex items-center gap-1 px-2 pb-2">
              <input ref={wybor} type="file" multiple hidden onChange={(e) => { dolacz(e.target.files); e.target.value = '' }} />
              <button
                type="button" onClick={() => wybor.current?.click()}
                className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink"
              >
                <Ikona jako={Paperclip} px={14} /> Dodaj plik
              </button>
              <PrzyciskCoPotrafie p={p} />
              <div className="flex-1" />
              <button
                onClick={wyslij}
                disabled={(!tresc.trim() && !zal.length) || zajete || zal.some((z) => z.wgrywa)}
                aria-label="Wyślij zlecenie"
                className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-35"
              ><Ikona jako={zajete ? LoaderCircle : ArrowUp} px={16} klasa={zajete ? 'obrot' : undefined} /></button>
            </div>
          </div>
        </div>
      </div>

      {panel && (
        <>
          <UchwytPanelu szerokosc={szer} ustaw={ustawSzer} zwin={() => ustawPanel(false)} />
          <aside
            style={{ width: szer }}
            className="hidden shrink-0 border-l bg-surface lg:block"
            aria-label="Panel wyniku"
          >
            {tablica}
          </aside>
        </>
      )}

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
            <div className="h-[calc(88vh-44px)]">{tablica}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

/** Polecenie człowieka: bąbel po prawej, o szerokości treści, z zaznaczalnym tekstem. */
function Polecenie({ tekst, zalaczniki, otworz }: {
  tekst: string
  zalaczniki: Zalacznik[]
  otworz?: (n: string) => void
}) {
  return (
    <div className="flex flex-col items-end gap-2 self-end">
      <ListaZalacznikow pliki={zalaczniki} otworz={otworz} klasa="justify-end" />
      {tekst && (
        <div className="max-w-[min(560px,85%)] select-text whitespace-pre-wrap rounded-xl rounded-br-sm bg-accent-soft px-3.5 py-2.5 t-tresc text-accent-soft-ink">
          {tekst}
        </div>
      )}
    </div>
  )
}

/** Luka między kliknięciem a pierwszym krokiem to 1–2 sekundy ciszy — tu jest jej wypełnienie. */
function Zabieram() {
  return (
    <div className="flex items-center gap-2 t-meta">
      <Ikona jako={LoaderCircle} px={14} klasa="obrot text-accent" />
      <span className="puls">Zabieram się do pracy…</span>
    </div>
  )
}
