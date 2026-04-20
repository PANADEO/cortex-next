"use client"

import { useEffect, useState, type ReactNode } from "react"

const ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled"

export function MswProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!ENABLED)

  useEffect(() => {
    if (!ENABLED) return
    import("./browser")
      .then(({ worker }) => worker.start({ onUnhandledRequest: "bypass" }))
      .catch((err) => {
        console.error("[msw] failed to start worker, rendering without mocks", err)
      })
      .finally(() => setReady(true))
  }, [])

  return ready ? <>{children}</> : null
}
