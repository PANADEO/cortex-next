'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Paperclip, ArrowUp, ChevronDown, LoaderCircle } from 'lucide-react'
import { Ikona } from './ikona'
import { PrzyciskCoPotrafie } from './co-potrafie'
import { ListaZalacznikow, type Zalacznik } from './zalaczniki'
import { useToast } from './toast'
import type { Polityka } from '@cortex/desk-core/typy'
import { api } from '../trasy'

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
  const [zal, setZal] = useState<(Zalacznik & { plik: File })[]>([])
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

  /**
   * Załączniki czekają lokalnie do momentu wysłania: dopiero wtedy powstaje sprawa i pliki
   * trafiają do JEJ teczki. „Moje pliki" zostają przestrzenią, do której człowiek kładzie
   * rzeczy świadomie, a nie workiem na wszystko, co przewinęło się przez rozmowę.
   */
  async function start(t: string) {
    if ((!t.trim() && !zal.length) || zajete) return
    setZajete(true)
    try {
      const tytul = t.trim() ? t.slice(0, 60) : zal[0].nazwa
      const r = await fetch(api('/sprawa/nowa'), { method: 'POST', body: JSON.stringify({ tytul }) })
      const { id } = await r.json()

      let nazwy: string[] = []
      if (zal.length) {
        const fd = new FormData()
        fd.append('sprawaId', id)
        zal.forEach((z) => fd.append('plik', z.plik))
        const w = await fetch(api('/pliki/wgraj'), { method: 'POST', body: fd })
        const d = await w.json().catch(() => ({}))
        if (!w.ok) throw new Error(d.blad ?? 'nie udało się dołączyć plików')
        nazwy = d.nazwy ?? []
      }

      const tura = await fetch(`${api('')}/sprawa/${id}/tura`, {
        method: 'POST',
        body: JSON.stringify({ tresc: t, zalaczniki: nazwy }),
      })
      if (!tura.ok) {
        // serwer odmawia m.in. przy wyczerpanym limicie dziennym; bez tego tekst przepadał,
        // a człowiek lądował w pustej sprawie i nie wiedział, czy w ogóle kliknął
        const d = await tura.json().catch(() => ({}))
        throw new Error(d.blad ?? 'Nie udało się przyjąć zlecenia.')
      }
      router.push(`/sprawa/${id}`)
    } catch (e) {
      setZajete(false)
      setTresc(t)
      pole.current?.focus()
      pokaz({ tekst: e instanceof Error ? e.message : 'Nie udało się zacząć sprawy. Spróbuj jeszcze raz.', ton: 'blad' })
    }
  }

  function dodajPlik(files: FileList | null) {
    if (!files?.length) return
    setZal((z) => [...z, ...Array.from(files).map((f) => ({
      nazwa: f.name,
      podglad: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      plik: f,
    }))])
    pole.current?.focus()
  }

  // przy pustym biurku podpowiedzi są głównym wejściem, później schodzą do chipów
  const trybKart = maSprawy === 0
  const trybChipow = maSprawy > 0 && maSprawy < 5

  return (
    <div>
      <div className="rounded-xl border bg-surface shadow-pop">
        <ListaZalacznikow
          pliki={zal}
          usun={(n) => setZal((z) => z.filter((x) => x.nazwa !== n))}
          klasa="px-4 pt-4"
        />
        <textarea
          ref={pole} value={tresc} onChange={(e) => setTresc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (window.matchMedia('(hover: hover)').matches && !e.shiftKey) { e.preventDefault(); start(tresc) }
          }}
          onPaste={(e) => {
            const pliki = Array.from(e.clipboardData.files)
            if (!pliki.length) return
            e.preventDefault()
            const dt = new DataTransfer()
            pliki.forEach((f) => dt.items.add(f))
            dodajPlik(dt.files)
          }}
          placeholder="Co mam dla Ciebie zrobić?" rows={3}
          className="w-full resize-none bg-transparent px-4 pt-3.5 t-tresc outline-none placeholder:text-muted-cichy"
        />
        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          <input ref={wybor} type="file" multiple hidden onChange={(e) => { dodajPlik(e.target.files); e.target.value = '' }} />
          <button
            type="button" onClick={() => wybor.current?.click()}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink"
          >
            <Ikona jako={Paperclip} px={14} /> Dodaj plik
          </button>
          <PrzyciskCoPotrafie p={p} />
          <div className="flex-1" />
          <button
            onClick={() => start(tresc)} disabled={(!tresc.trim() && !zal.length) || zajete}
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
