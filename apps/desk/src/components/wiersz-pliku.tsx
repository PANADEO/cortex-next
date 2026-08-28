'use client'
import { useEffect, useRef, useState } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import {
  Folder, FileText, FileSpreadsheet, FileImage, FileType, MoreHorizontal,
  Eye, Download, Pencil, FolderInput, FolderOutput, Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Ikona } from './ikona'
import type { PlikMeta } from '@/core/typy'
import { rozmiar, kiedy } from '@/lib'

export function ikonaPliku(p: { nazwa: string; katalog: boolean }): LucideIcon {
  if (p.katalog) return Folder
  if (/\.(csv|xlsx?|tsv)$/i.test(p.nazwa)) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(p.nazwa)) return FileImage
  if (/\.pdf$/i.test(p.nazwa)) return FileType
  return FileText
}

/** Rozszerzenie musi zostać widoczne — księgowa odróżnia .csv od .md właśnie po nim. */
function rozbijNazwe(n: string) {
  const i = n.lastIndexOf('.')
  return i > 0 ? { rdzen: n.slice(0, i), ext: n.slice(i) } : { rdzen: n, ext: '' }
}

export type AkcjePliku = {
  podglad?: (p: PlikMeta) => void
  pobierz?: (p: PlikMeta) => void
  zmienNazwe?: (p: PlikMeta, nowa: string) => Promise<string | null>
  przenies?: (p: PlikMeta) => void
  doMoichPlikow?: (p: PlikMeta) => void
  doSprawy?: (p: PlikMeta) => void
  usun?: (p: PlikMeta) => void
  otworzKatalog?: (p: PlikMeta) => void
}

export function WierszPliku({ p, akcje, aktywny }: { p: PlikMeta; akcje: AkcjePliku; aktywny?: boolean }) {
  const [edycja, setEdycja] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const pole = useRef<HTMLInputElement>(null)
  const { rdzen, ext } = rozbijNazwe(p.nazwa)

  useEffect(() => {
    if (!edycja) return
    const el = pole.current
    if (!el) return
    el.focus()
    // zaznaczamy sam rdzeń — rozszerzenia nikt nie chce przepisywać
    el.setSelectionRange(0, rozbijNazwe(el.value).rdzen.length)
  }, [edycja])

  async function zapiszNazwe() {
    const nowa = pole.current?.value.trim()
    if (!nowa || nowa === p.nazwa) { setEdycja(false); setBlad(null); return }
    const b = await akcje.zmienNazwe?.(p, nowa)
    if (b) setBlad(b)
    else { setEdycja(false); setBlad(null) }
  }

  const glowna = () => {
    if (p.katalog) akcje.otworzKatalog?.(p)
    else akcje.podglad?.(p)
  }

  return (
    <li className={aktywny ? 'bg-raised' : undefined}>
      <div className="group flex h-wiersz items-center gap-2 px-3 hover:bg-raised/60">
        <span className="grid w-7 shrink-0 place-items-center text-muted">
          <Ikona jako={ikonaPliku(p)} px={16} />
        </span>

        {edycja ? (
          <input
            ref={pole} defaultValue={p.nazwa}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void zapiszNazwe() }
              if (e.key === 'Escape') { setEdycja(false); setBlad(null) }
            }}
            onBeforeInput={(e) => {
              const d = (e as unknown as { data?: string }).data
              if (d && (d.includes('/') || d.includes('\\'))) e.preventDefault()
            }}
            onBlur={() => void zapiszNazwe()}
            aria-label="Nowa nazwa pliku"
            className="min-w-0 flex-1 rounded-sm border bg-bg px-1.5 py-0.5 t-tresc outline-none"
          />
        ) : (
          <button onClick={glowna} className="flex min-w-0 flex-1 items-center text-left t-tresc-m">
            <span className="truncate">{rdzen}</span>
            <span className="shrink-0 text-muted">{ext}</span>
          </button>
        )}

        <span className="hidden shrink-0 t-meta sm:block">{p.katalog ? '' : rozmiar(p.rozmiar)}</span>
        <span className="hidden w-24 shrink-0 text-right t-meta sm:block">{kiedy(p.zmieniony)}</span>

        <Menu.Root>
          <Menu.Trigger
            aria-label={`Więcej opcji dla ${p.nazwa}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted opacity-0 hover:bg-raised focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Ikona jako={MoreHorizontal} px={16} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="end" sideOffset={4}
              // po zamknięciu Radix domyślnie oddaje fokus wyzwalaczowi — a my przy „Zmień nazwę"
              // chcemy go w polu edycji, więc przejmujemy to na siebie
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="z-50 min-w-[220px] overflow-hidden rounded-md border bg-surface py-1 shadow-pop"
            >
              {!p.katalog && akcje.podglad && <Pozycja ikona={Eye} etykieta="Otwórz podgląd" skrot="Enter" na={() => akcje.podglad?.(p)} />}
              {!p.katalog && akcje.pobierz && <Pozycja ikona={Download} etykieta="Pobierz" na={() => akcje.pobierz?.(p)} />}
              {akcje.zmienNazwe && <Rozdzielacz />}
              {akcje.zmienNazwe && <Pozycja ikona={Pencil} etykieta="Zmień nazwę" skrot="F2" na={() => setEdycja(true)} />}
              {akcje.przenies && <Pozycja ikona={FolderInput} etykieta="Przenieś do…" na={() => akcje.przenies?.(p)} />}
              {akcje.doSprawy && <Pozycja ikona={FolderOutput} etykieta="Dołącz do sprawy" na={() => akcje.doSprawy?.(p)} />}
              {akcje.doMoichPlikow && <Pozycja ikona={FolderOutput} etykieta="Zapisz do Moich plików" na={() => akcje.doMoichPlikow?.(p)} />}
              {akcje.usun && <Rozdzielacz />}
              {akcje.usun && <Pozycja ikona={Trash2} etykieta="Usuń" skrot="Delete" grozny na={() => akcje.usun?.(p)} />}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      {blad && <div className="px-3 pb-2 pl-12 text-[12px] text-bad">{blad}</div>}
    </li>
  )
}

function Rozdzielacz() {
  return <Menu.Separator className="my-1 h-px bg-line" />
}

function Pozycja({ ikona, etykieta, skrot, na, grozny }: {
  ikona: LucideIcon; etykieta: string; skrot?: string; na: () => void; grozny?: boolean
}) {
  return (
    <Menu.Item
      onSelect={na}
      className={`flex cursor-pointer items-center gap-2.5 px-3 py-1.5 t-tresc outline-none data-[highlighted]:bg-raised ${grozny ? 'text-bad' : ''}`}
    >
      <Ikona jako={ikona} px={16} klasa={grozny ? undefined : 'text-muted'} />
      <span className="flex-1">{etykieta}</span>
      {skrot && <span className="t-micro">{skrot}</span>}
    </Menu.Item>
  )
}
