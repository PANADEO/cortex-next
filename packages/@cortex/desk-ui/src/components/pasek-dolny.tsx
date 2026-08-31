'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutList, FolderOpen, CircleUser } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Ikona } from './ikona'

const POZYCJE: { href: string; etykieta: string; ikona: LucideIcon }[] = [
  { href: '/', etykieta: 'Sprawy', ikona: LayoutList },
  { href: '/pliki', etykieta: 'Pliki', ikona: FolderOpen },
  { href: '/ja', etykieta: 'Ja', ikona: CircleUser },
]

/** Na telefonie nawigacja musi być pod kciukiem — bez tego z ekranu plików nie ma jak wyjść. */
export function PasekDolny() {
  const sciezka = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-pasek border-t bg-surface md:hidden">
      {POZYCJE.map((p) => {
        const aktywna = p.href === '/' ? sciezka === '/' : sciezka.startsWith(p.href)
        return (
          <Link
            key={p.href} href={p.href}
            aria-current={aktywna ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 ${aktywna ? 'text-ink' : 'text-cichy'}`}
          >
            {aktywna && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-pill bg-akcent" />}
            <Ikona jako={p.ikona} px={20} />
            <span className="text-[11px] leading-none">{p.etykieta}</span>
          </Link>
        )
      })}
    </nav>
  )
}
