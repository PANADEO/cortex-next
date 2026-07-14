"use client"

import {
  ChatPanel,
  coworkApi,
  DEFAULT_COWORK_PROJECT_ID,
  SessionPanels,
  useCoworkArtifacts,
  useCoworkProjectTiles,
  useCoworkSession,
  useEnsureCoworkSession,
  useSendCoworkMessage,
  useUploadInputFiles,
} from "@/features/cortex-cowork"
import { ErrorState } from "@cortex/ui"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function CortexCoworkChat() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project") ?? DEFAULT_COWORK_PROJECT_ID
  const { projects } = useCoworkProjectTiles()
  const project = projects.find((p) => p.id === projectId)

  const { sessionId, error, retry } = useEnsureCoworkSession(projectId)
  const sessionQuery = useCoworkSession(sessionId)
  const artifactsQuery = useCoworkArtifacts(sessionId)
  const sendMessage = useSendCoworkMessage(sessionId ?? "")
  const uploadFiles = useUploadInputFiles(sessionId)

  const messages = sessionQuery.data?.messages ?? []
  const artifacts = artifactsQuery.data ?? sessionQuery.data?.artifacts ?? []
  const inputFiles = sessionQuery.data?.inputFiles ?? []

  if (error) {
    return (
      <div className="p-8">
        <ErrorState
          title="Nie udało się wystartować sesji sandboxa"
          message={error.message}
          onRetry={retry}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <span className="text-sm font-medium">{project?.name ?? "Cortex Cowork"}</span>
        {project?.description ? (
          <span className="truncate text-xs text-muted-foreground">{project.description}</span>
        ) : null}
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <SessionPanels
          sessionId={sessionId}
          skills={sessionQuery.data?.skills ?? []}
          artifacts={artifacts}
          inputFiles={inputFiles}
          downloadHref={(artifactId) =>
            sessionId ? coworkApi.artifactDownloadHref(sessionId, artifactId) : "#"
          }
          onExport={
            project?.exportEnabled && sessionId
              ? (artifactId: string) => coworkApi.exportArtifact(sessionId, artifactId)
              : undefined
          }
        />
        <ChatPanel
          messages={messages}
          isSending={sendMessage.isPending}
          isLoadingSession={!sessionId || sessionQuery.isLoading}
          onSend={(content) => sendMessage.mutate(content)}
          usage={sessionQuery.data?.usage}
          projectName={project?.name}
          onUploadFiles={sessionId ? (files) => uploadFiles.mutate(files) : undefined}
          isUploading={uploadFiles.isPending}
          inputFiles={inputFiles}
        />
      </div>
    </div>
  )
}

export default function CortexCoworkChatPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <CortexCoworkChat />
    </Suspense>
  )
}
