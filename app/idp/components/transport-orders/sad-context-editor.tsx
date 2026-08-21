"use client"

import type {
  SadAttachedDocument,
  SadContext,
  SadPreviousDocument,
  TransportOrder,
  UpdateSadContextRequest,
} from "@cortex/types"
import { Button, Card, CardContent, Input, Label, Textarea } from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Fragment, useEffect, useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

/** `t` wędruje parametrem tam, gdzie kod nie jest komponentem. */
type Translate = ReturnType<typeof useTranslation>["t"]

const textField = z.string().max(255)

const schema = z.object({
  hs_decl_type: textField,
  _type: textField,
  decl_code1: textField,
  decl_code2: textField,
  decl_code3: textField,
  sub_type: textField,
  trans_type: textField,
  proc_code: textField,
  representation_type: textField,
  decl_customs_off_no: textField,
  border_office: textField,
  decl_date: textField,
  currency: textField,
  internal_currency_unit: textField,
  issued_by_name: textField,
  issued_by_place: textField,
  issued_by_position: textField,
  issued_by_phone: textField,
  transp_disp_arr_mode: textField,
  transp_bord_mode: textField,
  transp_bord_ctry: textField,
  transp_disp_arr_marks: textField,
  transport_doc_no: textField,
  invoice_doc_type: textField,
  taric_default: textField,
  add_codes_nat: textField,
  total_pack: textField,
  agent_name: textField,
  agent_street: textField,
  agent_city: textField,
  agent_postal_code: textField,
  agent_country_code: textField,
  agent_eori: textField,
  agent_tin: textField,
  agent_regon: textField,
  agent_type_of_person: textField,
  previous_documents: z.string(),
  attached_documents: z.string(),
})

type FormValues = z.infer<typeof schema>
type FieldName = keyof FormValues

/** Niesie KLUCZ i nazwę pola — napis powstaje dopiero w komponencie. */
class JsonListError extends Error {
  constructor(
    readonly messageKey: string,
    readonly label: string,
  ) {
    super(`${label}: ${messageKey}`)
  }
}

interface FieldSpec {
  name: FieldName
  /** Nazwa pola formatu SAD/Huzar — identyfikator, nie tłumaczy się. */
  label?: string
  /** Klucz przestrzeni `idp` dla etykiet pisanych prozą. */
  labelKey?: string
  uppercase?: boolean
}

function fieldLabel(t: Translate, field: FieldSpec): string {
  return field.labelKey ? t(field.labelKey) : (field.label ?? String(field.name))
}

const DECLARATION_FIELDS: readonly FieldSpec[] = [
  { name: "hs_decl_type", label: "HSDeclType" },
  { name: "_type", label: "_Type" },
  { name: "decl_code1", label: "DeclCode1", uppercase: true },
  { name: "decl_code2", label: "DeclCode2", uppercase: true },
  { name: "decl_code3", label: "DeclCode3", uppercase: true },
  { name: "sub_type", label: "SubType" },
  { name: "trans_type", label: "TransType" },
  { name: "proc_code", label: "ProcCode" },
  { name: "representation_type", label: "RepresentationType" },
  { name: "decl_customs_off_no", label: "DeclCustomsOffNo", uppercase: true },
  { name: "border_office", label: "BorderOffice", uppercase: true },
  { name: "decl_date", label: "DeclDate" },
  { name: "currency", label: "Currency", uppercase: true },
  { name: "internal_currency_unit", label: "InternalCurrencyUnit", uppercase: true },
]

const TRANSPORT_FIELDS: readonly FieldSpec[] = [
  { name: "transp_disp_arr_mode", label: "TranspDispArrMode" },
  { name: "transp_bord_mode", label: "TranspBordMode" },
  { name: "transp_bord_ctry", label: "TranspBordCtry", uppercase: true },
  { name: "transp_disp_arr_marks", label: "TranspDispArrMarks" },
  { name: "transport_doc_no", label: "TransportDocNo" },
]

const ISSUER_FIELDS: readonly FieldSpec[] = [
  { name: "issued_by_name", label: "IssuedByName" },
  { name: "issued_by_place", label: "IssuedByPlace" },
  { name: "issued_by_position", label: "IssuedByPosition" },
  { name: "issued_by_phone", label: "IssuedByPhone" },
]

