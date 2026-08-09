"use client"

import { usePreset } from "@/lib/presets/preset-store"
import type { TileHrefOverrides } from "@/lib/tiles"
import { EmptyState, LoadingState } from "@cortex/ui"
import { Search } from "lucide-react"
import { DotGrid } from "./dot-grid"
import { HUB_LAYOUTS } from "./hub/registry"
import { useHubModel } from "./hub/use-hub-model"
import { ShellFooter } from "./shell-footer"
import { ShellHeader } from "./shell-header"

interface AuthedHomeProps {
  tileHrefOverrides?: TileHrefOverrides | undefined
}

/**
 * Jedyne miejsce, w którym wybór layoutu spotyka model huba — i jedyne, które
 * zna stany ładowania i błędu. Trzymanie ich NAD layoutem, a nie w każdym
 * layoucie z osobna, jest celowe: layout dostaje `model` dopiero wtedy, gdy
 * dane są, więc nowy layout nie ma jak zapomnieć o obu ekranach ani pokazać
 * "Nie znaleziono aplikacji" w trakcie ładowania katalogu.
 *
 * Bez klas zakresujących `.cortex-home`/`.ch-scope`, które przyszły tu z E0 —
 * i po E4 wiadomo już, że nie wrócą w żadnej postaci. U Cezarego `.cortex-home`
 * był PRZODKIEM ZAKRESUJĄCYM całego designu Domino (60 wystąpień w selektorach
 * `19e1dd2:libs/@cortex/styles/globals.css`); tutaj żadna reguła Domina nie
 * potrzebuje przodka, bo nie ma reguł Domina — jest tabela wariantów w
 * komponentach, które renderują się wyłącznie pod tym presetem.
 *
 * TO JEST ROZSTRZYGNIĘCIE FOUC, które §5e kazało podjąć w E4, a nie po nim.
 * Klasa skinu i `data-preset` lądują na `<html>` dopiero w efekcie
 * `theme-provider.tsx` (zmierzone: pierwsze malowanie ~22 ms, klasa ~408 ms),
 * więc każda reguła UKŁADU zakresowana `[data-preset="domino"]` znaczyłaby
 * hub malujący się przez ~0,4 s zupełnie nieostylowany, a potem przeskakujący.
 * Zakresowania nie ma i to nie jest obejście, tylko usunięcie zbędnego
 * warunku: o tym, że renderuje się `masthead` z chicletami, rozstrzyga JUŻ
 * preset — w Reakcie, wyżej w tym pliku. Powtórzenie tego samego warunku w
 * CSS-ie nie dokłada żadnej informacji, a kosztuje pełne mignięcie układu.
 * Zostaje mignięcie samych KOLORÓW (tokeny), i to jest cena przyjęta świadomie.
 *
 * Odrzucony blokujący skrypt w nagłówku: patrz `theme-provider.tsx`.
 */
export function AuthedHome({ tileHrefOverrides }: AuthedHomeProps) {
  const model = useHubModel(tileHrefOverrides)
  const preset = usePreset()
  // Jedyne miejsce, w którym preset spotyka layout. Bez `if` po
  // identyfikatorze presetu: host nie zna ani nazw layoutów, ani nazw
  // presetów — dostaje klucz i sięga po komponent (D3, warstwa 3).
  //
  // Rozjazd hydratacji jest tu wykluczony konstrukcją, nie szczęściem:
  // `persist` zustanda czyta `localStorage` synchronicznie, więc serwer i
  // klient mogą się różnić presetem — ale ta gałąź renderuje się wyłącznie
  // przy `state === "ready"`, a katalog przychodzi z zapytania, którego na
  // serwerze nie ma. Pierwszy render po obu stronach to `LoadingState`.
  const Hub = HUB_LAYOUTS[preset.hubLayout]

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <DotGrid animate={false} />
      <ShellHeader />
      <main className="relative flex-1">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-9">
          {model.state === "loading" ? (
            <LoadingState label="Wczytywanie aplikacji…" />
          ) : model.state === "error" ? (
            <EmptyState
              icon={Search}
              title="Nie udało się wczytać aplikacji"
              description="Spróbuj odświeżyć stronę. Jeśli problem się powtarza, sprawdź połączenie z bazą danych."
            />
          ) : (
            <Hub model={model} variants={preset.variants} />
          )}
        </div>
      </main>
      <ShellFooter />
    </div>
  )
}
