'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Check, LoaderCircle, TriangleAlert, ChevronDown, Lock,
  ShieldCheck, FileText, FileSpreadsheet, FileImage, Globe,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Ikona } from './ikona'
import { paruj, opisKroku, czasKroku, podsumujGrupe, type Krok } from '@/core/kroki'
import { dowodZeZdarzen } from '@/core/dowod'
import type { Wpis } from '@/core/typy'

function ikonaPliku(nazwa: string): LucideIcon {
  if (/\.(csv|xlsx?|tsv)$/i.test(nazwa)) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(nazwa)) return FileImage
  return FileText
}

/** Nazwa pliku jako osobny, rozpoznawalny obiekt — nie fragment zdania. */
function Pigulka({ nazwa }: { nazwa: string }) {
  return (
    <span className="inline-flex h-5 max-w-[220px] shrink-0 items-center gap-1 rounded-sm bg-raised px-1.5 align-middle">
      <Ikona jako={ikonaPliku(nazwa)} px={12} klasa="shrink-0 text-muted" />
      <span className="truncate text-[13px]">{nazwa}</span>
    </span>
  )
}

const STAN_KROKU: Record<Krok['stan'], { ikona: LucideIcon; klasa: string; obrot?: boolean }> = {
  trwa: { ikona: LoaderCircle, klasa: 'text-accent', obrot: true },
  ok: { ikona: Check, klasa: 'text-muted' },
  blad: { ikona: TriangleAlert, klasa: 'text-warn' },
}

