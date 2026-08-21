"use client"

import { ImportQueue } from "@/components/import/import-queue"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function ImportPage() {
  const { t } = useTranslation("idp")
  return (
    <>
      <PageHeader title={t("import.page.title")} description={t("import.page.description")} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-8 py-6">
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t("import.page.howItWorks")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>{t("import.page.ruleZip")}</li>
            <li>{t("import.page.ruleEmail")}</li>
            <li>{t("import.page.ruleFiles")}</li>
            <li>{t("import.page.ruleSlot")}</li>
          </ul>
        </div>
        <ImportQueue />
      </div>
    </>
  )
}
