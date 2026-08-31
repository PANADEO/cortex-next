'use client'
import { useEffect, useState } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
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
  const [odrzucone, setOdrzucone] = useState<string[]>([])
  const { pokaz } = useToast()

  // stan prośby żyje w bazie, nie w komponencie — inaczej znika przy pierwszym F5
  useEffect(() => {
    let zyje = true
    fetch('/api/prosba', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { prosby?: { zdolnosc: string; stan: string }[] }) => {
        if (!zyje) return
        setWyslane((d.prosby ?? []).filter((x) => x.stan === 'oczekuje').map((x) => x.zdolnosc))
        setOdrzucone((d.prosby ?? []).filter((x) => x.stan === 'odrzucona').map((x) => x.zdolnosc))
      })
      .catch(() => {})
    return () => { zyje = false }
  }, [])

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
                    <>
                      {odrzucone.includes(z.id) && (
                        <div className="mt-1 text-[12px] text-muted">Poprzednia prośba została odrzucona.</div>
                      )}
                      <button
                        onClick={() => popros(z.id, z.nazwa)}
                        className="mt-1 rounded-sm border px-2 py-0.5 text-[12px] hover:bg-raised"
                      >{odrzucone.includes(z.id) ? 'Poproś ponownie' : 'Poproś o dostęp'}</button>
                    </>
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
  return (
    <Menu.Root open={otwarty} onOpenChange={setOtwarty}>
      <Menu.Trigger className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink">
        <Ikona jako={Check} px={14} klasa="text-ok" />
        Umiem tu {ile(p.przyznane.length, 'rzecz', 'rzeczy', 'rzeczy')}
        <Ikona jako={ChevronDown} px={14} klasa={`transition-transform ${otwarty ? 'rotate-180' : ''}`} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side="top" align="start" sideOffset={8} collisionPadding={12}
          // Radix sam odbija zawartość od krawędzi okna i podaje wysokość, która realnie została;
          // wcześniej własny popover po prostu wychodził poza ekran i tracił górne pozycje.
          style={{ maxHeight: 'var(--radix-dropdown-menu-content-available-height)' }}
          className="z-50 w-[320px] overflow-y-auto rounded-lg border bg-surface p-3 shadow-pop"
        >
          <ListaZdolnosci p={p} gesta />
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