function Wiersz({ k, at, teraz }: { k: Krok; at: string; teraz: number }) {
  const [otwarty, setOtwarty] = useState(k.stan === 'blad')
  const o = opisKroku(k)
  const s = STAN_KROKU[k.stan]
  const ms = k.stan === 'trwa' ? teraz - new Date(at).getTime() : k.ms
  const czas = czasKroku(ms)
  const maSzczegol = Boolean(o.sciezka || o.detal)

  return (
    <li>
      <button
        type="button"
        onClick={() => maSzczegol && setOtwarty((x) => !x)}
        aria-expanded={maSzczegol ? otwarty : undefined}
        disabled={!maSzczegol}
        className="group flex w-full items-center gap-2 rounded-sm px-3 text-left h-9 md:h-krok enabled:hover:bg-raised/60"
      >
        <span className={`grid w-5 shrink-0 place-items-center ${s.klasa}`}>
          <Ikona jako={s.ikona} px={16} klasa={s.obrot ? 'obrot' : undefined} />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 t-tresc">
          <span className="shrink-0">{o.tytul}</span>
          {o.plik && <Pigulka nazwa={o.plik} />}
        </span>
        {czas && <span className="shrink-0 t-meta tabular-nums">{czas}</span>}
        {maSzczegol && (
          <Ikona
            jako={ChevronDown} px={14}
            klasa={`shrink-0 text-muted-cichy transition-transform ${otwarty ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {otwarty && maSzczegol && (
        <div className="pb-2 pl-10 pr-3 pt-0.5 text-[13px] leading-5 text-muted">
          {o.sciezka && <div>Na pliku: {o.sciezka}</div>}
          {o.detal && <div>Zobaczyłem: {o.detal}</div>}
          <div className="t-micro pt-0.5">{new Date(at).toLocaleTimeString('pl-PL')}</div>
        </div>
      )}
    </li>
  )
}

export function Przebieg({ wpisy, pracuje, teraz }: { wpisy: Wpis[]; pracuje: boolean; teraz: number }) {
  const kroki = paruj(wpisy.map((w) => w.event))
  const dowod = dowodZeZdarzen(wpisy.map((w) => w.event))
  const potkniecie = kroki.some((k) => k.stan === 'blad')
  const niepewne = dowod.nieSprawdzone.length > 0
  const zablokowane = dowod.niewolno.length > 0
  const zewnetrzne = dowod.zewnetrzne.length > 0
  const [zwiniety, setZwiniety] = useState(false)
  const zwijano = useRef(false)

  // Zwijamy 800 ms po zakończeniu — ale zła wiadomość nigdy nie chowa się sama.
  useEffect(() => {
    if (pracuje || zwijano.current || !kroki.length) return
    if (potkniecie || niepewne || zablokowane) { zwijano.current = true; return }
    const t = setTimeout(() => { setZwiniety(true); zwijano.current = true }, 800)
    return () => clearTimeout(t)
  }, [pracuje, kroki.length, potkniecie, niepewne, zablokowane])

  if (!kroki.length) return null

  const trwajacy = kroki.find((k) => k.stan === 'trwa')
  const msCalosc = kroki.reduce((a, k) => a + (k.ms ?? 0), 0)
  const czasCalosc = czasKroku(msCalosc)

  const naglowek = pracuje
    ? { ikona: LoaderCircle, klasa: 'text-accent', obrot: true, tekst: 'Pracuję nad tym…' }
    : potkniecie
      ? { ikona: TriangleAlert, klasa: 'text-warn', tekst: `Zrobione z potknięciem: ${podsumujGrupe(kroki).toLowerCase()}` }
      : { ikona: Check, klasa: 'text-ok', tekst: podsumujGrupe(kroki) }

  return (
    <section className="wjazd overflow-hidden rounded-lg border bg-surface" aria-label="Przebieg pracy">
      <h3>
        <button
          type="button"
          onClick={() => setZwiniety((z) => !z)}
          aria-expanded={!zwiniety}
          className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-raised/50"
        >
          <span className={`grid w-5 shrink-0 place-items-center ${naglowek.klasa}`}>
            <Ikona jako={naglowek.ikona} px={16} klasa={naglowek.obrot ? 'obrot' : undefined} />
          </span>
          <span className="min-w-0 flex-1 truncate t-tresc-m">{naglowek.tekst}</span>
          {pracuje && trwajacy && (
            <span className="shrink-0 t-meta">krok {kroki.indexOf(trwajacy) + 1}</span>
          )}
          {!pracuje && czasCalosc && <span className="shrink-0 t-meta tabular-nums">{czasCalosc}</span>}
          {!pracuje && niepewne && (
            <span className="flex shrink-0 items-center gap-1 text-warn t-meta">
              <Ikona jako={TriangleAlert} px={12} />
              {dowod.nieSprawdzone.length === 1 ? '1 rzecz niesprawdzona' : `${dowod.nieSprawdzone.length} rzeczy niesprawdzone`}
            </span>
          )}
          <Ikona
            jako={ChevronDown} px={16}
            klasa={`shrink-0 text-muted-cichy transition-transform ${zwiniety ? '' : 'rotate-180'}`}
          />
        </button>
      </h3>

      {!zwiniety && (
        <ul aria-label="Kroki pracy" className="relative space-y-0.5 border-t py-1.5">
          {/* oś: kreska biegnie pod kolumną ikon, nie przez nie */}
          <span aria-hidden className="pointer-events-none absolute bottom-3 left-[22px] top-3 w-px bg-line" />
          {kroki.map((k) => (
            <Wiersz key={k.i} k={k} at={wpisy[k.i]?.at ?? new Date().toISOString()} teraz={teraz} />
          ))}
        </ul>
      )}

      {/* Stopka dowodu zostaje widoczna także po zwinięciu — bez niej zwinięcie chowa
          jedyną rzecz, która odróżnia to narzędzie od zwykłego czatu. */}
      {(dowod.weszlo.length > 0 || dowod.zrobione.length > 0 || zewnetrzne || niepewne || zablokowane) && (
        <div className="space-y-1 border-t bg-raised/40 px-3 py-2.5">
          {(dowod.weszlo.length > 0 || dowod.zrobione.length > 0) && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Ikona jako={ShieldCheck} px={14} klasa="mt-0.5 shrink-0 text-ok" />
              <div>
                <span className="text-ink">Sprawdzone:</span>{' '}
                <span className="text-muted">{[...dowod.weszlo, ...dowod.zrobione].join(' · ')}</span>
              </div>
            </div>
          )}
          {zewnetrzne && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Ikona jako={Globe} px={14} klasa="mt-0.5 shrink-0 text-muted" />
              <div>
                {/* „Zapytałem", nie „sprawdziłem": z tego, że obcy serwer odpowiedział,
                    nie wynika, że odpowiedział prawdę ani że rzecz się wydarzyła. */}
                <span className="text-ink">Pytałem poza firmą:</span>{' '}
                <span className="text-muted">{dowod.zewnetrzne.join(' · ')}</span>
              </div>
            </div>
          )}
          {niepewne && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Ikona jako={TriangleAlert} px={14} klasa="mt-0.5 shrink-0 text-warn" />
              <div>
                <span className="text-ink">Nie sprawdziłem:</span>{' '}
                <span className="text-muted">{dowod.nieSprawdzone.join(' · ')}</span>
              </div>
            </div>
          )}
          {zablokowane && (
            <div className="flex gap-2 text-[13px] leading-5">
              <Ikona jako={Lock} px={14} klasa="mt-0.5 shrink-0 text-muted" />
              <div>
                <span className="text-ink">Na to nie masz zgody:</span>{' '}
                <span className="text-muted">{dowod.niewolno.join(' · ')}</span>
              </div>
            </div>
          )}
          <p className="t-micro pt-0.5">
            To jest lista tego, co faktycznie się wydarzyło — nie tego, co napisałem powyżej.
          </p>
        </div>
      )}

    </section>
  )
}

