'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Lock, ChevronDown, ShieldCheck } from 'lucide-react'
import { Ikona } from './ikona'
import { useToast } from './toast'
import type { Polityka } from '@/core/typy'

/**
 * „Co potrafię" mieszka tam, gdzie jest potrzebne: przy polu zlecenia.
 * Zablokowana zdolność jest widoczna dla CZŁOWIEKA (z działem-właścicielem i prośbą o dostęp),
 * ale nigdy nie trafia do modelu — tam po prostu nie ma takiego narzędzia.
 */
export function ListaZdolnosci({ p, gesta }: { p: Polityka; gesta?: boolean }) {
  const [wyslane, setWyslane] = useState<string[]>([])
  const { pokaz } = useToast()

  async function popros(id: string, nazwa: string) {
    await fetch('/api/prosba', { method: 'POST', body: JSON.stringify({ zdolnosc: id }) })
    setWyslane((w) => [...w, id])
    pokaz({ tekst: `Prośba o „${nazwa}" poszła do działu. Dostaniesz znać, gdy ktoś ją rozpatrzy.` })
  }

  return (
    <div className={gesta ? 'text-[13px]' : 'text-[14px]'}>
      <ul className="space-y-0.5">
        {p.przyznane.map((z) => (
          <li key={z.id} className="flex items-start gap-2 rounded-sm px-1 py-1">
            <Ikona jako={Check} px={16} klasa="mt-0.5 shrink-0 text-ok" />
            <div className="min-w-0">
              <div>{z.nazwa}</div>
              {!gesta && <div className="t-meta">{z.opis}</div>}
            </div>
          </li>
        ))}
      </ul>

      {p.zablokowane.length > 0 && (
        <>
          <div className="mt-2.5 border-t pt-2.5 t-micro">Tego u Ciebie nie umiem:</div>
          <ul className="mt-1 space-y-1.5">
            {p.zablokowane.map((z) => (
              <li key={z.id} className="flex items-start gap-2 rounded-sm px-1 py-0.5">
                <Ikona jako={Lock} px={16} klasa="mt-0.5 shrink-0 text-muted-cichy" />
                <div className="min-w-0 flex-1">
                  <div className="text-muted">{z.nazwa}</div>
                  <div className="t-micro">zgoda należy do działu: {z.dzial}</div>
                  {wyslane.includes(z.id) ? (
                    <div className="mt-1 flex items-center gap-1 text-[12px] text-ok">
                      <Ikona jako={ShieldCheck} px={12} /> Prośba wysłana — czeka na rozpatrzenie
                    </div>
                  ) : (
                    <button
                      onClick={() => popros(z.id, z.nazwa)}
                      className="mt-1 rounded-sm border px-2 py-0.5 text-[12px] hover:bg-raised"
                    >Poproś o dostęp</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ile(n: number, j: string, k: string, w: string) {
  const d = n % 10, s = n % 100
  if (n === 1) return `${n} ${j}`
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${k}`
  return `${n} ${w}`
}

/** Przy polu zlecenia — jeden klik odpowiada na pytanie „czy on to w ogóle umie?". */
export function PrzyciskCoPotrafie({ p }: { p: Polityka }) {
  const [otwarty, setOtwarty] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!otwarty) return
    function pozaBoxem(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOtwarty(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setOtwarty(false) }
    document.addEventListener('mousedown', pozaBoxem)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', pozaBoxem); document.removeEventListener('keydown', esc) }
  }, [otwarty])

  return (
    <div ref={box} className="relative">
      <button
        type="button" onClick={() => setOtwarty((o) => !o)} aria-expanded={otwarty}
        className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink"
      >
        <Ikona jako={Check} px={14} klasa="text-ok" />
        Umiem tu {ile(p.przyznane.length, 'rzecz', 'rzeczy', 'rzeczy')}
        <Ikona jako={ChevronDown} px={14} klasa={`transition-transform ${otwarty ? 'rotate-180' : ''}`} />
      </button>
      {otwarty && (
        <div className="wjazd absolute bottom-full left-0 z-40 mb-2 w-[320px] rounded-lg border bg-surface p-3 shadow-pop">
          <ListaZdolnosci p={p} gesta />
        </div>
      )}
    </div>
  )
}
