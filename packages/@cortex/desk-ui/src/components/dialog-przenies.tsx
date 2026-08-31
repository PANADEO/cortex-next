'use client'
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Folder, FolderPlus, Check } from 'lucide-react'
import { Ikona } from './ikona'
import type { PlikMeta } from '@cortex/desk-core/typy'
import { api } from '../trasy'

/** Wybór miejsca z listy — nikt nie ma wpisywać ścieżki „Moje pliki/Wnioski 2026" z pamięci. */
export function DialogPrzenies({ plik, zamknij, przenies }: {
  plik: PlikMeta | null
  zamknij: () => void
  przenies: (docelowy: string) => Promise<void>
}) {
  const [katalogi, setKatalogi] = useState<string[]>([])
  const [wybrany, setWybrany] = useState<string | null>(null)
  const [nowy, setNowy] = useState('')
  const [tworzy, setTworzy] = useState(false)
  const [zajete, setZajete] = useState(false)

  const teraz = plik ? plik.sciezka.split('/').slice(0, -1).join('/') : ''

  useEffect(() => {
    if (!plik) return
    setWybrany(null); setNowy(''); setTworzy(false)
    fetch(`${api('/pliki')}?drzewo=1`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setKatalogi(d.katalogi ?? []))
  }, [plik])

  async function utworz() {
    const n = nowy.trim()
    if (!n) return
    const sciezka = `${wybrany ?? 'Moje pliki'}/${n}`
    await fetch(api('/pliki'), { method: 'POST', body: JSON.stringify({ akcja: 'katalog', sciezka }) })
    const d = await (await fetch(`${api('/pliki')}?drzewo=1`, { cache: 'no-store' })).json()
    setKatalogi(d.katalogi ?? [])
    setWybrany(sciezka); setNowy(''); setTworzy(false)
  }

  return (
    <Dialog.Root open={Boolean(plik)} onOpenChange={(o) => !o && zamknij()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-surface shadow-okno">
          <div className="border-b px-4 py-3">
            <Dialog.Title className="t-h3">Przenieś do</Dialog.Title>
            <Dialog.Description className="t-meta">Przenoszę: {plik?.nazwa}</Dialog.Description>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {katalogi.map((k) => {
              const tutaj = k === teraz
              const zaznaczony = wybrany === k
              const poziom = k.split('/').length - 1
              return (
                <li key={k}>
                  <button
                    disabled={tutaj}
                    onClick={() => setWybrany(k)}
                    style={{ paddingLeft: 8 + poziom * 16 }}
                    className={`flex h-9 w-full items-center gap-2 rounded-sm pr-2 text-left t-tresc disabled:opacity-45 ${zaznaczony ? 'bg-raised' : 'hover:bg-raised/60'}`}
                  >
                    <Ikona jako={Folder} px={16} klasa="shrink-0 text-cichy" />
                    <span className="min-w-0 flex-1 truncate">{k.split('/').pop()}</span>
                    {tutaj && <span className="shrink-0 t-micro">plik już tu jest</span>}
                    {zaznaczony && <Ikona jako={Check} px={16} klasa="shrink-0 text-akcent" />}
                  </button>
                </li>
              )
            })}
            <li>
              {tworzy ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <Ikona jako={Folder} px={16} klasa="shrink-0 text-cichy" />
                  <input
                    autoFocus value={nowy} onChange={(e) => setNowy(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void utworz(); if (e.key === 'Escape') setTworzy(false) }}
                    placeholder="Nazwa folderu" aria-label="Nazwa nowego folderu"
                    className="min-w-0 flex-1 rounded-sm border bg-bg px-1.5 py-1 t-tresc outline-none"
                  />
                  <button onClick={() => void utworz()} className="rounded-sm px-2 py-1 t-btn text-akcent hover:bg-raised">Utwórz</button>
                </div>
              ) : (
                <button onClick={() => setTworzy(true)} className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left t-tresc text-cichy hover:bg-raised/60">
                  <Ikona jako={FolderPlus} px={16} klasa="shrink-0" />
                  Nowy folder tutaj
                </button>
              )}
            </li>
          </ul>

          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <Dialog.Close className="rounded-md border px-3 py-1.5 t-btn hover:bg-raised">Anuluj</Dialog.Close>
            <button
              disabled={!wybrany || zajete}
              onClick={async () => { if (!wybrany) return; setZajete(true); await przenies(wybrany); setZajete(false) }}
              className="rounded-md bg-akcent px-3 py-1.5 t-btn text-akcent-ink hover:bg-akcent-hover disabled:opacity-40"
            >Przenieś</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
