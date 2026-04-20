"use client"

import type { Party, UpdatePartyRequest } from "@cortex/types"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"

const schema = z.object({
  name: z.string().max(200),
  street: z.string().max(200),
  postal_code: z.string().max(20),
  city: z.string().max(100),
  country_code: z
    .string()
    .max(3)
    .regex(/^[A-Za-z]{0,3}$/, "ISO country code"),
  vat_id: z.string().max(50),
  eori: z.string().max(50),
  partner_id: z.string().max(50),
})

type FormValues = z.infer<typeof schema>

const FIELDS: readonly FieldSpec<FormValues>[] = [
  { name: "name", label: "Name", span: 2 },
  { name: "street", label: "Street", span: 2 },
  { name: "postal_code", label: "Postal code", span: 1 },
  { name: "city", label: "City", span: 1 },
  { name: "country_code", label: "Country code", span: 1, uppercase: true },
  { name: "vat_id", label: "VAT ID", span: 1 },
  { name: "eori", label: "EORI", span: 1 },
  { name: "partner_id", label: "Partner ID", span: 1 },
]

function toDefaults(party: Party | null): FormValues {
  return {
    name: party?.name ?? "",
    street: party?.street ?? "",
    postal_code: party?.postal_code ?? "",
    city: party?.city ?? "",
    country_code: party?.country_code ?? "",
    vat_id: party?.vat_id ?? "",
    eori: party?.eori ?? "",
    partner_id: party?.partner_id ?? "",
  }
}

function toRequest(values: FormValues): UpdatePartyRequest {
  const entries = Object.entries(values).map(([k, v]) => [k, v.trim() ? v.trim() : null])
  return Object.fromEntries(entries) as UpdatePartyRequest
}

interface Props {
  label: string
  value: Party | null
  canEdit: boolean
  isSaving?: boolean | undefined
  onSave: (body: UpdatePartyRequest) => Promise<void>
}

export function PartyEditor({ label, value, canEdit, isSaving, onSave }: Props) {
  return (
    <FieldsForm
      label={label}
      fields={FIELDS}
      defaults={toDefaults(value)}
      schema={schema}
      canEdit={canEdit}
      isSaving={isSaving}
      onSave={(v) => onSave(toRequest(v))}
    />
  )
}
