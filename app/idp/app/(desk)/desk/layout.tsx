"use client"

import { AppGate } from "@/components/shell/app-gate"
import { DESK_APP_CODE } from "@/lib/tiles"
import type { ReactNode } from "react"

// Arkusz Biurka wchodzi TUTAJ, nie w layoucie korzenia: jest wspólny z aplikacją
// `apps/desk`, a poza tym kafelkiem nie ma go po co ładować. Kolejność wynika
// z drzewa — CSS layoutu korzenia idzie pierwszy, więc ręczne reguły Biurka
// trafiają za `@tailwind utilities` i wygrywają z narzędziami o tej samej
// swoistości, dokładnie tak jak w aplikacji samodzielnej.
import "@cortex/styles/desk.css"

/**
 * Kafelek `desk` przychodzi z WŁASNĄ powłoką (list spraw po lewej, pasek dolny
 * na telefonie), więc stoi w osobnej grupie tras — tak samo jak Cortex Cowork.
 * Pod generycznym `AppShell` miałby dwa sidebary obok siebie.
 *
 * Bramka dostaje kod kafelka JAWNIE. Bez niego `AppGate` przepuszcza każdego,
 * kto ma jakikolwiek grant — a Biurko wydaje agentowi zdolności, w tym takie,
 * które sięgają poza firmę.
 */
export default function UkladBiurka({ children }: { children: ReactNode }) {
  return <AppGate tileId={DESK_APP_CODE}>{children}</AppGate>
}
