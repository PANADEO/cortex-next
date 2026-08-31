'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Ikona } from './ikona'

type Toast = { id: number; tekst: string; cofnij?: () => void | Promise<void>; ton?: 'zwykly' | 'blad' }
type Ctx = { pokaz: (t: Omit<Toast, 'id'>) => void }

const TostCtx = createContext<Ctx>({ pokaz: () => {} })
export const useToast = () => useContext(TostCtx)

const CZAS = 8000

/**
 * Kasujemy od razu i dajemy cofnąć, zamiast pytać „czy na pewno".
 * Człowiek podejmuje decyzję widząc skutek, a nie wyobrażając go sobie.
 */
export function DostawcaTostow({ children }: { children: React.ReactNode }) {
  const [tosty, setTosty] = useState<Toast[]>([])
  const nastepny = useRef(1)

  const pokaz = useCallback((t: Omit<Toast, 'id'>) => {
    setTosty((x) => [...x, { ...t, id: nastepny.current++ }])
  }, [])
  const zamknij = useCallback((id: number) => setTosty((x) => x.filter((t) => t.id !== id)), [])

  // ⌘Z / Ctrl+Z cofa ostatni odwracalny toast
  useEffect(() => {
    function klawisz(e: KeyboardEvent) {
      if (e.key !== 'z' || !(e.metaKey || e.ctrlKey)) return
      const ostatni = [...tosty].reverse().find((t) => t.cofnij)
      if (!ostatni) return
      e.preventDefault()
      void ostatni.cofnij?.()
      zamknij(ostatni.id)
    }
    window.addEventListener('keydown', klawisz)
    return () => window.removeEventListener('keydown', klawisz)
  }, [tosty, zamknij])

  return (
    <TostCtx.Provider value={{ pokaz }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {tosty.map((t) => <Tost key={t.id} t={t} zamknij={() => zamknij(t.id)} />)}
      </div>
    </TostCtx.Provider>
  )
}

function Tost({ t, zamknij }: { t: Toast; zamknij: () => void }) {
  const [pauza, setPauza] = useState(false)
  const zostalo = useRef(CZAS)
  const [postep, setPostep] = useState(100)

  useEffect(() => {
    if (pauza) return
    const krok = 50
    const i = setInterval(() => {
      zostalo.current -= krok
      setPostep(Math.max(0, (zostalo.current / CZAS) * 100))
      if (zostalo.current <= 0) zamknij()
    }, krok)
    return () => clearInterval(i)
  }, [pauza, zamknij])

  return (
    <div
      role="status"
      onMouseEnter={() => setPauza(true)}
      onMouseLeave={() => setPauza(false)}
      className="wjazd pointer-events-auto w-full max-w-[380px] overflow-hidden rounded-md border bg-surface shadow-pop"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={`min-w-0 flex-1 text-[13px] leading-5 ${t.ton === 'blad' ? 'text-bad' : 'text-ink'}`}>{t.tekst}</span>
        {t.cofnij && (
          <button
            onClick={() => { void t.cofnij?.(); zamknij() }}
            className="shrink-0 rounded-sm px-2 py-1 text-[13px] font-medium text-akcent hover:bg-raised"
          >Cofnij</button>
        )}
        <button onClick={zamknij} aria-label="Zamknij powiadomienie" className="shrink-0 rounded-sm p-1 text-cichy hover:bg-raised">
          <Ikona jako={X} px={14} />
        </button>
      </div>
      <div className="h-0.5 bg-line">
        <div className="h-full bg-akcent/60 transition-[width] duration-75 ease-linear" style={{ width: `${postep}%` }} />
      </div>
    </div>
  )
}
