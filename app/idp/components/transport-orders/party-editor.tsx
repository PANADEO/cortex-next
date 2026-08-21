"use client"

import { countryCodeSchema, mapTrimToNull } from "@/lib/form-helpers"
import type { Party, UpdatePartyRequest } from "@cortex/types"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"

const schema = z.object({
  name: z.string().max(200),
  street: z.string().max(200),
  postal_code: z.string().max(20),
  city: z.string().max(100),
  country_code: countryCodeSchema,
  vat_id: z.string().max(50),
  eori: z.string().max(50),
  partner_id: z.string().max(50),
})

type FormValues = z.infer<typeof schema>

const FIELDS: readonly FieldSpec<FormValues>[] = [
  { name: "name", labelKey: "transportOrders.fields.name", span: 2 },
  { name: "street", labelKey: "transportOrders.fields.street", span: 2 },
  { name: "postal_code", labelKey: "transportOrders.fields.postalCode", span: 1 },
  { name: "city", labelKey: "transportOrders.fields.city", span: 1 },
  {
    name: "country_code",
    labelKey: "transportOrders.fields.countryCode",
    span: 1,
    uppercase: true,
  },
  { name: "vat_id", labelKey: "transportOrders.fields.vatId", span: 1 },
  { name: "eori", labelKey: "transportOrders.fields.eori", span: 1 },
  { name: "partner_id", labelKey: "transportOrders.fields.partnerId", span: 1 },
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
      resetKey={value?.id}
      onSave={(v) => onSave(mapTrimToNull(v))}
    />
  )
}
