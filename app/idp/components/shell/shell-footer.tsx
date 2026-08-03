"use client"

import { Globe } from "lucide-react"
import { useEffect, useState } from "react"
import pkg from "../../../../package.json"
import { SHELL_VERSION, stripLeadingV } from "./version-label"

const APP_VERSION = stripLeadingV(SHELL_VERSION === "dev" ? pkg.version : SHELL_VERSION)

interface Diagnostics {
  time: string
  resolution: string
  online: boolean
}

/** Browser-only diagnostics; null until mounted so SSR markup stays stable. */
function useDiagnostics(): Diagnostics | null {
  const [diag, setDiag] = useState<Diagnostics | null>(null)

  useEffect(() => {
    function read(): Diagnostics {
      return {
        time: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
        resolution: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
      }
    }
    const update = () => setDiag(read())
    update()
    const clock = setInterval(update, 15_000)
    window.addEventListener("resize", update)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      clearInterval(clock)
      window.removeEventListener("resize", update)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  return diag
}

export function ShellFooter() {
  const diag = useDiagnostics()
  return (
    <footer className="ch-shellfoot">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-3">
        <div>Cortex360 © {new Date().getFullYear()}</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>Wersja: {APP_VERSION}</span>
          <span>Czas: {diag?.time ?? "—"}</span>
          <span>Rozdzielczość: {diag?.resolution ?? "—"}</span>
          <span className="flex items-center gap-1.5">
            <Globe size={13} aria-hidden="true" />
            Polski
          </span>
          <span>Online: {diag ? (diag.online ? "Tak" : "Nie") : "—"}</span>
        </div>
      </div>
    </footer>
  )
}
