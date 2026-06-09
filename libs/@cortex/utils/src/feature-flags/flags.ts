import type { FeatureFlagsResponse } from "@cortex/types"

/**
 * Logical feature-flag identifiers used at call-sites.
 *
 * Naming: `<tile>.<feature>` for tile-scoped flags (e.g. `idp.classification`),
 * `cortex.<area>` for platform-wide flags. New flag = add literal here +
 * entries in DEFAULTS and BACKEND_FIELD; TypeScript enforces both.
 */
export type FeatureFlag = "idp.classification" | "idp.customs-code" | "idp.atr-processing"

/** Safe-by-default: every flag is `false` unless backend opts it in. */
export const DEFAULTS: Record<FeatureFlag, boolean> = {
  "idp.classification": false,
  "idp.customs-code": false,
  "idp.atr-processing": false,
} as const satisfies Record<FeatureFlag, boolean>

/** Maps logical flag → snake_case field on `GET /config` response. */
export const BACKEND_FIELD: Record<FeatureFlag, keyof FeatureFlagsResponse> = {
  "idp.classification": "enable_classification",
  "idp.customs-code": "enable_customs_code",
  "idp.atr-processing": "enable_atr_processing",
} as const
