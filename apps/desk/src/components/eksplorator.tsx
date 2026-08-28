'use client'
import { useEffect, useRef, useState } from 'react'
import type { PlikMeta } from '@/core/typy'
import { rozmiar, kiedy } from '@/lib'

export function Eksplorator() {
  const [katalog, setKatalog] = useState('Moje pliki')
  const [pliki, setPliki] = useState<PlikMeta[]>([])
  const [kosz, setKosz] = useState<{ id: string; nazwa: string }[]>([])
  const [zajete, setZajete] = useState(false)
  const [pokazKosz, setPokazKosz] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function odswiez(k = katalog) {
    const r = await fetch(`/api/pliki?katalog=${encodeURIComponent(k)}`, { cache: 'no-store' })
    const d = await r.json(); setPliki(d.pliki ?? []); setKosz(d.kosz ?? [])
  }
  useEffect(() => { odswiez(katalog) }, [katalog])

  async function wgraj(files: FileList | null) {
    if (!files?.length) return
    setZajete(true)
    const fd = new FormData(); fd.append('katalog', katalog)
    Array.from(files).forEach((f) => fd.append('plik', f))
    await fetch('/api/pliki/wgraj', { method: 'POST', body: fd })
    setZajete(false); odswiez()
  }
  async function akcja(body: Record<string, unknown>) {
    await fetch('/api/pliki', { method: 'POST', body: JSON.stringify(body) }); odswiez()
  }

  const wGore = katalog.includes('/') ? katalog.split('/').slice(0, -1).join('/') : null

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-semibold">Moje pliki</h1>
      <p className="mt-1 text-sm text-muted">Tu trzymasz to, na czym pracujesz. Pliki zostają na biurku — nie znikają razem ze sprawą.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => input.current?.click()} disabled={zajete}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">
          {zajete ? 'Wgrywam…' : '+ Dodaj pliki'}
        </button>
        <input ref={input} type="file" multiple hidden onChange={(e) => wgraj(e.target.files)} />
        <button onClick={() => { const n = prompt('Nazwa nowego folderu'); if (n) akcja({ akcja: 'katalog', sciezka: `${katalog}/${n}` }) }}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-raised">+ Nowy folder</button>
        <button onClick={() => setPokazKosz((k) => !k)} className="rounded-lg border px-4 py-2 text-sm hover:bg-raised">
          Kosz {kosz.length > 0 && <span className="text-muted">({kosz.length})</span>}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-muted">
        <span>📁 {katalog}</span>
        {wGore !== null && <button onClick={() => setKatalog(wGore || 'Moje pliki')} className="underline-offset-2 hover:underline">↑ wyżej</button>}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); wgraj(e.dataTransfer.files) }}
        className="mt-2 overflow-hidden rounded-xl border bg-surface"
      >
        {pliki.length === 0 && (
          <div className="p-10 text-center text-sm text-muted">
            Pusto. Przeciągnij tu pliki albo kliknij „Dodaj pliki".
          </div>
        )}
        <ul className="divide-y">
          {pliki.map((p) => (
            <li key={p.sciezka} className="flex items-center gap-3 px-4 py-2.5">
              <span>{p.katalog ? '📁' : /\.(png|jpe?g)$/i.test(p.nazwa) ? '🖼️' : '📄'}</span>
              {p.katalog ? (
                <button onClick={() => setKatalog(p.sciezka)} className="min-w-0 flex-1 truncate text-left hover:underline">{p.nazwa}</button>
              ) : (
                <a href={`/api/plik?sciezka=${encodeURIComponent(p.sciezka)}`} target="_blank" rel="noreferrer"
                  className="min-w-0 flex-1 truncate hover:underline">{p.nazwa}</a>
              )}
              <span className="hidden shrink-0 text-xs text-muted sm:block">{p.katalog ? '' : rozmiar(p.rozmiar)}</span>
              <span className="hidden shrink-0 text-xs text-muted sm:block">{kiedy(p.zmieniony)}</span>
              <button title="Zmień nazwę" className="shrink-0 rounded-md border px-2 py-0.5 text-xs hover:bg-raised"
                onClick={() => { const n = prompt('Nowa nazwa', p.nazwa); if (n && n !== p.nazwa) akcja({ akcja: 'przenies', z: p.sciezka, do: `${katalog}/${n}` }) }}>Nazwa</button>
              <button title="Przenieś" className="shrink-0 rounded-md border px-2 py-0.5 text-xs hover:bg-raised"
                onClick={() => { const n = prompt('Do którego folderu? (np. "Moje pliki/Wnioski 2026")', katalog); if (n) akcja({ akcja: 'przenies', z: p.sciezka, do: `${n}/${p.nazwa}` }) }}>Przenieś</button>
              <button title="Do kosza" className="shrink-0 rounded-md border px-2 py-0.5 text-xs text-bad hover:bg-raised"
                onClick={() => akcja({ akcja: 'kosz', sciezka: p.sciezka })}>Usuń</button>
            </li>
          ))}
        </ul>
      </div>

      {pokazKosz && (
        <div className="mt-4 rounded-xl border bg-surface p-4">
          <div className="mb-2 text-sm font-medium">Kosz</div>
          {kosz.length === 0 ? <div className="text-sm text-muted">Pusty.</div> : (
            <ul className="space-y-1">
              {kosz.map((k) => (
                <li key={k.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{k.nazwa}</span>
                  <button className="rounded-md border px-2 py-0.5 text-xs hover:bg-raised"
                    onClick={() => akcja({ akcja: 'przywroc', id: k.id })}>Przywróć</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
