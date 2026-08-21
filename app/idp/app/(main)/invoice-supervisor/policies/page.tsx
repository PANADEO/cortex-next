"use client"

import { InvoiceSupervisorPolicyFormDialog } from "@/components/invoice-supervisor/policy-form-dialog"
import {
  useInvoiceSupervisorPolicies,
  useInvoiceSupervisorSetDefaultPolicy,
} from "@/lib/invoice-supervisor/hooks"
import type { InvoiceSupervisorRestrictiveness } from "@/lib/invoice-supervisor/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { Mail, MessageSquare, ScrollText, Star } from "lucide-react"
import { useTranslation } from "react-i18next"

// Poziomy restrykcyjności przychodzą z backendu jako DANE po polsku; mapa
// zamienia je na klucz napisu, żeby na ekranie stał tekst w języku interfejsu.
const RESTRICTIVENESS_KEYS: Record<InvoiceSupervisorRestrictiveness, string> = {
  mała: "restrictiveness.low",
  średnia: "restrictiveness.medium",
  duża: "restrictiveness.high",
  surowa: "restrictiveness.strict",
}

export default function InvoiceSupervisorPoliciesPage() {
  const { t } = useTranslation("invoice-supervisor")
  const { data: policies, isLoading, isError, refetch } = useInvoiceSupervisorPolicies()
  const setDefault = useInvoiceSupervisorSetDefaultPolicy()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("policies.title")}
        description={t("policies.description")}
        actions={<InvoiceSupervisorPolicyFormDialog />}
      />

      <div className="px-8 py-6">
        {isLoading ? (
          <LoadingState label={t("policies.loading")} />
        ) : isError ? (
          <ErrorState
            title={t("policies.loadErrorTitle")}
            message={t("errors.backendMessage")}
            onRetry={() => refetch()}
          />
        ) : !policies || policies.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("policies.emptyTitle")}
            description={t("policies.emptyDescription")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => (
              <Card key={policy.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <CardTitle className="text-base">{policy.name}</CardTitle>
                  {policy.is_default && (
                    <Badge className="gap-1">
                      <Star className="size-3" />
                      {t("policies.defaultBadge")}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("policies.restrictiveness")}</span>
                    <Badge variant="secondary">
                      {t(RESTRICTIVENESS_KEYS[policy.restrictiveness])}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("policies.tone")}</span>
                    <span>{policy.tone_name ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("policies.client")}</span>
                    <span>{policy.client_name ?? t("policies.global")}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    {policy.enable_email && <Mail className="size-4 text-muted-foreground" />}
                    {policy.enable_sms && (
                      <MessageSquare className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  {!policy.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={setDefault.isPending}
                      onClick={() => setDefault.mutate(policy.id)}
                    >
                      {t("policies.setDefault")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
