"use client"

import { AiToolGate } from "@/components/ai-tools/ai-tool-gate"
import {
  AI_TOOL_CATEGORIES,
  getVisibleAiTools,
  type AiToolDefinition,
} from "@/lib/ai-tools/registry"
import { useAuthorizedApps } from "@cortex/api"
import { Badge, Button, Card, CardContent, EmptyState, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

export function AiToolsDashboard() {
  const authorized = useAuthorizedApps()
  const visibleTools = useMemo(() => getVisibleAiTools(authorized.apps), [authorized.apps])
  const featuredTools = visibleTools.filter((tool) => tool.isFeatured)

  return (
    <AiToolGate>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="AI Tools"
          description="Narzędzia AI działające przez Cortex Proxy; uprawnienia z Konfiguracji Systemu."
        />

        <div className="flex flex-1 flex-col gap-6 px-8 py-6">
          {featuredTools.length > 0 ? (
            <section className="grid gap-4 lg:grid-cols-3">
              {featuredTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} featured />
              ))}
            </section>
          ) : null}

          {visibleTools.length === 0 ? (
            <EmptyState
              icon={LockKeyhole}
              title="Nie masz włączonych mini-aplikacji AI"
              description="Administrator musi przypisać co najmniej jedną aplikację AI Tools."
            />
          ) : (
            <div className="space-y-6">
              {AI_TOOL_CATEGORIES.map((category) => {
                const tools = visibleTools.filter((tool) => tool.category === category)
                if (tools.length === 0) return null

                return (
                  <section key={category} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold">{category}</h2>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {tools.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {tools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AiToolGate>
  )
}

interface ToolCardProps {
  tool: AiToolDefinition
  featured?: boolean
}

function ToolCard({ tool, featured = false }: ToolCardProps) {
  const Icon = tool.icon

  return (
    <Card className={cn("transition-colors hover:border-cortex/50", featured && "bg-muted/20")}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cortex/10 text-cortex">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{tool.label}</h3>
              {featured ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  szybki start
                </Badge>
              ) : null}
            </div>
            <p className="text-sm leading-5 text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {tool.scope}
          </div>
          <Button asChild size="sm" variant={featured ? "default" : "outline"}>
            <Link href={`/ai-tools/${tool.id}`}>
              Otwórz
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
