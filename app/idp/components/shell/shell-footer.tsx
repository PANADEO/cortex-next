"use client"

import { SHELL_VERSION, stripLeadingV } from "./version-label"

export function ShellFooter() {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 text-[11px] text-muted-foreground">
        <div>FE v{stripLeadingV(SHELL_VERSION)}</div>
        {/* TODO(#58-followup): replace placeholder hrefs with real Pomoc / Polityka URLs once decided. */}
        <div className="flex items-center gap-3">
          <a href="#" className="hover:text-foreground">
            Pomoc
          </a>
          <a href="#" className="hover:text-foreground">
            Polityka prywatności
          </a>
        </div>
      </div>
    </footer>
  )
}
