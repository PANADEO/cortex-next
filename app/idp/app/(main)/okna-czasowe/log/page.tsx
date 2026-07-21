"use client"

import { useScanLog } from "@/features/okna-czasowe/hooks/use-log"
import { useRunScan } from "@/features/okna-czasowe/hooks/use-scan"
import { toastApiError } from "@cortex/api"
import { Button, Card, CardContent, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { Info, Loader2, ScanSearch, ScrollText } from "lucide-react"
import { toast } from "sonner"
import { logColumns } from "./columns"

export default function OknaCzasoweLogPage() {
  const logQuery = useScanLog()
  const runScan = useRunScan()

  const entries = [...(logQuery.data ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  async function handleScan() {
    try {
      const result = await runScan.mutateAsync()
      toast.success(
        `Skan zakończony: ${result.log.filmsScanned} filmów, ${result.log.newAvailabilities} nowych dostępności.`,
      )
    } catch (error) {
      toastApiError(error, "Skan nie powiódł się")
    }
  }

  return (
    <>
      <PageHeader
        title="Log"
        description="Historia uruchomień skanera — kiedy skanowano, ile filmów, co się zmieniło, jakie błędy."
        actions={
          <Button size="sm" onClick={handleScan} disabled={runScan.isPending}>
            {runScan.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            )}
            Skanuj teraz
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Card className="border-border/70 bg-muted/30">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Jak zaplanować codzienny skan</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ten skan sprawdza dostępność każdego śledzonego filmu na Rakuten TV PL przez publiczne
              GraphQL API JustWatch i zapisuje jeden wpis dziennie. Żeby zbierać dane przez cały okres
              projektu (docelowo ok. 6 miesięcy), uruchamiaj go raz dziennie z crona na maszynie, która
              ma dostęp do wdrożonej instancji frontendu:
            </p>
            <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
              <code>
                {`# crontab -e — codziennie o 06:00
0 6 * * * OKNA_CZASOWE_BASE_URL=https://<host-produkcyjny> node /path/to/cortex-frontend/scripts/okna-czasowe-scan.mjs >> /var/log/okna-czasowe-scan.log 2>&1`}
              </code>
            </pre>
            <p className="text-xs text-muted-foreground">
              Lokalnie / dev: <code className="rounded bg-background px-1 py-0.5">npm run okna-czasowe:scan</code>{" "}
              (domyślnie celuje w <code className="rounded bg-background px-1 py-0.5">http://localhost:3000</code>).
              Skrypt woła ten sam endpoint co przycisk „Skanuj teraz” —{" "}
              <code className="rounded bg-background px-1 py-0.5">POST /api/okna-czasowe/scan</code>.
            </p>
          </CardContent>
        </Card>

        {!logQuery.isLoading && entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Brak uruchomień"
            description="Log wypełni się po pierwszym skanie — ręcznym albo z crona."
          />
        ) : (
          <DataTable
            columns={logColumns}
            data={entries}
            isLoading={logQuery.isLoading}
            bordered
            getRowId={(entry) => entry.id}
          />
        )}
      </div>
    </>
  )
}
