import Link from "next/link"
import { t } from "../routes"

export type SectionTab = {
  key: string
  label: string
  /** liczba do plakietki; 0 znaczy „nie pokazuj", bo zero nie wymaga uwagi */
  count?: number
  /** tekst zamiast liczby — dla kwoty, która nie jest „ile rzeczy czeka" */
  note?: string
  tone?: "accent" | "warn"
}

/**
 * Podział ekranu na sekcje ZAKŁADKAMI, a nie zwijanymi blokami.
 *
 * Trzy powody, w tej kolejności. Po pierwsze, stan siedzi w adresie (`?section=`),
 * więc da się go zakładkować, wysłać komuś linkiem i cofnąć przyciskiem wstecz —
 * czego zwijany blok nie umie. Po drugie, zakładki są zwykłymi `<a>`, więc działają
 * przed hydracją, na kliknięcie środkowym przyciskiem i z klawiatury. Po trzecie,
 * serwer pobiera dane WYŁĄCZNIE dla otwartej sekcji, a nie dla czterech naraz.
 *
 * Plakietka pokazuje się tylko przy liczbie większej od zera: „0 czeka" to nie
 * informacja, tylko szum dokładnie w miejscu, w którym szukamy tego, co pilne.
 */
export function SectionTabs({
  base,
  active,
  tabs,
  label,
}: {
  /** ścieżka strony BEZ prefiksu, np. `/supervision` */
  base: string
  active: string
  tabs: SectionTab[]
  label: string
}) {
  return (
    /**
     * ZAWIJAMY, NIE PRZEWIJAMY — i to jest poprawka, nie preferencja.
     *
     * Do 03.09.2026 stało tu `overflow-x-auto`. Przy sześciu zakładkach mieściły się
     * w szerokości strumienia; siódma („Procedury") przesunęła treść do 719 px przy
     * 680 px widocznych, więc OSTATNIA zakładka wypadała poza kadr — i to na KAŻDEJ
     * szerokości okna, także na 1600 px, bo strona jest zaklejona na szerokości czytania.
     *
     * Przewijanie w poziomie bez żadnego znaku, że jest co przewijać, to dla tej persony
     * sekcja, której nie ma. Zawinięcie kosztuje jeden dodatkowy wiersz i pokazuje
     * wszystko naraz — a `border-b` zostaje pod całością, bo kreska oddziela listwę
     * od treści, nie zakładki od siebie.
     */
    <nav aria-label={label} className="mt-6 flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const current = tab.key === active
        // Pierwsza zakładka jest domyślna, więc jej adres nie niesie parametru —
        // inaczej `/supervision` i `/supervision?section=decisions` byłyby dwoma
        // adresami tej samej rzeczy.
        const href = tab.key === tabs[0]?.key ? t(base) : `${t(base)}?section=${tab.key}`
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`t-body relative flex h-9 shrink-0 items-center gap-1.5 rounded-t-md px-3 ${
              current ? "font-medium text-desk-ink" : "text-desk-muted hover:bg-desk-raised/60"
            }`}
          >
            {tab.label}
            {tab.count ? (
              <span
                className={`t-micro grid h-4 min-w-4 place-items-center rounded-desk-pill px-1 tabular-nums ${
                  tab.tone === "warn"
                    ? "bg-desk-warn-soft text-desk-ink"
                    : "bg-desk-accent text-desk-accent-ink"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
            {tab.note ? <span className="t-micro tabular-nums">{tab.note}</span> : null}
            {current && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-desk-pill bg-desk-accent"
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
