"use client"

import { DotGrid } from "./dot-grid"
import { ShellFooter } from "./shell-footer"
import { ShellHeader } from "./shell-header"
import { TileGrid } from "./tile-grid"

export function AuthedHome() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <DotGrid animate={false} />
      <ShellHeader />
      <main className="relative flex-1">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-9">
          <TileGrid />
        </div>
      </main>
      <ShellFooter />
    </div>
  )
}
