"use client"

import { cn } from "@cortex/utils"
import { Search } from "lucide-react"
import type { HeroView } from "../../types"

interface MastheadProps {
  value: string
  onChange: (value: string) => void
  view: HeroView
  onViewChange: (view: HeroView) => void
  /** Cały katalog z grantem, PRZED szukajką — `HubCounts.authorized`. */
  tileCount: number
  categoryCount: number
}

/**
 * Nagłówek huba Domino: tytuł i szukajka w jednym rzędzie zamiast wycentrowanych
 * pod sobą, pod nimi podwójna kreska i pasek „Narzędzia: N · Kategorie: M" z
 * przełącznikiem przekroju. To jedyny element tego layoutu, który NIE jest
 * wariantem `HeroSearch` z `classic`: układ jest inny, nie kolory.
 *
 * Wszystkie klasy poniżej to narzędzia Tailwinda nad tokenami — ani jednej
 * reguły w arkuszu. Kolor bierze się z `.skin-domino`, więc ten sam markup pod
 * innym presetem po prostu wygląda inaczej, zamiast wyglądać na zepsuty.
 */
export function Masthead({
  value,
  onChange,
  view,
  onViewChange,
  tileCount,
  categoryCount,
}: MastheadProps) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold leading-[1.1] tracking-[-0.01em]">Enterprise AI Hub</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Wybierz aplikację, której chcesz użyć
          </p>
        </div>

        {/* Fokus jako offsetowy cień w kolorze `--ring`, nie obwódka: to ta sama
            afordancja, którą kafelek pokazuje jako `outline`, tylko na polu
            wejściowym wygląda jak przesunięta klisza. Wartość jest arbitralna,
            ale kolor pozostaje tokenem. */}
        <div className="flex min-w-[300px] items-center gap-2.5 rounded-sm border-token border-border bg-card px-3 py-[9px] transition-shadow focus-within:shadow-[3px_3px_0_hsl(var(--ring))] motion-reduce:transition-none">
          {/* Kolor z `--primary`, nie z `--chart-2`, mimo że oba są tealem:
              cienki typ akcentowy rozjaśnia się w ciemnym, wypełnienia
              akcentów nie — patrz `globals.css`. (Nazwy narzędzia nie da się
              tu wpisać nawet w komentarzu: skaner Tailwinda tokenizuje ten
              plik razem z komentarzami i wyemitowałby regułę-widmo.) */}
          <Search className="h-[15px] w-[15px] shrink-0 text-primary" aria-hidden="true" />
          <input
            type="text"
            placeholder="Szukaj aplikacji…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            aria-label="Szukaj aplikacji"
          />
          <span className="border-token border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            ⌘K
          </span>
        </div>
      </div>

      {/* Podwójna kreska drukarska: 2 px nad 1 px w polu wysokości 3 px. Dolna
          celowo NIE bierze `--border-width` — nierówność wag jest tu motywem,
          a token zrównałby obie linie i zniósł efekt. */}
      <div className="mt-3.5 h-[3px] border-b-[1px] border-t-2 border-border" aria-hidden="true" />

      {/* Pasek mikroetykiet — pierwszy konsument `--label-transform` i
          `--label-tracking` z E2. Wersaliki i tracking dziedziczą przyciski
          przekroju, bo preflight Tailwinda każe `button` dziedziczyć krój. */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] tracking-label text-muted-foreground [text-transform:var(--label-transform)]">
        <span>
          Narzędzia: {tileCount} · Kategorie: {categoryCount}
        </span>
        <span className="inline-flex" role="group" aria-label="Sposób grupowania">
          <ViewButton isActive={view === "functional"} onClick={() => onViewChange("functional")}>
            Funkcjonalnie
          </ViewButton>
          <ViewButton isActive={view === "department"} onClick={() => onViewChange("department")}>
            Wg działu
          </ViewButton>
        </span>
      </div>
    </header>
  )
}

interface ViewButtonProps {
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
}

/** Dwa przyciski sklejone we wspólną ramkę: ujemny margines zlepia sąsiadujące
 *  krawędzie w jedną, a `z-[1]` na aktywnym podnosi ją nad krawędź sąsiada. */
function ViewButton({ isActive, onClick, children }: ViewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "-ml-0.5 border-token border-border px-2.5 py-1 transition-[color,background-color,transform] first:ml-0 motion-reduce:transition-none",
        isActive
          ? "relative z-[1] bg-chart-2 text-chart-2-foreground"
          : "bg-card text-muted-foreground hover:-translate-y-px hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
