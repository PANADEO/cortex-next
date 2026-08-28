'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Z = { tytul: string; podpowiedz: string; tresc: string }

export function Zlecenia({ zlecenia }: { zlecenia: Z[] }) {
  const router = useRouter()
  const [tresc, setTresc] = useState('')
  const [zajete, setZajete] = useState(false)

  async function start(t: string) {
    if (!t.trim() || zajete) return
    setZajete(true)
    const r = await fetch('/api/sprawa/nowa', { method: 'POST', body: JSON.stringify({ tytul: t.slice(0, 60) }) })
    const { id } = await r.json()
    await fetch(`/api/sprawa/${id}/tura`, { method: 'POST', body: JSON.stringify({ tresc: t }) })
    router.push(`/sprawa/${id}`)
  }

  return (
    <div className="mt-7">
      <p className="mb-3 text-sm text-muted">Zacznij od jednej z rzeczy, które umiem w Twoim dziale:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {zlecenia.map((z) => (
          <button key={z.tytul} onClick={() => setTresc(z.tresc)}
            className="rounded-xl border bg-surface p-4 text-left transition hover:border-accent hover:shadow-sm">
            <div className="font-medium">{z.tytul}</div>
            <div className="mt-1 text-xs text-muted">{z.podpowiedz}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl border bg-surface p-3">
        <textarea
          value={tresc} onChange={(e) => setTresc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start(tresc) }}
          placeholder="…albo po prostu napisz, czego potrzebujesz."
          rows={3}
          className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted">Kliknięcie kafelka wstawia treść — wysyłasz Ty.</span>
          <button onClick={() => start(tresc)} disabled={!tresc.trim() || zajete}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40">
            {zajete ? 'Zaczynam…' : 'Zleć'}
          </button>
        </div>
      </div>
    </div>
  )
}
