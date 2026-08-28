import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { Ikona } from './ikona'
import { kiedy, ile } from '@/lib'

export type WierszSprawy = {
  id: string; tytul: string; stan: string; powod: string | null
  zmieniona: string; dokumenty: number
}

const ETYKIETA: Record<string, string> = {
  nowa: 'nowa', pracuje: 'pracuje', gotowe: 'gotowe', przerwane: 'przerwane', blad: 'nie udało się',
}
const KROPKA: Record<string, string> = {
  nowa: 'bg-muted-cichy', pracuje: 'bg-accent puls', gotowe: 'bg-ok', przerwane: 'bg-warn', blad: 'bg-bad',
}

export function ListaSpraw({ sprawy }: { sprawy: WierszSprawy[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
      {sprawy.map((r) => (
        <li key={r.id}>
          <Link href={`/sprawa/${r.id}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-raised/50">
            <span className={`h-2 w-2 shrink-0 rounded-pill ${KROPKA[r.stan] ?? 'bg-muted-cichy'}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate t-tresc-m">{r.tytul}</span>
              <span className="mt-0.5 flex items-center gap-1.5 t-meta">
                <span>{ETYKIETA[r.stan] ?? r.stan}</span>
                <span aria-hidden>·</span>
                <span>{kiedy(r.zmieniona)}</span>
                {r.dokumenty > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <Ikona jako={FileText} px={12} />
                      {ile(r.dokumenty, 'dokument', 'dokumenty', 'dokumentów')}
                    </span>
                  </>
                )}
                {r.powod && <span className="truncate">· {r.powod}</span>}
              </span>
            </span>
            <Ikona jako={ChevronRight} px={16} klasa="shrink-0 text-muted-cichy" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