// Etykiety prozą idą przez `labelKey`; nazwy pól formatu SAD/Huzar
// (`EORI`, `TIN`, `REGON`, `TypeOfPerson`) zostają, bo to identyfikatory
// schematu, nie tekst interfejsu.
const AGENT_FIELDS: readonly FieldSpec[] = [
  { name: "agent_name", labelKey: "transportOrders.fields.name" },
  { name: "agent_street", labelKey: "transportOrders.fields.street" },
  { name: "agent_city", labelKey: "transportOrders.fields.city" },
  { name: "agent_postal_code", labelKey: "transportOrders.fields.postalCode" },
  { name: "agent_country_code", labelKey: "transportOrders.fields.countryCode", uppercase: true },
  { name: "agent_eori", label: "EORI" },
  { name: "agent_tin", label: "TIN" },
  { name: "agent_regon", label: "REGON" },
  { name: "agent_type_of_person", label: "TypeOfPerson" },
]

const DEFAULT_FIELDS: readonly FieldSpec[] = [
  { name: "invoice_doc_type", label: "InvoiceDocType" },
  { name: "taric_default", label: "TaricDefault" },
  { name: "add_codes_nat", label: "AddCodesNat" },
  { name: "total_pack", label: "TotalPack" },
]

function text(value: string | null | undefined): string {
  return value ?? ""
}

function trimToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function listText(value: unknown): string {
  return Array.isArray(value) ? JSON.stringify(value, null, 2) : ""
}

function parseDocumentObjects(value: string, label: string): Record<string, unknown>[] | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = JSON.parse(trimmed) as unknown
  if (!Array.isArray(parsed)) {
    throw new JsonListError("transportOrders.sad.mustBeJsonList", label)
  }
  if (!parsed.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
    throw new JsonListError("transportOrders.sad.itemsMustBeObjects", label)
  }
  return parsed as Record<string, unknown>[]
}

function objectString(value: unknown): string | null {
  return typeof value === "string" ? trimToNull(value) : null
}

function parsePreviousDocuments(value: string): SadPreviousDocument[] | null {
  const objects = parseDocumentObjects(value, "PreviousDocuments")
  if (!objects) return null
  return objects.map((item) => ({
    doc_type: objectString(item.doc_type),
    doc_code: objectString(item.doc_code),
    doc_additional_code: objectString(item.doc_additional_code),
    doc_no: objectString(item.doc_no),
    doc_date: objectString(item.doc_date),
  }))
}

function parseAttachedDocuments(value: string): SadAttachedDocument[] | null {
  const objects = parseDocumentObjects(value, "AttachedDocuments")
  if (!objects) return null
  return objects.map((item) => ({
    document_type: objectString(item.document_type),
    document_no: objectString(item.document_no),
    document_date: objectString(item.document_date),
    remarks: objectString(item.remarks),
  }))
}

function toDefaults(context: SadContext | null): FormValues {
  const header = context?.header ?? null
  const transport = context?.transport ?? null
  const documents = context?.documents ?? null
  const defaults = context?.defaults ?? null
  const packages = defaults?.packages ?? null
  const agent = context?.agent_party ?? null

  return {
    hs_decl_type: text(header?.hs_decl_type),
    _type: text(header?._type),
    decl_code1: text(header?.decl_code1),
    decl_code2: text(header?.decl_code2),
    decl_code3: text(header?.decl_code3),
    sub_type: text(header?.sub_type),
    trans_type: text(header?.trans_type),
    proc_code: text(header?.proc_code),
    representation_type: text(header?.representation_type),
    decl_customs_off_no: text(header?.decl_customs_off_no),
    border_office: text(header?.border_office),
    decl_date: text(header?.decl_date),
    currency: text(header?.currency),
    internal_currency_unit: text(header?.internal_currency_unit),
    issued_by_name: text(header?.issued_by_name),
    issued_by_place: text(header?.issued_by_place),
    issued_by_position: text(header?.issued_by_position),
    issued_by_phone: text(header?.issued_by_phone),
    transp_disp_arr_mode: text(transport?.transp_disp_arr_mode),
    transp_bord_mode: text(transport?.transp_bord_mode),
    transp_bord_ctry: text(transport?.transp_bord_ctry),
    transp_disp_arr_marks: text(transport?.transp_disp_arr_marks),
    transport_doc_no: text(transport?.transport_doc_no),
    invoice_doc_type: text(documents?.invoice_doc_type),
    taric_default: text(defaults?.taric_default),
    add_codes_nat: Array.isArray(defaults?.add_codes_nat) ? defaults.add_codes_nat.join(", ") : "",
    total_pack: text(packages?.total_pack),
    agent_name: text(agent?.name),
    agent_street: text(agent?.street),
    agent_city: text(agent?.city),
    agent_postal_code: text(agent?.postal_code),
    agent_country_code: text(agent?.country_code),
    agent_eori: text(agent?.eori),
    agent_tin: text(agent?.tin),
    agent_regon: text(agent?.regon),
    agent_type_of_person: text(agent?.type_of_person),
    previous_documents: listText(documents?.previous_documents),
    attached_documents: listText(documents?.attached_documents),
  }
}

