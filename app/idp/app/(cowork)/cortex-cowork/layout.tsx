"use client"

import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { AppGate } from "@/components/shell/app-gate"
import { CoworkShell } from "@/features/cortex-cowork"
import { COWORK_APP_CODE } from "@/lib/tiles"
import { Suspense, type ReactNode } from "react"

// The cowork tile ships its own Codex-style shell (session sidebar, dark
// surface) instead of the generic tile menu - hence its own route group.
//
// tileId jest tu JAWNE i wymagane. Wcześniej ten callsite nie podawał go
// wcale, więc do Coworka wchodził każdy z dowolnym grantem — kod
// `cortex-cowork` istniał w rejestrze, ale nikt o niego nie pytał. Ta sama
// stała bramkuje sekcję task-chat na hubie (components/shell/hub/use-hub-model.ts);
// gdyby te dwa miejsca się rozjechały, kafelek byłby widoczny i odmawiałby.
export default function CortexCoworkLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate tileId={COWORK_APP_CODE}>
      {/* CoworkShell reads useSearchParams (active project) - App Router
          requires a Suspense boundary around that. */}
      <Suspense fallback={null}>
        <CoworkShell>
          <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
        </CoworkShell>
      </Suspense>
    </AppGate>
  )
}
