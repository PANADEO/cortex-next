"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@cortex/ui"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { useCatalog, useUpdateConnectors } from "../hooks/use-governance"
import {
  connectorFormSchema,
  connectorFormValuesToConfig,
  connectorToFormValues,
  EMPTY_CONNECTOR_FORM_VALUES,
  type ConnectorFormValues,
} from "../schemas"
import { AccessDeniedState, ConfigScreen } from "./config-screen"
import { FieldError } from "./form-fields"
import { DepartmentSelect } from "./pickers"

const BACK_HREF = "/cortex-config/catalog"

/** Full-screen editor for one catalog connector (MCP server or CLI tool). */
export function ConnectorEditorScreen({ connectorId }: { connectorId?: string | undefined }) {
  const catalog = useCatalog()
  const updateConnectors = useUpdateConnectors()
  const router = useRouter()

  if (catalog.isPending) return <LoadingState label="Wczytywanie katalogu..." />
  if (catalog.isError || !catalog.data) return <AccessDeniedState title="Brak dostępu do katalogu" />

  const { connectors, departments } = catalog.data
  const connector = connectorId ? connectors.find((c) => c.id === connectorId) : undefined
  if (connectorId && !connector) {
    return (
      <ErrorState title="Nie znaleziono konektora" message={`Brak konektora "${connectorId}".`} />
    )
  }

  return (
    <ConnectorForm
      key={connector?.id ?? "new"}
      departments={departments}
      defaultValues={connector ? connectorToFormValues(connector) : EMPTY_CONNECTOR_FORM_VALUES}
      editing={Boolean(connector)}
      isSaving={updateConnectors.isPending}
      onSubmit={async (values) => {
        const next = connectors.filter((c) => c.id !== values.id)
        await updateConnectors.mutateAsync([...next, connectorFormValuesToConfig(values)])
        router.push(BACK_HREF)
      }}
    />
  )
}

function ConnectorForm({
  departments,
  defaultValues,
  editing,
  isSaving,
  onSubmit,
}: {
  departments: string[]
  defaultValues: ConnectorFormValues
  editing: boolean
  isSaving: boolean
  onSubmit: (values: ConnectorFormValues) => Promise<void>
}) {
  const form = useForm<ConnectorFormValues>({
    resolver: zodResolver(connectorFormSchema),
    defaultValues,
  })
  const type = form.watch("type")
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch {
      // Rejected save (e.g. 400 from catalog/connectors/route.ts validation):
      // stay on the page so the admin can fix it. The mutation's onError
      // already surfaced a toast with the reason - see useUpdateConnectors.
    }
  })

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel="Katalog zasobów"
        title={editing ? `Edytuj konektor: ${defaultValues.name}` : "Nowy konektor"}
        description="Narzędzie agenta: serwer MCP albo CLI, z sekretami przez referencje."
        save={{ isSaving, label: "Zapisz" }}
      >
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identyfikacja</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="conn-id">Identyfikator</Label>
                <Input
                  id="conn-id"
                  className="mt-1"
                  disabled={editing}
                  {...form.register("id")}
                />
                <FieldError message={form.formState.errors.id?.message} />
              </div>
              <div>
                <Label htmlFor="conn-name">Nazwa</Label>
                <Input id="conn-name" className="mt-1" {...form.register("name")} />
                <FieldError message={form.formState.errors.name?.message} />
              </div>
              <div>
                <Label>Typ</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcp">MCP server</SelectItem>
                        <SelectItem value="cli">CLI tool</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label>Departament</Label>
                <div className="mt-1">
                  <Controller
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <DepartmentSelect
                        departments={departments}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <FieldError message={form.formState.errors.department?.message} />
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <Switch
                      id="conn-enabled"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="conn-enabled">Aktywny</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Połączenie</CardTitle>
              <CardDescription>
                Wartości sekretów nigdy nie trafiają do konfiguracji - tylko referencje do
                ścieżek w Sekretach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="conn-target">
                  {type === "mcp" ? "URL serwera" : "Ścieżka do narzędzia"}
                </Label>
                <Input
                  id="conn-target"
                  className="mt-1 font-mono text-xs"
                  placeholder={type === "mcp" ? "https://mcp.example.com/sse" : "/usr/local/bin/tool"}
                  {...form.register("target")}
                />
                <FieldError message={form.formState.errors.target?.message} />
              </div>
              <div>
                <Label htmlFor="conn-refs">
                  {type === "mcp" ? "Nagłówki" : "Zmienne środowiskowe"} → referencja sekretu
                  (nazwa=ścieżka, jedna na linię)
                </Label>
                <Textarea
                  id="conn-refs"
                  className="mt-1 font-mono text-xs"
                  rows={3}
                  placeholder={
                    type === "mcp" ? "Authorization=finanse/jira/token" : "API_TOKEN=finanse/token"
                  }
                  {...form.register("credentialRefs")}
                />
              </div>
              {type === "cli" ? (
                <div>
                  <Label htmlFor="conn-args">Stałe argumenty (opcjonalne)</Label>
                  <Input
                    id="conn-args"
                    className="mt-1 font-mono text-xs"
                    placeholder="--format json"
                    {...form.register("baseArgs")}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </ConfigScreen>
    </form>
  )
}
