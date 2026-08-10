"use client"

import { cn } from "@cortex/utils"
import { cva } from "class-variance-authority"
import type { ReactNode } from "react"

/**
 * Kształt powłoki. Unia literałowa, nie `string` — ta sama konstrukcja co
 * `variant` w `hub/tile-card.tsx`. Pakiet celowo NIE importuje typu z
 * `lib/presets/registry.ts`: kierunek zależności jest odwrotny, aplikacja
 * zależy od pakietu prymitywów, nie na odwrót.
 *
 * PARZYSTOŚCI Z `ShellVariant` PILNUJE `pnpm typecheck`, NIE TEST. Sprawdzone
 * mutacją w obie strony: poszerzenie unii po którejkolwiek stronie daje błędy
 * `tsc` (tu — w tabelach CVA w tym pakiecie; po stronie aplikacji — w
 * `layout.tsx`, `topbar.tsx`, `version-label.tsx`), a `vitest` przechodzi na
 * zielono. Wcześniejsza wersja tego komentarza wskazywała test i była
 * nieprawdziwa.
 */
export type AppShellVariant = "plain" | "ruled"

interface AppShellProps {
  sidebar?: ReactNode
  topbar?: ReactNode
  children: ReactNode
  className?: string
  mainClassName?: string
  sidebarCollapsed?: boolean
  /** Domyślnie `plain` — czyli wygląd sprzed wprowadzenia wariantów. Domyślna
   *  wartość jest tu zabezpieczeniem, nie wygodą: konsument, który nie wie o
   *  presetach, ma dostać dokładnie to, co dostawał wcześniej. */
  variant?: AppShellVariant
}

/**
 * PODZIAŁ WARSTW, PRECYZYJNIE: warstwa 1 jest właścicielem WARTOŚCI, warstwa 2
 * wybiera ROLĘ SEMANTYCZNĄ i kształt.
 *
 * W tym pliku wariant zmienia wyłącznie grubość linii — `bg-sidebar`,
 * `border-sidebar-border` i `border-border` siedzą w bazie i nie zależą od
 * niego, bo skin przemalowuje je sam (`.skin-domino` ustawia `--border` na
 * atrament).
 *
 * Ale sformułowanie „wariant zmienia WYŁĄCZNIE grubość" byłoby regułą
 * fałszywą dla reszty powłoki i tak było tu napisane: `tile-menu.tsx`,
 * `topbar.tsx` i `version-label.tsx` podmieniają pod `ruled` także TOKEN
 * (`bg-muted/40` → `bg-sidebar-accent`, `text-muted-foreground` →
 * `text-sidebar-foreground`). To jest legalne i jest sednem podziału: wariant
 * mówi, KTÓRĄ rolę element gra, a skin — jak ta rola wygląda. Nielegalne
 * byłoby dopiero wpisanie w tabelę wariantu wartości koloru zamiast tokena.
 */
const shell = {
  /**
   * BEZ ANIMACJI SZEROKOŚCI — usunięte `transition-[width] duration-200`.
   *
   * `width` jest własnością UKŁADU: animowanie jej każe przeglądarce przeliczyć
   * pozycje nie tylko paska, ale i całej treści obok, i to w każdej klatce.
   * Zwijanie paska jest przy tym akcją binarną i rzadką, więc płacimy tę cenę
   * za 200 ms efektu, którego nikt nie ogląda dwa razy. Decyzja oryginału
   * (`ef85991`), przyjęta świadomie: „Collapse is a binary, infrequent state
   * change — it swaps instantly instead."
   *
   * Nie ma tu już czego osłaniać `motion-reduce:`, bo nie ma przejścia —
   * a użytkownik z włączonym „ogranicz ruch" i tak dostawał natychmiastowe
   * przełączenie, więc dla niego nic się nie zmienia. Pozostałe animacje
   * powłoki (link menu, pole szukania, sloty marki) osłonę mają i zachowują ją.
   */
  aside: cva(
    "hidden shrink-0 border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col",
    {
      variants: {
        variant: { plain: "border-r", ruled: "border-r-2" },
      },
      defaultVariants: { variant: "plain" },
    },
  ),
  header: cva("flex h-header shrink-0 items-center gap-3 border-border bg-background px-4", {
    variants: {
      variant: { plain: "border-b", ruled: "border-b-2" },
    },
    defaultVariants: { variant: "plain" },
  }),
}

/**
 * Kolory powłoki idą TOKENAMI (`bg-sidebar`, `border-sidebar-border`,
 * `border-border`) i tak zostaje — skin przemalowuje je, nadpisując wartości w
 * bloku `.skin-*`, bez dotykania tego pliku.
 *
 * Wariant z gałęzi Domino (`ef85991`) wymieniał te klasy na `ch-*`, czytające
 * `--ch-*` i działające wyłącznie pod scope'em `.cortex-chrome`. Odrzucone i
 * wycofane: `@cortex/ui` jest pakietem współdzielonym, więc komponent
 * wyrenderowany poza tym scope'em tracił tło i ramki — koszt płacił każdy
 * przyszły konsument, nie tylko autor skinu. Co gorsza, ręczna klasa kodowała
 * JEDEN wygląd, więc drugi preset nie miał jak istnieć obok niej.
 *
 * KOREKTA WCZEŚNIEJSZEGO ZAPISU. Ten nagłówek twierdził dotąd, że powłoka
 * zostaje w całości na warstwie 1, a dowodem miało być to, że `ef85991` nie
 * zmienił DOM-u ani o jeden element. Wniosek był za szeroki: tamten commit
 * zmieniał także grubość krawędzi, krój i wersaliki etykiet oraz twardy cień
 * przy hoverze — decyzje o KSZTAŁCIE, których żadna wartość tokena nie
 * wyrazi. Kolory rzeczywiście zostały na warstwie 1; kształt dostał wariant.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
  className,
  mainClassName,
  sidebarCollapsed = false,
  variant = "plain",
}: AppShellProps) {
  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", className)}>
      {sidebar ? (
        <aside
          className={cn(
            shell.aside({ variant }),
            sidebarCollapsed ? "w-sidebar-icon" : "w-sidebar",
          )}
          data-collapsed={sidebarCollapsed || undefined}
        >
          {sidebar}
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar ? <header className={shell.header({ variant })}>{topbar}</header> : null}
        <main className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  )
}
