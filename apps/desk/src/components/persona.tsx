'use client'
import { useRouter } from 'next/navigation'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Check } from 'lucide-react'
import { Ikona } from './ikona'
import type { Uzytkownik } from '@/core/typy'

export function Awatar({ u, px = 36 }: { u: Uzytkownik; px?: number }) {
  return (
    <span
      style={{ width: px, height: px }}
      className="grid shrink-0 place-items-center rounded-pill border border-accent-soft-line bg-accent-soft text-[13px] font-semibold text-accent-soft-ink"
    >
      {u.imie[0]}{u.nazwisko[0]}
    </span>
  )
}

export function Persona({ ja, wszyscy }: { ja: Uzytkownik; wszyscy: Uzytkownik[] }) {
  const router = useRouter()
  async function przelacz(id: string) {
    await fetch('/api/persona', { method: 'POST', body: JSON.stringify({ id }) })
    router.push('/'); router.refresh()
  }
  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center gap-2.5 rounded-md p-1 text-left hover:bg-raised/70">
        <Awatar u={ja} />
        <span className="min-w-0 flex-1">
          <span className="block truncate t-tresc-m">{ja.imie} {ja.nazwisko}</span>
          <span className="block truncate t-meta">{ja.dzial}</span>
        </span>
        <Ikona jako={ChevronDown} px={16} klasa="shrink-0 text-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={4} className="z-50 min-w-[220px] rounded-md border bg-surface py-1 shadow-pop">
          <Menu.Label className="px-3 py-1 t-micro">Przełącz osobę (pokaz)</Menu.Label>
          {wszyscy.map((u) => (
            <Menu.Item
              key={u.id}
              onSelect={() => przelacz(u.id)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 t-tresc outline-none data-[highlighted]:bg-raised"
            >
              <Awatar u={u} px={24} />
              <span className="flex-1">{u.imie} {u.nazwisko}</span>
              {u.id === ja.id && <Ikona jako={Check} px={16} klasa="text-accent" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
