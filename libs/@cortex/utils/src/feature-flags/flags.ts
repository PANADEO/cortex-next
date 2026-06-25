import type { FeatureFlagsResponse } from "@cortex/types"

/**
 * Logical feature-flag identifiers used at call-sites.
 *
 * Naming: `<tile>.<feature>` for tile-scoped flags (e.g. `idp.classification`),
 * `cortex.<area>` for platform-wide flags. New flag = add literal here +
 * entries in DEFAULTS and BACKEND_FIELD; TypeScript enforces both.
 */
export type FeatureFlag =
  | "idp.classification"
  | "idp.customs-code"
  | "idp.atr-processing"
  | "idp.additional-ai-context"
  | "idp.import-email-notifications"

/** Defaults used when a backend does not expose a newer flag yet. */
export const DEFAULTS: Record<FeatureFlag, boolean> = {
  "idp.classification": false,
  "idp.customs-code": false,
  "idp.atr-processing": false,
  "idp.additional-ai-context": false,
  "idp.import-email-notifications": true,
} as const satisfies Record<FeatureFlag, boolean>

/** Maps logical flag → snake_case field on `GET /config` response. */
export const BACKEND_FIELD: Record<FeatureFlag, keyof FeatureFlagsResponse> = {
  "idp.classification": "enable_classification",
  "idp.customs-code": "enable_customs_code",
  "idp.atr-processing": "enable_atr_processing",
  "idp.additional-ai-context": "enable_additional_ai_context",
  "idp.import-email-notifications": "enable_import_email_notifications",
} as const
