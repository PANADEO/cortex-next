"use client"

import { SHELL_VERSION, stripLeadingV } from "./version-label"

export function ShellFooter() {
  return (
    <footer className="ch-shellfoot">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div>FE v{stripLeadingV(SHELL_VERSION)}</div>
        {/* TODO(#58-followup): replace placeholder hrefs with real Pomoc / Polityka URLs once decided. */}
        <div className="flex items-center gap-3">
          <a href="#">Pomoc</a>
          <a href="#">Polityka prywatności</a>
        </div>
      </div>
    </footer>
  )
}
