"use client"

import { useCoworkSessionStore } from "@/lib/stores/cortex-cowork-session-store"
import { useShellUser } from "@cortex/api"
import { DEFAULT_COWORK_PROJECT_ID } from "@cortex/types"
import { Button, Textarea } from "@cortex/ui"
import { cn } from "@cortex/utils"
import {
  BookOpen,
  Check,
  FolderClosed,
  Loader2,
  NotebookPen,
  SquarePen,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { useCoworkSessionActions, useCoworkSessions } from "../hooks/use-cowork-sessions"
import { useMyInstructions, useSaveMyInstructions } from "../hooks/use-my-instructions"
import { useCoworkProjectTiles } from "../hooks/use-project-tiles"
import type { CoworkProjectTile } from "../queries"
import { DisclosureChevron } from "./disclosure"

// Codex-style workspace shell for the cowork tile: a dark, session-centric
// sidebar (projects with their sessions nested under the active one) and a
// full-bleed main surface. Deliberately dark regardless of the global theme -
// the `dark` class re-derives all shadcn tokens for this subtree. No portaled
// primitives (Select/Dialog) are used inside, so nothing escapes the scope.

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SessionRows({ projectId }: { projectId: string }) {
  const sessions = useCoworkSessions(projectId)
  const { remove } = useCoworkSessionActions(projectId)
  const activeSessionId = useCoworkSessionStore((s) => s.sessionIds[projectId] ?? null)
  const setSessionId = useCoworkSessionStore((s) => s.setSessionId)

  const list = sessions.data ?? []
  if (sessions.isPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Wczytywanie sesji...
      </div>
    )
  }
  if (list.length === 0) {
    return <p className="px-3 py-1.5 text-xs text-muted-foreground/70">Brak sesji</p>
  }

  return (
    <div className="space-y-0.5">
      {list.map((session) => {
        const active = session.id === activeSessionId
        return (
          <div
            key={session.id}
            className={cn(
              "group flex items-center gap-1 rounded-md pr-1",
              active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
            )}
          >
            <button
              type="button"
              onClick={() => setSessionId(projectId, session.id)}
              className="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-xs"
              title={`Sesja z ${formatWhen(session.createdAt)}`}
            >
              {formatWhen(session.createdAt)}
              <span className="ml-1.5 text-muted-foreground">
                · {session.messageCount} wiad.
                {session.artifactCount > 0 ? ` · ${session.artifactCount} art.` : ""}
              </span>
            </button>
            <button
              type="button"
              aria-label="Usuń sesję"
              className="hidden shrink-0 rounded p-1 text-muted-foreground hover:text-destructive group-hover:block"
              onClick={() => {
                if (window.confirm("Usunąć tę sesję? Skasuje transkrypt i artefakty z sandboxa.")) {
                  remove.mutate(session.id)
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ProjectRow({
  project,
  active,
  onOpen,
}: {
  project: CoworkProjectTile
  active: boolean
  onOpen: () => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        title={project.description}
      >
        <FolderClosed className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{project.name}</span>
      </button>
      {active ? (
        <div className="ml-4 border-l border-border/60 pl-1">
          <SessionRows projectId={project.id} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The user layer of AGENTS.md, edited inline in the sidebar (no portaled
 * Dialog - a portal would escape this shell's scoped `.dark` subtree).
 */
function MyInstructions() {
  const [open, setOpen] = useState(false)
  const query = useMyInstructions(open)
  const save = useSaveMyInstructions()
  const [draft, setDraft] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Seed the draft once the note arrives; re-opening keeps unsaved edits.
  useEffect(() => {
    if (open && draft === null && query.data) setDraft(query.data.instructions)
  }, [open, draft, query.data])

  return (
    <div className="border-t border-border/60 px-2 py-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      >
        <NotebookPen className="h-3.5 w-3.5 shrink-0" />
        Moje instrukcje
        <DisclosureChevron open={open} className="ml-auto" />
      </button>
      {open ? (
        <div className="space-y-2 px-1 pt-2">
          <Textarea
            rows={4}
            value={draft ?? ""}
            onChange={(event) => setDraft(event.target.value)}
            disabled={query.isPending}
            placeholder={"np. Zwracaj się do mnie po imieniu.\nRaporty zawsze z sekcją TL;DR."}
            className="text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] leading-tight text-muted-foreground/70">
              Prywatna warstwa AGENTS.md - doklejana do każdej Twojej sesji.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 shrink-0 gap-1 text-xs"
              disabled={save.isPending || query.isPending || draft === null}
              onClick={() => {
                if (draft === null) return
                save.mutate(draft, {
                  onSuccess: () => {
                    setSaved(true)
                    setTimeout(() => setSaved(false), 1500)
                  },
                })
              }}
            >
              {save.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : saved ? (
                <Check className="h-3 w-3" />
              ) : null}
              {saved ? "Zapisano" : "Zapisz"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CoworkShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const shellUser = useShellUser()
  const { projects } = useCoworkProjectTiles()

  const onChat = pathname.startsWith("/cortex-cowork/chat")
  const activeProjectId = onChat ? (searchParams.get("project") ?? DEFAULT_COWORK_PROJECT_ID) : null
  const { create } = useCoworkSessionActions(activeProjectId ?? DEFAULT_COWORK_PROJECT_ID)

  // Tożsamość z powłoki (/api/me/identity), NIE z /user/me: Cowork jest trasą
  // tego samego monolitu, więc stoi też tam, gdzie backendu IDP nie ma —
  // wcześniej cała stopka sidebara po prostu tam znikała.
  const email = shellUser?.email ?? ""

  return (
    <div className="dark flex h-screen overflow-hidden bg-background text-foreground [color-scheme:dark]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <Link
            href="/"
            aria-label="Powrót do Cortex360 hub"
            className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
          >
            <Image
              src="/cortex-logo.png"
              alt="Cortex360"
              width={22}
              height={22}
              className="hue-rotate-180 invert"
            />
            <span className="text-sm text-foreground">Cortex Cowork</span>
          </Link>
        </div>

        <div className="space-y-0.5 px-2 pt-2">
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={!onChat || create.isPending}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SquarePen className="h-3.5 w-3.5" />
            )}
            Nowa sesja
          </button>
          <Link
            href="/cortex-cowork/skills"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm",
              pathname.startsWith("/cortex-cowork/skills")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Biblioteka skilli
          </Link>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Projekty
          </p>
          <div className="space-y-0.5">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                active={project.id === activeProjectId}
                onOpen={() =>
                  router.push(`/cortex-cowork/chat?project=${encodeURIComponent(project.id)}`)
                }
              />
            ))}
            {projects.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-muted-foreground/70">Brak projektów</p>
            ) : null}
          </div>
        </div>

        <MyInstructions />
        {email ? (
          <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-medium uppercase">
              {email.slice(0, 1)}
            </div>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        ) : null}
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