function toRequest(values: FormValues): UpdateSadContextRequest {
  const previousDocuments = parsePreviousDocuments(values.previous_documents)
  const attachedDocuments = parseAttachedDocuments(values.attached_documents)
  const addCodesNat = values.add_codes_nat
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)

  return {
    sad_context: {
      header: {
        hs_decl_type: trimToNull(values.hs_decl_type),
        _type: trimToNull(values._type),
        decl_code1: trimToNull(values.decl_code1),
        decl_code2: trimToNull(values.decl_code2),
        decl_code3: trimToNull(values.decl_code3),
        sub_type: trimToNull(values.sub_type),
        trans_type: trimToNull(values.trans_type),
        proc_code: trimToNull(values.proc_code),
        representation_type: trimToNull(values.representation_type),
        decl_customs_off_no: trimToNull(values.decl_customs_off_no),
        border_office: trimToNull(values.border_office),
        decl_date: trimToNull(values.decl_date),
        currency: trimToNull(values.currency),
        internal_currency_unit: trimToNull(values.internal_currency_unit),
        issued_by_name: trimToNull(values.issued_by_name),
        issued_by_place: trimToNull(values.issued_by_place),
        issued_by_position: trimToNull(values.issued_by_position),
        issued_by_phone: trimToNull(values.issued_by_phone),
      },
      transport: {
        transp_disp_arr_mode: trimToNull(values.transp_disp_arr_mode),
        transp_bord_mode: trimToNull(values.transp_bord_mode),
        transp_bord_ctry: trimToNull(values.transp_bord_ctry),
        transp_disp_arr_marks: trimToNull(values.transp_disp_arr_marks),
        transport_doc_no: trimToNull(values.transport_doc_no),
      },
      documents: {
        invoice_doc_type: trimToNull(values.invoice_doc_type),
        previous_documents: previousDocuments,
        attached_documents: attachedDocuments,
      },
      defaults: {
        taric_default: trimToNull(values.taric_default),
        add_codes_nat: addCodesNat.length > 0 ? addCodesNat : null,
        packages: { total_pack: trimToNull(values.total_pack) },
      },
      agent_party: {
        name: trimToNull(values.agent_name),
        street: trimToNull(values.agent_street),
        city: trimToNull(values.agent_city),
        postal_code: trimToNull(values.agent_postal_code),
        country_code: trimToNull(values.agent_country_code),
        eori: trimToNull(values.agent_eori),
        tin: trimToNull(values.agent_tin),
        regon: trimToNull(values.agent_regon),
        type_of_person: trimToNull(values.agent_type_of_person),
      },
    },
  }
}

interface Props {
  order: TransportOrder
  canEdit: boolean
  isSaving?: boolean | undefined
  onSave: (body: UpdateSadContextRequest) => Promise<void>
}

