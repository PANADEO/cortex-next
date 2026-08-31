'use client'
import { Download, Maximize2 } from 'lucide-react'
import { Ikona } from './ikona'
import { ikonaPliku } from './wiersz-pliku'
import { adresPliku } from './podglad'
import type { PlikMeta } from '@cortex/desk-core/typy'
import { rozmiar } from '@/lib'

const jestObrazem = (n: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(n)
const rodzaj = (n: string) => (n.split('.').pop() ?? '').toUpperCase()

/**
 * To, co powstało w tej turze, pokazujemy W ROZMOWIE, a nie tylko w panelu z boku.
 *
 * Obrazek bez podglądu to sama nazwa pliku — a nazwa nie mówi, czy słoń wyszedł dobrze.
 * Dokument dostaje kartę zamiast obrazu, bo jego treść i tak nie zmieści się w strumieniu;
 * karta ma powiedzieć, że rzecz istnieje, i wpuścić do panelu jednym kliknięciem.
 */
export function Artefakty({ pliki, otworz }: {
  pliki: PlikMeta[]
  otworz: (p: PlikMeta) => void
}) {
  if (!pliki.length) return null
  return (
    <div className="flex flex-col gap-3">
      {pliki.map((p) =>
        jestObrazem(p.nazwa)
          ? <Obrazek key={p.sciezka} plik={p} otworz={() => otworz(p)} />
          : <Karta key={p.sciezka} plik={p} otworz={() => otworz(p)} />,
      )}
    </div>
  )
}

function Obrazek({ plik, otworz }: { plik: PlikMeta; otworz: () => void }) {
  return (
    <figure className="max-w-[420px]">
      <button
        onClick={otworz} title="Otwórz w panelu" aria-label={`Otwórz ${plik.nazwa}`}
        className="block w-full overflow-hidden rounded-lg border bg-surface transition hover:border-line-mocna"
      >
        <img
          src={adresPliku(plik)} alt={plik.nazwa}
          className="block max-h-[420px] w-full bg-sunken object-contain"
        />
      </button>
      <figcaption className="flex items-center gap-2 px-0.5 pt-1.5">
        <span className="min-w-0 flex-1 truncate t-meta">{plik.nazwa}</span>
        <a
          href={adresPliku(plik, true)} download title="Pobierz" aria-label={`Pobierz ${plik.nazwa}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted hover:bg-raised hover:text-ink"
        ><Ikona jako={Download} px={14} /></a>
      </figcaption>
    </figure>
  )
}

function Karta({ plik, otworz }: { plik: PlikMeta; otworz: () => void }) {
  return (
    <button
      onClick={otworz} aria-label={`Otwórz ${plik.nazwa}`}
      className="group/karta flex w-full max-w-[420px] items-center gap-3 rounded-lg border bg-surface p-2.5 text-left transition hover:border-line-mocna hover:bg-raised/40"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-raised text-muted">
        <Ikona jako={ikonaPliku(plik)} px={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate t-tresc-m">{plik.nazwa}</span>
        <span className="block t-meta">Dokument · {rodzaj(plik.nazwa)} · {rozmiar(plik.rozmiar)}</span>
      </span>
      <Ikona jako={Maximize2} px={16} klasa="shrink-0 text-muted-cichy group-hover/karta:text-ink" />
    </button>
  )
}
