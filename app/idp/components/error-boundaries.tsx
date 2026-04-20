"use client"

import { Button, ErrorState } from "@cortex/ui"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { AlertTriangle, RotateCcw } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "ChunkLoadError" || /Loading chunk \d+ failed/i.test(error.message)
}

function formatMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : "Unexpected error."
}

function RootFallback({ error, resetErrorBoundary }: FallbackProps) {
  const chunk = isChunkLoadError(error)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 py-12 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">
          {chunk ? "A new version shipped" : "Something went wrong"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {chunk
            ? "Refresh to load the latest app bundle."
            : formatMessage(error)}
        </p>
      </div>
      <div className="flex gap-2">
        {chunk ? (
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        ) : (
          <Button onClick={resetErrorBoundary}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Try again
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

export function RootErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary FallbackComponent={RootFallback}>{children}</ErrorBoundary>
}

function FeatureFallback({ error, resetErrorBoundary }: FallbackProps) {
  if (isChunkLoadError(error)) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <ErrorState
          title="A new version shipped"
          message="Refresh to load the latest app bundle."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-4 px-8 py-6">
      <ErrorState
        title="This page hit an error"
        message={formatMessage(error)}
        onRetry={resetErrorBoundary}
      />
    </div>
  )
}

export function FeatureErrorBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          FallbackComponent={FeatureFallback}
          onReset={reset}
          resetKeys={[pathname]}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
