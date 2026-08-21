"use client"

import { Button, Card, CardContent, Input, Label } from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Fragment, useEffect, useId } from "react"
import { useForm, type Path } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { ZodType } from "zod"

export interface FieldSpec<T> {
  name: Path<T>
  /** Klucz przestrzeni `idp` — napis powstaje w miejscu renderu. */
  labelKey: string
  span?: 1 | 2
  uppercase?: boolean
  readOnly?: boolean
}

interface Props<T extends Record<string, string>> {
  label: string
  fields: readonly FieldSpec<T>[]
  defaults: T
  schema: ZodType<T>
  canEdit: boolean
  isSaving?: boolean | undefined
  /** Changes to this key trigger a form reset to `defaults`. Prevents clobbering
   *  in-flight user edits when the parent re-renders with a structurally-equal
   *  `defaults` object (e.g. after a polling refetch). */
  resetKey?: string | number | undefined
  onSave: (values: T) => Promise<void>
}

export function FieldsForm<T extends Record<string, string>>({
  label,
  fields,
  defaults,
  schema,
  canEdit,
  isSaving = false,
  resetKey,
  onSave,
}: Props<T>) {
  const { t } = useTranslation(["idp", "common"])
  const idPrefix = useId()
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaults as never,
  })

  useEffect(() => {
    form.reset(defaults as never)
    // Intentionally excluding `defaults` — reset only when resetKey flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, form])

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">{label}</h3>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            {fields.map((f) => (
              <Fragment key={String(f.name)}>
                <dt className="text-muted-foreground">{t(f.labelKey)}</dt>
                <dd className="truncate font-mono text-xs">{defaults[f.name as keyof T] || "—"}</dd>
              </Fragment>
            ))}
          </dl>
        </CardContent>
      </Card>
    )
  }

  const submit = form.handleSubmit(async (values) => {
    await onSave(values)
    form.reset(values)
  })

  const dirtyFields = form.formState.dirtyFields as Record<string, boolean | undefined>
  const hasReadOnly = fields.some((f) => f.readOnly)
  const editableDirty = fields.some((f) => !f.readOnly && dirtyFields[String(f.name)])
  const disableActions = (hasReadOnly ? !editableDirty : !form.formState.isDirty) || isSaving

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="text-sm font-semibold">{label}</h3>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          {fields.map((f) => {
            const fieldId = `${idPrefix}-${String(f.name)}`
            const error = form.formState.errors[f.name as Path<T>]
            return (
              <div key={String(f.name)} className={f.span === 2 ? "md:col-span-2" : undefined}>
                <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
                  {t(f.labelKey)}
                </Label>
                <Input
                  id={fieldId}
                  {...form.register(f.name, {
                    setValueAs: (v: unknown) =>
                      typeof v === "string" && f.uppercase ? v.toUpperCase() : v,
                  })}
                  aria-invalid={Boolean(error)}
                  className="mt-1"
                  readOnly={f.readOnly}
                  disabled={f.readOnly}
                />
                {error ? (
                  <p className="mt-1 text-xs text-destructive">
                    {t(String(error.message ?? "transportOrders.form.invalid"))}
                  </p>
                ) : null}
              </div>
            )
          })}
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.reset(defaults as never)}
              disabled={disableActions}
            >
              {t("transportOrders.form.reset")}
            </Button>
            <Button type="submit" size="sm" disabled={disableActions}>
              {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {t("common:actions.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