export function SadContextEditor({ order, canEdit, isSaving = false, onSave }: Props) {
  const { t } = useTranslation(["idp", "common"])
  const idPrefix = useId()
  const [jsonError, setJsonError] = useState<string | null>(null)
  const defaults = toDefaults(order.sad_context)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  useEffect(() => {
    form.reset(defaults)
    // Intentionally tied to order identity; polling refetches should not clobber local typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, form])

  const submit = form.handleSubmit(async (values) => {
    setJsonError(null)
    try {
      const request = toRequest(values)
      await onSave(request)
      form.reset(values)
    } catch (err) {
      if (err instanceof JsonListError) {
        setJsonError(t(err.messageKey, { label: err.label }))
        return
      }
      if (err instanceof SyntaxError) {
        setJsonError(t("transportOrders.sad.invalidJson", { detail: err.message }))
        return
      }
      throw err
    }
  })

  const dirtyFields = form.formState.dirtyFields as Record<string, boolean | undefined>
  const isDirty = Object.values(dirtyFields).some(Boolean)
  const disableActions = !isDirty || isSaving

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="text-sm font-semibold">SAD / Huzar</h3>
        <form onSubmit={submit} className="space-y-5">
          <FieldGroup
            title={t("transportOrders.sad.declaration")}
            fields={DECLARATION_FIELDS}
            form={form}
            idPrefix={idPrefix}
            canEdit={canEdit}
          />
          <FieldGroup
            title={t("transportOrders.sad.transport")}
            fields={TRANSPORT_FIELDS}
            form={form}
            idPrefix={idPrefix}
            canEdit={canEdit}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldGroup
              title={t("transportOrders.sad.field54")}
              fields={ISSUER_FIELDS}
              form={form}
              idPrefix={idPrefix}
              canEdit={canEdit}
            />
            <FieldGroup
              title={t("transportOrders.sad.agent")}
              fields={AGENT_FIELDS}
              form={form}
              idPrefix={idPrefix}
              canEdit={canEdit}
            />
          </div>
          <FieldGroup
            title={t("transportOrders.sad.defaults")}
            fields={DEFAULT_FIELDS}
            form={form}
            idPrefix={idPrefix}
            canEdit={canEdit}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <JsonTextarea
              label="PreviousDocuments"
              name="previous_documents"
              form={form}
              idPrefix={idPrefix}
              canEdit={canEdit}
            />
            <JsonTextarea
              label="AttachedDocuments"
              name="attached_documents"
              form={form}
              idPrefix={idPrefix}
              canEdit={canEdit}
            />
          </div>
          {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
          {canEdit ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.reset(defaults)}
                disabled={disableActions}
              >
                {t("transportOrders.form.reset")}
              </Button>
              <Button type="submit" size="sm" disabled={disableActions}>
                {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {t("common:actions.save")}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

interface FieldGroupProps {
  title: string
  fields: readonly FieldSpec[]
  form: ReturnType<typeof useForm<FormValues>>
  idPrefix: string
  canEdit: boolean
}

function FieldGroup({ title, fields, form, idPrefix, canEdit }: FieldGroupProps) {
  const { t } = useTranslation("idp")
  if (!canEdit) {
    return (
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm md:grid-cols-[10rem_1fr_10rem_1fr]">
          {fields.map((field) => (
            <Fragment key={field.name}>
              <dt className="text-muted-foreground">{fieldLabel(t, field)}</dt>
              <dd className="truncate font-mono text-xs">{form.getValues(field.name) || "—"}</dd>
            </Fragment>
          ))}
        </dl>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => {
          const fieldId = `${idPrefix}-${field.name}`
          const error = form.formState.errors[field.name]
          return (
            <div key={field.name}>
              <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
                {fieldLabel(t, field)}
              </Label>
              <Input
                id={fieldId}
                {...form.register(field.name, {
                  setValueAs: (value: unknown) =>
                    typeof value === "string" && field.uppercase ? value.toUpperCase() : value,
                })}
                className="mt-1"
                aria-invalid={Boolean(error)}
              />
              {error ? (
                <p className="mt-1 text-xs text-destructive">
                  {t(String(error.message ?? "transportOrders.form.invalid"))}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

interface JsonTextareaProps {
  label: string
  name: "previous_documents" | "attached_documents"
  form: ReturnType<typeof useForm<FormValues>>
  idPrefix: string
  canEdit: boolean
}

function JsonTextarea({ label, name, form, idPrefix, canEdit }: JsonTextareaProps) {
  const fieldId = `${idPrefix}-${name}`

  return (
    <div>
      <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Textarea
        id={fieldId}
        {...form.register(name)}
        className="mt-1 min-h-28 font-mono text-xs"
        readOnly={!canEdit}
        disabled={!canEdit}
      />
    </div>
  )
}
