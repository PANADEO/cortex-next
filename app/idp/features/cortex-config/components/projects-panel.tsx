"use client"

import type { CoworkProjectConfig } from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingState,
  Switch,
} from "@cortex/ui"
import { MessagesSquare, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useDeleteProject, useGovernanceConfig, useUpdateProject } from "../hooks/use-governance"
import { AccessDeniedState } from "./config-screen"

/** Total resources a composition grants (branches + leaves) across kinds. */
function compositionCount(project: CoworkProjectConfig): number {
  const { skills, connectors, secrets } = project.composition
  return [skills, connectors, secrets].reduce(
    (sum, grant) => sum + grant.branches.length + grant.leaves.length,
    0,
  )
}

function ProjectCard({
  project,
  onDelete,
  onToggle,
}: {
  project: CoworkProjectConfig
  onDelete: () => void
  onToggle: (enabled: boolean) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{project.name}</CardTitle>
            <CardDescription className="mt-1">{project.description}</CardDescription>
          </div>
          <Switch
            checked={project.enabled}
            onCheckedChange={onToggle}
            aria-label={`Aktywność kafelka ${project.name}`}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {/* Bez badge'a z `provider`: od 05.08.2026 ma jedną możliwą wartość
              ("openai-compatible" — wszystko idzie przez cortex-proxy), więc
              pokazywał adminowi nazwę protokołu, na którą i tak nie ma wpływu,
              identyczną w każdym wierszu. */}
          <Badge variant="secondary">{project.model.modelId}</Badge>
          {project.allowedRoleIds.map((roleId) => (
            <Badge key={roleId} variant="outline">
              {roleId}
            </Badge>
          ))}
          <Badge variant="outline">{project.sandbox.mode === "docker" ? "docker" : "local"}</Badge>
          {compositionCount(project) > 0 ? (
            <Badge variant="outline">klocki: {compositionCount(project)}</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/cortex-cowork/chat?project=${encodeURIComponent(project.id)}`}>
              <MessagesSquare className="mr-1.5 h-3.5 w-3.5" />
              Otwórz chat
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/cortex-config/projects/${encodeURIComponent(project.id)}`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edytuj
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Usuń
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProjectsPanel() {
  const governance = useGovernanceConfig()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  if (governance.isPending) {
    return <LoadingState label="Wczytywanie konfiguracji..." />
  }
  if (governance.isError) return <AccessDeniedState />

  const config = governance.data
  const projects = [...config.projects].sort((a, b) => a.name.localeCompare(b.name))

  const handleDelete = (project: CoworkProjectConfig) => {
    if (!window.confirm(`Usunąć projekt "${project.name}"? Sesje i artefakty pozostaną na dysku.`)) {
      return
    }
    deleteProject.mutate(project.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Kafelki agentowe (task-chat) konfigurowane centralnie - każdy projekt to osobny kafelek
          na hubie z własnym modelem, klockami i sandboxem.
        </p>
        <Button asChild>
          <Link href="/cortex-config/projects/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Nowy projekt
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Brak projektów"
          description="Utwórz pierwszy kafelek agentowy dla działu."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => handleDelete(project)}
              onToggle={(enabled) =>
                updateProject.mutate({
                  ...project,
                  enabled,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
