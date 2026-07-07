"use client"

import { AppGate } from "@/components/shell/app-gate"
import type { ReactNode } from "react"

export default function IdpFullscreenLayout({ children }: { children: ReactNode }) {
  return <AppGate tileId="idp">{children}</AppGate>
}
