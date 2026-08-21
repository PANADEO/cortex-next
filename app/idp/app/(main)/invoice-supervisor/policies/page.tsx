"use client"

import { InvoiceSupervisorPolicyFormDialog } from "@/components/invoice-supervisor/policy-form-dialog"
import {
  useInvoiceSupervisorPolicies,
  useInvoiceSupervisorSetDefaultPolicy,
} from "@/lib/invoice-supervisor/hooks"
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

export default function InvoiceSupervisorPoliciesPage() {
  const { data: policies, isLoading, isError, refetch } = useInvoiceSupervisorPolicies()
  const setDefault = useInvoiceSupervisorSetDefaultPolicy()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Polityki"
        description="Restrykcyjność (kiedy/jak mocno przypominać) i ton (jak brzmi) to niezależne wymiary."
        actions={<InvoiceSupervisorPolicyFormDialog />}
      />

      <div className="px-8 py-6">
        {isLoading ? (
          <LoadingState label="Ładowanie polityk..." />
        ) : isError ? (
          <ErrorState
            title="Nie udało się wczytać polityk"
            message="Sprawdź połączenie z backendem i spróbuj ponownie."
            onRetry={() => refetch()}
          />
        ) : !policies || policies.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Brak polityk"
            description="Utwórz pierwszą politykę, aby zdefiniować restrykcyjność i ton komunikacji."
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
                      Domyślna
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Restrykcyjność</span>
                    <Badge variant="secondary">{policy.restrictiveness}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ton</span>
                    <span>{policy.tone_name ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Klient</span>
                    <span>{policy.client_name ?? "globalna"}</span>
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
                      Ustaw jako domyślną
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
