"use client"

import { IntrastatResourceUploadButton } from "@/components/intrastat/resource-upload-button"
import { useIntrastatCnResource } from "@/lib/intrastat/hooks"
import { Card, CardContent, DataCard, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { BrainCircuit, Database, FileSpreadsheet, GitBranch } from "lucide-react"

export default function IntrastatResourcesPage() {
  const resource = useIntrastatCnResource()
  const data = resource.data

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Intrastat Resources"
        description="Client-maintained CN reference workbook used for exact and nearest-index matching."
        actions={<IntrastatResourceUploadButton />}
      />

      <div className="grid gap-4 px-8 py-6 lg:grid-cols-4">
        <DataCard
          label="Active rows"
          value={String(data?.row_count ?? 0)}
          description={data?.file_name ?? "No CN resource uploaded"}
          icon={Database}
          tone={data?.row_count ? "success" : "warning"}
        />
        <DataCard
          label="Version"
          value={data?.id ? data.id.slice(0, 8) : "—"}
          description={data?.created_at ? formatAbsolute(data.created_at) : "No active version"}
          icon={GitBranch}
        />
        <DataCard
          label="Embeddings"
          value={String(data?.embedding_count ?? 0)}
          description={data?.embedding_model ?? "Not calculated"}
          icon={BrainCircuit}
          tone={data?.embedding_count ? "success" : "warning"}
        />
        <DataCard
          label="Required workbook"
          value="XLSX"
          description="indeks towaru / kod CN 8 cyfr / kod CN / opis"
          icon={FileSpreadsheet}
        />

        <Card className="lg:col-span-4">
          <CardContent className="max-w-3xl space-y-3 p-5 text-sm text-muted-foreground">
            <p>
              The invoice index is copied from the invoice. The resource is used to choose CN and
              description by exact match, longest unique prefix/fragment, invoice CN, or constrained
              description match.
            </p>
            <p>
              If a match is ambiguous or missing, the declaration line stays visible in Review and
              the final Intrastat import sheet keeps CN blank until corrected.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
