"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Card, CardContent, Input, Label } from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { Fragment, useEffect, useId } from "react"
import { useForm, type Path } from "react-hook-form"
import type { ZodType } from "zod"

export interface FieldSpec<T> {
  name: Path<T>
  label: string
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
  onSave: (values: T) => Promise<void>
}

export function FieldsForm<T extends Record<string, string>>({
  label,
  fields,
  defaults,
  schema,
  canEdit,
  isSaving = false,
  onSave,
}: Props<T>) {
  const idPrefix = useId()
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaults as never,
  })

  useEffect(() => {
    form.reset(defaults as never)
  }, [defaults, form])

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">{label}</h3>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            {fields.map((f) => (
              <Fragment key={String(f.name)}>
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="truncate font-mono text-xs">
                  {defaults[f.name as keyof T] || "—"}
                </dd>
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
              <div
                key={String(f.name)}
                className={f.span === 2 ? "md:col-span-2" : undefined}
              >
                <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
                  {f.label}
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
                    {String(error.message ?? "Invalid")}
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
              Reset
            </Button>
            <Button type="submit" size="sm" disabled={disableActions}>
              {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
