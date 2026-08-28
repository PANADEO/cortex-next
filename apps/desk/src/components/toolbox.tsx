'use client'
import { useState } from 'react'
import type { Polityka } from '@/core/typy'

export function Toolbox({ p }: { p: Polityka }) {
  const [wyslane, setWyslane] = useState<string[]>([])
  return (
    <div>
      <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Co potrafię</div>
      <ul className="space-y-0.5 px-1.5">
        {p.przyznane.map((z) => (
          <li key={z.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-sm" title={z.opis}>
            <span className="mt-0.5 text-ok">✓</span><span>{z.nazwa}</span>
          </li>
        ))}
        {p.zablokowane.length > 0 && <li className="mx-1.5 my-1.5 border-t" />}
        {p.zablokowane.map((z) => (
          <li key={z.id} className="rounded-md px-1.5 py-1">
            <div className="flex items-start gap-2 text-sm text-muted" title={z.opis}>
              <span className="mt-0.5">🔒</span>
              <div className="min-w-0">
                <div>{z.nazwa}</div>
                <div className="text-[11px]">dział: {z.dzial}</div>
                {wyslane.includes(z.id) ? (
                  <div className="mt-1 text-[11px] text-ok">Prośba wysłana — oczekuje</div>
                ) : (
                  <button
                    className="mt-1 rounded-md border px-2 py-0.5 text-[11px] hover:bg-raised"
                    onClick={async () => {
                      await fetch('/api/prosba', { method: 'POST', body: JSON.stringify({ zdolnosc: z.id }) })
                      setWyslane((w) => [...w, z.id])
                    }}
                  >Poproś o dostęp</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
