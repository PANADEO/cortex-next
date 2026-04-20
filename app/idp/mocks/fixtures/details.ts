import type {
  ActionLogReadModel,
  PackageActionReadModel,
  PackageActionType,
  PackageDetailsResponse,
  PackageReadModel,
  PackageStatus,
  PackageTransition,
} from "@cortex/types"

export const ALLOWED_TRANSITIONS: Record<PackageStatus, PackageTransition[]> = {
  imported: [],
  imported_with_error: ["reprocess"],
  analysing: [],
  analysis_failed: ["reprocess"],
  ready_for_verification: ["start_verification", "reprocess"],
  verification: ["finish_verification", "cancel_verification"],
  verified: ["reset_verification", "reprocess"],
}

export function buildDetails(pkg: PackageReadModel): PackageDetailsResponse {
  const hasAnalysis =
    pkg.status === "ready_for_verification" ||
    pkg.status === "verification" ||
    pkg.status === "verified"

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
    status: pkg.status,
    assignee: pkg.assignee,
    analysis_result: analysisResult,
    verified_result: pkg.status === "verified" ? analysisResult : null,
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
  if (pkg.status === "imported_with_error") {
    push("imported_with_error", 1, "system@cortex.local", { error: "Malformed ZIP" })
    return events
  }
  push("analysing", 2, "system@cortex.local")
  if (pkg.status === "analysing") return events
  if (pkg.status === "analysis_failed") {
    push("analysis_failed", 8, "system@cortex.local", { reason: "LLM retry budget exceeded" })
    return events
  }
  push("ready_for_verification", 8, "system@cortex.local")
  if (pkg.status === "ready_for_verification") return events
  push("verification", 20, pkg.assignee ?? "demo@cortex.local")
  push("seller_updated", 22, pkg.assignee ?? "demo@cortex.local", {
    vat_id: { from: "PL123", to: "PL1234567890" },
  })
  if (pkg.status === "verification") return events
  if (pkg.status === "verified") {
    push("verified", 45, pkg.assignee ?? "demo@cortex.local")
  }
  return events
}

export function buildActionLogs(packages: PackageReadModel[]): ActionLogReadModel[] {
  const all: ActionLogReadModel[] = []
  for (const pkg of packages) {
    for (const e of eventsForPackage(pkg)) {
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
): PackageActionReadModel[] {
  const pkg = packages.find((p) => p.id === id)
  if (!pkg) return []
  return eventsForPackage(pkg).reverse()
}
