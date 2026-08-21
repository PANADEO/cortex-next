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
import { useTranslation } from "react-i18next"

export default function CortexCoworkSkillsPage() {
  const { t } = useTranslation("cortex-cowork")
  const { data, isLoading, isError, error, refetch } = useCoworkSkillCatalog()

  return (
    <>
      <PageHeader title={t("skills.title")} description={t("skills.description")} />
      <div className="flex-1 space-y-3 px-8 py-6">
        {isLoading ? <LoadingState label={t("skills.loading")} /> : null}
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
