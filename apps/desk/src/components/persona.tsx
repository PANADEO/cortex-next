'use client'
import { useRouter } from 'next/navigation'
import type { Uzytkownik } from '@/core/typy'

export function Persona({ ja, wszyscy }: { ja: Uzytkownik; wszyscy: Uzytkownik[] }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink">
        {ja.imie[0]}{ja.nazwisko[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{ja.imie} {ja.nazwisko}</div>
        <div className="truncate text-xs text-muted">{ja.dzial}</div>
      </div>
      <select
        aria-label="Przełącz osobę (demo)"
        className="rounded-md border bg-surface px-1.5 py-1 text-xs text-muted"
        value={ja.id}
        onChange={async (e) => {
          await fetch('/api/persona', { method: 'POST', body: JSON.stringify({ id: e.target.value }) })
          router.push('/'); router.refresh()
        }}
      >
        {wszyscy.map((u) => <option key={u.id} value={u.id}>{u.imie}</option>)}
      </select>
    </div>
  )
}
