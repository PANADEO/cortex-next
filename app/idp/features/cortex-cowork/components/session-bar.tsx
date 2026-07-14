"use client"

import { useCoworkSessionStore } from "@/lib/stores/cortex-cowork-session-store"
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { Plus, Trash2 } from "lucide-react"
import type { CoworkSessionUsage } from "../types"
import { useCoworkSessionActions, useCoworkSessions } from "../hooks/use-cowork-sessions"
import { ContextMeter } from "./context-meter"

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface SessionBarProps {
  projectId: string
  activeSessionId: string | null
  /** Live usage for the active session (from the loaded session, not the list). */
  usage?: CoworkSessionUsage | undefined
}

export function SessionBar({ projectId, activeSessionId, usage }: SessionBarProps) {
  const sessions = useCoworkSessions(projectId)
  const { create, remove } = useCoworkSessionActions(projectId)
  const setSessionId = useCoworkSessionStore((s) => s.setSessionId)

  const list = sessions.data ?? []

  const handleClear = () => {
    if (!activeSessionId) return
    if (!window.confirm("Wyczyścić tę sesję? Skasuje transkrypt i artefakty z sandboxa.")) return
    remove.mutate(activeSessionId)
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">
      <Select
        value={activeSessionId ?? ""}
        onValueChange={(id) => setSessionId(projectId, id)}
        disabled={list.length === 0}
      >
        <SelectTrigger className="h-8 w-64 text-xs">
          <SelectValue placeholder="Brak sesji" />
        </SelectTrigger>
        <SelectContent>
          {list.map((session) => (
            <SelectItem key={session.id} value={session.id} className="text-xs">
              {formatWhen(session.createdAt)} · {session.messageCount} wiad. · {session.artifactCount} art.
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => create.mutate()}
        disabled={create.isPending}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Nowa
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-destructive hover:text-destructive"
        onClick={handleClear}
        disabled={!activeSessionId || remove.isPending}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Wyczyść
      </Button>

      <div className="ml-auto">{usage ? <ContextMeter usage={usage} /> : null}</div>
    </div>
  )
}
