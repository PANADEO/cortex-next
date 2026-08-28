'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Paperclip, ArrowUp, ChevronDown, LoaderCircle } from 'lucide-react'
import { Ikona } from './ikona'
import { PrzyciskCoPotrafie } from './co-potrafie'
import { useToast } from './toast'
import type { Polityka } from '@/core/typy'

type Z = { tytul: string; podpowiedz: string; tresc: string }

export function Zlecenia({ zlecenia, polityka: p, maSprawy }: {
  zlecenia: Z[]
  polityka: Polityka
  maSprawy: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const { pokaz } = useToast()
  const [tresc, setTresc] = useState('')
  const [zajete, setZajete] = useState(false)
  const [wgrywa, setWgrywa] = useState(false)
  const [pokazPodpowiedzi, setPokazPodpowiedzi] = useState(false)
  const pole = useRef<HTMLTextAreaElement>(null)
  const wybor = useRef<HTMLInputElement>(null)

  // ?nowa=1 z paska bocznego ustawia kursor w polu, zamiast tylko przeładowywać stronę
  useEffect(() => {
    if (!params.get('nowa')) return
    pole.current?.focus()
    pole.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    window.history.replaceState(null, '', '/')
  }, [params])

  async function start(t: string) {
    if (!t.trim() || zajete) return
    setZajete(true)
    try {
      const r = await fetch('/api/sprawa/nowa', { method: 'POST', body: JSON.stringify({ tytul: t.slice(0, 60) }) })
      const { id } = await r.json()
      await fetch(`/api/sprawa/${id}/tura`, { method: 'POST', body: JSON.stringify({ tresc: t }) })
      router.push(`/sprawa/${id}`)
    } catch {
      setZajete(false)
      pokaz({ tekst: 'Nie udało się zacząć sprawy. Spróbuj jeszcze raz.', ton: 'blad' })
    }
  }

  async function dodajPlik(files: FileList | null) {
    if (!files?.length) return
    setWgrywa(true)
    const fd = new FormData()
    fd.append('katalog', 'Moje pliki')
    Array.from(files).forEach((f) => fd.append('plik', f))
    const r = await fetch('/api/pliki/wgraj', { method: 'POST', body: fd })
    setWgrywa(false)
    if (!r.ok) { pokaz({ tekst: 'Nie udało się dodać pliku.', ton: 'blad' }); return }
    const nazwy = Array.from(files).map((f) => f.name)
    pokaz({ tekst: nazwy.length === 1 ? `Dodane do Moich plików: ${nazwy[0]}` : `Dodane do Moich plików: ${nazwy.length} pliki` })
    setTresc((t) => (t ? `${t.trimEnd()}\n\nPracuj na pliku: ${nazwy.join(', ')}` : `Pracuj na pliku: ${nazwy.join(', ')}`))
    pole.current?.focus()
  }

  // przy pustym biurku podpowiedzi są głównym wejściem, później schodzą do chipów
  const trybKart = maSprawy === 0
  const trybChipow = maSprawy > 0 && maSprawy < 5

  return (
    <div>
      <div className="rounded-xl border bg-surface shadow-pop">
        <textarea
          ref={pole} value={tresc} onChange={(e) => setTresc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (window.matchMedia('(hover: hover)').matches && !e.shiftKey) { e.preventDefault(); start(tresc) }
          }}
          placeholder="Co mam dla Ciebie zrobić?" rows={3}
          className="w-full resize-none bg-transparent px-4 pt-3.5 t-tresc outline-none placeholder:text-muted-cichy"
        />
        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          <input ref={wybor} type="file" multiple hidden onChange={(e) => dodajPlik(e.target.files)} />
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
            onClick={() => start(tresc)} disabled={!tresc.trim() || zajete}
            aria-label="Zleć zadanie"
            className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-35"
          >
            <Ikona jako={zajete ? LoaderCircle : ArrowUp} px={16} klasa={zajete ? 'obrot' : undefined} />
          </button>
        </div>
      </div>

      {trybKart && (
        <>
          <p className="mb-2.5 mt-5 t-meta">Zacznij od jednej z rzeczy, które umiem w Twoim dziale:</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {zlecenia.map((z) => (
              <button
                key={z.tytul} onClick={() => { setTresc(z.tresc); pole.current?.focus() }}
                className="rounded-lg border bg-surface p-3.5 text-left transition hover:border-line-mocna hover:bg-raised/40"
              >
                <div className="t-tresc-m">{z.tytul}</div>
                <div className="mt-0.5 t-meta">{z.podpowiedz}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {trybChipow && (
        <div className="mt-3 flex flex-wrap gap-2">
          {zlecenia.map((z) => (
            <button
              key={z.tytul} onClick={() => { setTresc(z.tresc); pole.current?.focus() }}
              className="h-8 rounded-pill border bg-surface px-3 text-[13px] text-muted hover:border-line-mocna hover:text-ink"
            >{z.tytul}</button>
          ))}
        </div>
      )}

      {!trybKart && !trybChipow && (
        <div className="mt-3">
          <button
            onClick={() => setPokazPodpowiedzi((x) => !x)}
            className="flex items-center gap-1 t-meta hover:text-ink"
          >
            Podpowiedzi
            <Ikona jako={ChevronDown} px={12} klasa={pokazPodpowiedzi ? 'rotate-180' : ''} />
          </button>
          {pokazPodpowiedzi && (
            <div className="mt-2 flex flex-wrap gap-2">
              {zlecenia.map((z) => (
                <button
                  key={z.tytul} onClick={() => { setTresc(z.tresc); pole.current?.focus() }}
                  className="h-8 rounded-pill border bg-surface px-3 text-[13px] text-muted hover:border-line-mocna hover:text-ink"
                >{z.tytul}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
