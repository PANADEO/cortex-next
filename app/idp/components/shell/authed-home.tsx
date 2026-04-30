"use client"

import { ShellFooter } from "./shell-footer"
import { ShellHeader } from "./shell-header"
import { TileGrid } from "./tile-grid"

export function AuthedHome() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground [background-image:radial-gradient(hsl(var(--foreground)/0.06)_1px,transparent_1px)] [background-size:18px_18px]">
      <ShellHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-9">
          <TileGrid />
        </div>
      </main>
      <ShellFooter />
    </div>
  )
}
