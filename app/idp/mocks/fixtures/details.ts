import type {
  ActionLogReadModel,
  PackageActionReadModel,
  PackageActionType,
  PackageDetailsResponse,
  PackageReadModel,
  PackageTransition,
} from "@cortex/types"

// Mirror domain/package/workflow/package_workflow_service.py:
//   ANALYSIS_FAILED                          -> [REPROCESS]
//   READY + NOT_STARTED                      -> [START_VERIFICATION, REPROCESS]
//   READY + IN_PROGRESS (assignee == user)   -> [CANCEL_VERIFICATION, FINISH_VERIFICATION]
//   READY + COMPLETED                        -> [RESET_VERIFICATION, REPROCESS]
export function allowedTransitions(
  pkg: PackageReadModel,
  currentUserEmail: string | null,
): PackageTransition[] {
  if (pkg.processing_state === "analysis_failed") return ["reprocess"]
  if (pkg.processing_state !== "ready") return []
  if (pkg.verification_state === "not_started") {
    return ["start_verification", "reprocess"]
  }
  if (pkg.verification_state === "in_progress") {
    if (!currentUserEmail || !pkg.assignee) return []
    if (currentUserEmail.toLowerCase() !== pkg.assignee.toLowerCase()) return []
    return ["cancel_verification", "finish_verification"]
  }
  return ["reset_verification", "reprocess"]
}

export function buildDetails(pkg: PackageReadModel): PackageDetailsResponse {
  const hasAnalysis = pkg.processing_state === "ready"
  const isVerified = pkg.verification_state === "completed"

  const analysisResult = hasAnalysis
    ? {
        seller: {
          name: "Acme Logistics Sp. z o.o.",
          vat_id: "PL1234567890",
          country: "PL",
          city: "Warsaw",
        },
        buyer: {
          name: "Deutsche Importers GmbH",
          vat_id: "DE987654321",
          country: "DE",
          city: "Hamburg",
        },
        invoice: {
          invoice_number: `INV-${pkg.id.split("-")[1]}`,
          invoice_date: "2026-04-15",
          currency: "EUR",
          total_invoice_value: "12450.75",
        },
        lines: [
          {
            line_number: "1",
            description: "Electronic components — CN 8541",
            cn_code: "8541100000",
            quantity: "250",
            net_weight_kg: "18.5",
            invoice_value: "4820.00",
          },
          {
            line_number: "2",
            description: "Steel fittings — CN 7307",
            cn_code: "7307990090",
            quantity: "85",
            net_weight_kg: "142.3",
            invoice_value: "2910.50",
          },
          {
            line_number: "3",
            description: "Plastic housings — CN 3926",
            cn_code: "3926909790",
            quantity: "500",
            net_weight_kg: "43.1",
            invoice_value: "4720.25",
          },
        ],
      }
    : null

  return {
    id: pkg.id,
    file_name: pkg.file_name,
    file_hash: pkg.file_hash,
    file_size_mb: Number((1 + ((Number(pkg.id.slice(-3)) || 1) % 50) / 3).toFixed(2)),
    created_date: pkg.created_date,
    processing_state: pkg.processing_state,
    verification_state: pkg.verification_state,
    assignee: pkg.assignee,
    custom_status: pkg.custom_status,
    user_notes: pkg.user_notes,
    last_additional_ai_context: null,
    analysis_result: analysisResult,
    verified_result: isVerified ? analysisResult : null,
    total_tokens: hasAnalysis ? 2400 + ((Number(pkg.id.slice(-3)) || 0) * 31) : null,
    total_cost_usd: hasAnalysis ? "0.0942" : null,
  }
}

function eventsForPackage(pkg: PackageReadModel): PackageActionReadModel[] {
  const baseTime = new Date(pkg.created_date).getTime()
  const events: PackageActionReadModel[] = []
  const push = (type: PackageActionType, minutes: number, by: string, payload?: unknown) => {
    events.push({
      id: `${pkg.id}-evt-${events.length}`,
      action_type: type,
      timestamp: new Date(baseTime + minutes * 60_000).toISOString(),
      performed_by: by,
      payload: payload ? JSON.stringify(payload) : null,
    })
  }

  push("imported", 0, pkg.assignee ?? "system@cortex.local")

  if (pkg.processing_state === "imported_with_error") {
    push("imported_with_error", 1, "system@cortex.local", { error: "Malformed ZIP" })
    return events
  }

  push("analysing", 2, "system@cortex.local")

  if (pkg.processing_state === "analysing") return events
  if (pkg.processing_state === "analysis_failed") {
    push("analysis_failed", 8, "system@cortex.local", { reason: "LLM retry budget exceeded" })
    return events
  }

  push("ready_for_verification", 8, "system@cortex.local")

  if (pkg.verification_state === "not_started") return events

  push("verification", 20, pkg.assignee ?? "demo@cortex.local")
  push("seller_updated", 22, pkg.assignee ?? "demo@cortex.local", {
    vat_id: { from: "PL123", to: "PL1234567890" },
  })

  if (pkg.verification_state === "in_progress") return events

  push("verified", 45, pkg.assignee ?? "demo@cortex.local")
  return events
}

export function buildActionLogs(
  packages: PackageReadModel[],
  extras?: Map<string, PackageActionReadModel[]>,
): ActionLogReadModel[] {
  const all: ActionLogReadModel[] = []
  for (const pkg of packages) {
    const baseEvents = eventsForPackage(pkg)
    const extraEvents = extras?.get(pkg.id) ?? []
    for (const e of [...baseEvents, ...extraEvents]) {
      all.push({
        ...e,
        package_id: pkg.id,
        package_file_name: pkg.file_name,
      })
    }
  }
  all.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  return all
}

export function packageActions(
  packages: PackageReadModel[],
  id: string,
  extras?: Map<string, PackageActionReadModel[]>,
): PackageActionReadModel[] {
  const pkg = packages.find((p) => p.id === id)
  if (!pkg) return []
  const combined = [...eventsForPackage(pkg), ...(extras?.get(id) ?? [])]
  combined.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  return combined.reverse()
}
