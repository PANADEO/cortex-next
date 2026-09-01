"use client"
import { X } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { Icon } from "./icon"

type Toast = {
  id: number
  text: string
  revoke?: () => void | Promise<void>
  tone?: "normal" | "error"
}
type Ctx = { toast: (t: Omit<Toast, "id">) => void }

const ToastCtx = createContext<Ctx>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)

const DURATION = 8000

/**
 * Kasujemy od razu i dajemy cofnąć, zamiast pytać „czy na pewno".
 * Człowiek podejmuje decyzję widząc skutek, a nie wyobrażając go sobie.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)

  const toast = useCallback((t: Omit<Toast, "id">) => {
    setToasts((x) => [...x, { ...t, id: next.current++ }])
  }, [])
  const close = useCallback((id: number) => setToasts((x) => x.filter((t) => t.id !== id)), [])

  // ⌘Z / Ctrl+Z cofa ostatni odwracalny toast
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key !== "z" || !(e.metaKey || e.ctrlKey)) return
      const last = [...toasts].reverse().find((t) => t.revoke)
      if (!last) return
      e.preventDefault()
      void last.revoke?.()
      close(last.id)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [toasts, close])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} close={() => close(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function ToastItem({ t, close }: { t: Toast; close: () => void }) {
  const [paused, setPaused] = useState(false)
  const left = useRef(DURATION)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (paused) return
    const step = 50
    const i = setInterval(() => {
      left.current -= step
      setProgress(Math.max(0, (left.current / DURATION) * 100))
      if (left.current <= 0) close()
    }, step)
    return () => clearInterval(i)
  }, [paused, close])

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="wjazd pointer-events-auto w-full max-w-[380px] overflow-hidden rounded-md border bg-surface shadow-pop"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className={`min-w-0 flex-1 text-[13px] leading-5 ${t.tone === "error" ? "text-bad" : "text-ink"}`}
        >
          {t.text}
        </span>
        {t.revoke && (
          <button
            onClick={() => {
              void t.revoke?.()
              close()
            }}
            className="shrink-0 rounded-sm px-2 py-1 text-[13px] font-medium text-akcent hover:bg-raised"
          >
            Cofnij
          </button>
        )}
        <button
          onClick={close}
          aria-label="Zamknij powiadomienie"
          className="shrink-0 rounded-sm p-1 text-cichy hover:bg-raised"
        >
          <Icon as={X} px={14} />
        </button>
      </div>
      <div className="h-0.5 bg-line">
        <div
          className="h-full bg-akcent/60 transition-[width] duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
