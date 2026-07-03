"use client"

import { useCoworkSkillCatalog } from "@/features/cortex-cowork"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@cortex/ui"

export default function CortexCoworkSkillsPage() {
  const { data, isLoading, isError, error, refetch } = useCoworkSkillCatalog()

  return (
    <>
      <PageHeader
        title="Skills library"
        description="Reusable expertise packages copied into every new sandbox session."
      />
      <div className="flex-1 space-y-3 px-8 py-6">
        {isLoading ? <LoadingState label="Loading skills..." /> : null}
        {isError ? (
          <ErrorState
            {...(error instanceof Error ? { message: error.message } : {})}
            onRetry={() => refetch()}
          />
        ) : null}
        {data?.map((skill) => (
          <Card key={skill.id}>
            <CardHeader>
              <CardTitle className="font-mono text-sm">{skill.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{skill.description}</CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
