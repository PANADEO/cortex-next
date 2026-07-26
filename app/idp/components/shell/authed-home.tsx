"use client"

import { DotGrid } from "./dot-grid"
import type { TileHrefOverrides } from "@/lib/tiles"
import { ShellFooter } from "./shell-footer"
import { ShellHeader } from "./shell-header"
import { TileGrid } from "./tile-grid"

interface AuthedHomeProps {
  tileHrefOverrides?: TileHrefOverrides | undefined
}

export function AuthedHome({ tileHrefOverrides }: AuthedHomeProps) {
  return (
    <div className="cortex-home relative flex min-h-screen flex-col bg-background text-foreground">
      <DotGrid animate={false} />
      <ShellHeader />
      <main className="relative flex-1">
        <div className="ch-scope mx-auto max-w-7xl px-6 pb-20 pt-9">
          <TileGrid tileHrefOverrides={tileHrefOverrides} />
        </div>
      </main>
      <ShellFooter />
    </div>
  )
}
