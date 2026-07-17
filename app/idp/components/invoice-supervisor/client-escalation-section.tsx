"use client"

import { useInvoiceSupervisorForceClientEscalation } from "@/lib/invoice-supervisor/hooks"
import {
  INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS,
  type InvoiceSupervisorEscalationStage,
} from "@/lib/invoice-supervisor/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"

interface InvoiceSupervisorClientEscalationSectionProps {
  clientId: number
  clientName: string
  openInvoiceCount: number
}

/**
 * Manual override for the "accountant already knows this client won't pay" scenario — force
 * every open invoice for a client straight to a given escalation stage in one action, instead
 * of waiting for the normal per-invoice threshold-driven cadence. Still routes through the
 * Skrzynka proposal review flow — nothing is sent automatically.
 */
export function InvoiceSupervisorClientEscalationSection({
  clientId,
  clientName,
  openInvoiceCount,
}: InvoiceSupervisorClientEscalationSectionProps) {
  const [stage, setStage] = useState<InvoiceSupervisorEscalationStage>("payment_demand")
  const forceEscalation = useInvoiceSupervisorForceClientEscalation(clientId)

  if (openInvoiceCount === 0) return null

  return (
    <Card className="border-amber-200 dark:border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          Eskaluj wszystkie otwarte faktury tego klienta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Wymuś natychmiastowe przejście {openInvoiceCount} otwartych faktur {clientName} do
          wybranego etapu, bez czekania na progi czasowe polityki.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={stage}
            onValueChange={(value) => setStage(value as InvoiceSupervisorEscalationStage)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-400"
              >
                Eskaluj {openInvoiceCount} faktur(y)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Eskalować {openInvoiceCount} faktur do etapu:{" "}
                  {INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS[stage]}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Każda otwarta faktura {clientName} dostanie nową propozycję na tym etapie w
                  Skrzynce. Nic nie zostanie wysłane automatycznie — nadal wymaga Twojego
                  zatwierdzenia.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction onClick={() => forceEscalation.mutate(stage)}>
                  Eskaluj
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
