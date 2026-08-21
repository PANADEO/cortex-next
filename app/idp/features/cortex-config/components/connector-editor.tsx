"use client"

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
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation("cortex-config")
  const catalog = useCatalog()
  const updateConnectors = useUpdateConnectors()
  const router = useRouter()

  if (catalog.isPending) return <LoadingState label={t("state.loadingCatalog")} />
  if (catalog.isError || !catalog.data)
    return <AccessDeniedState title={t("access.catalogTitle")} />

  const { connectors, departments } = catalog.data
  const connector = connectorId ? connectors.find((c) => c.id === connectorId) : undefined
  if (connectorId && !connector) {
    return (
      <ErrorState
        title={t("connectorEditor.notFoundTitle")}
        message={t("connectorEditor.notFoundMessage", { id: connectorId })}
      />
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
  const { t } = useTranslation(["cortex-config", "common"])
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
        backLabel={t("nav.backToCatalog")}
        title={
          editing
            ? t("connectorEditor.editTitle", { name: defaultValues.name })
            : t("connectorEditor.newTitle")
        }
        description={t("connectorEditor.description")}
        save={{ isSaving, label: t("common:actions.save") }}
      >
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("connectorEditor.identitySection")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="conn-id">{t("fields.id")}</Label>
                <Input id="conn-id" className="mt-1" disabled={editing} {...form.register("id")} />
                <FieldError message={form.formState.errors.id?.message} />
              </div>
              <div>
                <Label htmlFor="conn-name">{t("fields.name")}</Label>
                <Input id="conn-name" className="mt-1" {...form.register("name")} />
                <FieldError message={form.formState.errors.name?.message} />
              </div>
              <div>
                <Label>{t("fields.type")}</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcp">{t("connectorEditor.kindMcp")}</SelectItem>
                        <SelectItem value="cli">{t("connectorEditor.kindCli")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label>{t("fields.department")}</Label>
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
                <Label htmlFor="conn-enabled">{t("fields.active")}</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("connectorEditor.connectionSection")}</CardTitle>
              <CardDescription>{t("connectorEditor.connectionDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="conn-target">
                  {type === "mcp" ? t("connectorEditor.serverUrl") : t("connectorEditor.toolPath")}
                </Label>
                <Input
                  id="conn-target"
                  className="mt-1 font-mono text-xs"
                  placeholder={
                    type === "mcp" ? "https://mcp.example.com/sse" : "/usr/local/bin/tool"
                  }
                  {...form.register("target")}
                />
                <FieldError message={form.formState.errors.target?.message} />
              </div>
              <div>
                <Label htmlFor="conn-refs">
                  {t("connectorEditor.refsLabel", {
                    kind:
                      type === "mcp"
                        ? t("connectorEditor.refsHeaders")
                        : t("connectorEditor.refsEnvVars"),
                  })}
                </Label>
                <Textarea
                  id="conn-refs"
                  className="mt-1 font-mono text-xs"
                  rows={3}
                  placeholder={
                    type === "mcp"
                      ? t("connectorEditor.refsPlaceholderMcp")
                      : t("connectorEditor.refsPlaceholderCli")
                  }
                  {...form.register("credentialRefs")}
                />
              </div>
              {type === "cli" ? (
                <div>
                  <Label htmlFor="conn-args">{t("connectorEditor.baseArgs")}</Label>
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
