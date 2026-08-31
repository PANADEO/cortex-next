'use client'
import { X, LoaderCircle } from 'lucide-react'
import { Ikona } from './ikona'
import { ikonaPliku } from './wiersz-pliku'

export type Zalacznik = {
  nazwa: string
  podglad?: string | undefined
  wgrywa?: boolean | undefined
}

function rodzaj(nazwa: string) {
  const ext = nazwa.split('.').pop()?.toUpperCase() ?? ''
  return ext.length <= 4 ? ext : 'PLIK'
}

const jestObrazem = (n: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(n)

/**
 * Kafelek załącznika — obraz pokazuje miniaturę, reszta ikonę i rodzaj.
 * Nazwa pliku sama w sobie nic nie mówi; człowiek rozpoznaje swój plik po tym, jak wygląda.
 */
export function ChipZalacznika({ z, usun, otworz }: {
  z: Zalacznik
  usun?: (() => void) | undefined
  otworz?: (() => void) | undefined
}) {
  const obraz = jestObrazem(z.nazwa) && z.podglad
  const Tresc = (
    <>
      {obraz ? (
        <img src={z.podglad} alt="" className="h-11 w-11 shrink-0 rounded-sm object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-raised text-muted">
          <Ikona jako={ikonaPliku({ nazwa: z.nazwa, katalog: false })} px={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 break-all text-left text-[12px] leading-4">{z.nazwa}</span>
        <span className="w-fit rounded-xs bg-raised px-1 text-[10px] uppercase leading-4 text-muted">{rodzaj(z.nazwa)}</span>
      </span>
    </>
  )

  return (
    <span className="group/chip relative inline-flex max-w-[210px] items-center gap-2 rounded-md border bg-surface p-1.5">
      {otworz ? (
        <button onClick={otworz} className="flex min-w-0 items-center gap-2 text-left">{Tresc}</button>
      ) : (
        <span className="flex min-w-0 items-center gap-2">{Tresc}</span>
      )}

      {z.wgrywa && (
        <span className="absolute inset-0 grid place-items-center rounded-md bg-surface/75">
          <Ikona jako={LoaderCircle} px={16} klasa="obrot text-muted" />
        </span>
      )}

      {usun && !z.wgrywa && (
        <button
          onClick={usun} aria-label={`Usuń załącznik ${z.nazwa}`}
          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-pill border bg-surface text-muted opacity-0 shadow-pop transition hover:text-ink focus-visible:opacity-100 group-hover/chip:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Ikona jako={X} px={12} />
        </button>
      )}
    </span>
  )
}

export function ListaZalacznikow({ pliki, usun, otworz, klasa }: {
  pliki: Zalacznik[]
  usun?: ((n: string) => void) | undefined
  otworz?: ((n: string) => void) | undefined
  klasa?: string | undefined
}) {
  if (!pliki.length) return null
  return (
    <div className={`flex flex-wrap gap-2 ${klasa ?? ''}`}>
      {pliki.map((z) => (
        <ChipZalacznika
          key={z.nazwa} z={z}
          usun={usun ? () => usun(z.nazwa) : undefined}
          otworz={otworz ? () => otworz(z.nazwa) : undefined}
        />
      ))}
    </div>
  )
}
