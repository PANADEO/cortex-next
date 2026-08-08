"use client"

import type { TileHrefOverrides } from "@/lib/tiles"
import { EmptyState, LoadingState } from "@cortex/ui"
import { Search } from "lucide-react"
import { DotGrid } from "./dot-grid"
import { DEFAULT_HUB_LAYOUT, HUB_LAYOUTS } from "./hub/registry"
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
 * Bez klas zakresujących `.cortex-home`/`.ch-scope`, które przyszły tu z E0.
 * U Cezarego `.cortex-home` jest PRZODKIEM ZAKRESUJĄCYM całego designu Domino
 * — 60 wystąpień w selektorach `19e1dd2:libs/@cortex/styles/globals.css`,
 * łącznie z blokiem `prefers-reduced-motion` — a `.ch-scope` nie występuje
 * tam nigdy samodzielnie, wyłącznie jako `.cortex-home .ch-scope`.
 *
 * Zdjęcie ich jest tu bezczynne Z KONSTRUKCJI, nie dlatego, że coś je
 * zastępuje: cherry-pick E0 (`7e841e6`) wziął SZEŚĆ plików `.tsx` i ani jednej
 * linii CSS, więc `globals.css` na tej gałęzi jest bajt w bajt równy
 * `b7ba35e` i ma ZERO wystąpień `cortex-home`, `ch-scope` i `--ch-`. Te dwa
 * selektory nie mają na czym zadziałać.
 *
 * Powód, dla którego nie zostają mimo to: siedzą NAD layoutem, więc pod
 * `classic` dokładałyby klasy do markupu, który ich nie używa, a warunkowanie
 * ich layoutem znaczyłoby host znający identyfikatory layoutów — dokładnie tę
 * wiedzę, którą rejestr ma z niego zdejmować (D3).
 */
export function AuthedHome({ tileHrefOverrides }: AuthedHomeProps) {
  const model = useHubModel(tileHrefOverrides)
  // E3 podmieni tę stałą na `hubLayout` z aktywnego presetu; kształt odczytu
  // (klucz -> komponent z rejestru) jest już docelowy.
  const Hub = HUB_LAYOUTS[DEFAULT_HUB_LAYOUT]

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
            <Hub model={model} />
          )}
        </div>
      </main>
      <ShellFooter />
    </div>
  )
}
