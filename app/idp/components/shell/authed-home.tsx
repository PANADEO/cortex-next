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
 */
export function AuthedHome({ tileHrefOverrides }: AuthedHomeProps) {
  const model = useHubModel(tileHrefOverrides)
  // E3 podmieni tę stałą na `hubLayout` z aktywnego presetu; kształt odczytu
  // (klucz -> komponent z rejestru) jest już docelowy.
  const Hub = HUB_LAYOUTS[DEFAULT_HUB_LAYOUT]

  return (
    <div className="cortex-home relative flex min-h-screen flex-col bg-background text-foreground">
      <DotGrid animate={false} />
      <ShellHeader />
      <main className="relative flex-1">
        <div className="ch-scope mx-auto max-w-7xl px-6 pb-20 pt-9">
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
