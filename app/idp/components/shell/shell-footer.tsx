"use client"

export function ShellFooter() {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 text-[11px] text-muted-foreground">
        <div>Cortex360 v1.0 · Forsped Sp. z o.o.</div>
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
