import type { Story } from "@ladle/react"
import { PROCESSING_STATE, VERIFICATION_STATE } from "@cortex/types"
import {
  PackageStatusBadges,
  ProcessingStateBadge,
  VerificationStateBadge,
} from "./status-badge"

export default {
  title: "Domain / StatusBadge",
}

export const AllProcessingStates: Story = () => (
  <div className="flex flex-col gap-3 p-6">
    {PROCESSING_STATE.map((state) => (
      <div key={state} className="flex items-center gap-3">
        <code className="w-48 text-xs text-muted-foreground">{state}</code>
        <ProcessingStateBadge state={state} showIcon />
      </div>
    ))}
  </div>
)

export const AllVerificationStates: Story = () => (
  <div className="flex flex-col gap-3 p-6">
    {VERIFICATION_STATE.map((state) => (
      <div key={state} className="flex items-center gap-3">
        <code className="w-48 text-xs text-muted-foreground">{state}</code>
        <VerificationStateBadge state={state} showIcon />
      </div>
    ))}
  </div>
)

export const Sizes: Story = () => (
  <div className="flex flex-col gap-3 p-6">
    <div className="flex items-center gap-3">
      <ProcessingStateBadge state="ready" size="sm" showIcon />
      <ProcessingStateBadge state="ready" size="md" showIcon />
    </div>
    <div className="flex items-center gap-3">
      <VerificationStateBadge state="in_progress" size="sm" showIcon />
      <VerificationStateBadge state="in_progress" size="md" showIcon />
    </div>
  </div>
)

export const Composite: Story = () => (
  <div className="flex flex-col gap-4 p-6">
    <PackageStatusBadges
      processingState="analysing"
      verificationState="not_started"
      showIcon
    />
    <PackageStatusBadges
      processingState="ready"
      verificationState="not_started"
      showIcon
    />
    <PackageStatusBadges
      processingState="ready"
      verificationState="in_progress"
      showIcon
    />
    <PackageStatusBadges
      processingState="ready"
      verificationState="completed"
      showIcon
    />
    <PackageStatusBadges
      processingState="analysis_failed"
      verificationState="not_started"
      showIcon
    />
  </div>
)
