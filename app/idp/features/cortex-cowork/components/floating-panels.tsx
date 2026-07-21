"use client"

import { FileText, FolderOpen } from "lucide-react"
import { useState, type ReactNode } from "react"
import type { CoworkArtifact, CoworkInputFile, CoworkSkillSummary } from "../types"
import { ArtifactRow } from "./artifact-row"
import { DisclosureChevron } from "./disclosure"

// Codex-style floating cards pinned to the top-right of the chat surface
// (like Codex's Environment/Sources): collapsed headers that expand in place
// over the transcript instead of reserving a fixed side column.

function FloatingPanel({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="pointer-events-auto overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
        aria-expanded={open}
      >
        <span className="font-medium">{title}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {meta}
          <DisclosureChevron open={open} className="h-3.5 w-3.5" />
        </span>
      </button>
      {open ? <div className="max-h-[45vh] overflow-y-auto border-t border-border/60">{children}</div> : null}
    </section>
  )
}

interface SessionPanelsProps {
  sessionId: string | null
  skills: CoworkSkillSummary[]
  artifacts: CoworkArtifact[]
  inputFiles?: CoworkInputFile[]
  downloadHref: (artifactId: string) => string
  onExport?: ((artifactId: string) => Promise<{ displayPath: string }>) | undefined
}

/** Floating "Artefakty" + "Zasoby sesji" cards over the chat surface. */
export function SessionPanels({
  sessionId,
  skills,
  artifacts,
  inputFiles = [],
  downloadHref,
  onExport,
}: SessionPanelsProps) {
  return (
    <div className="pointer-events-none absolute right-4 top-3 z-20 flex w-80 flex-col gap-2">
      <FloatingPanel
        title="Artefakty"
        meta={<span className="tabular-nums">{artifacts.length}</span>}
        defaultOpen={artifacts.length > 0}
      >
        {artifacts.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            {sessionId ? "Poproś o raport - pojawi się tutaj." : "Wystartuj sesję, aby zacząć."}
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {artifacts.map((artifact) => (
              <ArtifactRow
                key={artifact.id}
                artifact={artifact}
                downloadHref={downloadHref(artifact.id)}
                {...(onExport ? { onExport: () => onExport(artifact.id) } : {})}
              />
            ))}
          </div>
        )}
      </FloatingPanel>

      <FloatingPanel
        title="Zasoby sesji"
        meta={<span className="tabular-nums">{skills.length + inputFiles.length}</span>}
      >
        {skills.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Brak skilli w tej sesji.</p>
        ) : (
          <ul className="space-y-1.5 p-3">
            {skills.map((skill) => (
              <li key={skill.id} className="text-xs">
                <span className="font-mono font-medium">{skill.name}</span>
                <p className="mt-0.5 line-clamp-2 text-muted-foreground">{skill.description}</p>
              </li>
            ))}
          </ul>
        )}
        {inputFiles.length > 0 ? (
          <div className="border-t border-border/60 p-3">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Pliki wejściowe
            </p>
            <ul className="space-y-1">
              {inputFiles.map((file) => (
                <li
                  key={file.filename}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate" title={file.filename}>
                    {file.filename}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </FloatingPanel>
    </div>
  )
}
