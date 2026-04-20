import type { Story } from "@ladle/react"
import { CheckCircle2, Clock, FileWarning, Inbox, Loader2 } from "lucide-react"
import { DataCard } from "./data-card"

export default {
  title: "Domain / DataCard",
}

export const DashboardGrid: Story = () => (
  <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
    <DataCard label="In queue" value={12} icon={Inbox} />
    <DataCard label="Processing" value={3} icon={Loader2} tone="info" />
    <DataCard label="Ready" value={47} icon={CheckCircle2} tone="success" />
    <DataCard label="Failed" value={2} icon={FileWarning} tone="destructive" />
  </div>
)

export const Tones: Story = () => (
  <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
    <DataCard label="Default" value={120} icon={Clock} />
    <DataCard label="Success" value={98} tone="success" icon={CheckCircle2} />
    <DataCard label="Warning" value={5} tone="warning" icon={FileWarning} />
    <DataCard label="Destructive" value={3} tone="destructive" icon={FileWarning} />
    <DataCard label="Info" value={17} tone="info" icon={Inbox} />
  </div>
)

export const WithDescription: Story = () => (
  <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
    <DataCard
      label="Verification rate"
      value="87%"
      description="Last 30 days"
      tone="success"
      icon={CheckCircle2}
    />
    <DataCard
      label="Avg time to verify"
      value="4m 12s"
      description="Across all operators"
      icon={Clock}
    />
  </div>
)

export const Loading: Story = () => (
  <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
    <DataCard label="In queue" value={0} icon={Inbox} isLoading />
    <DataCard label="Processing" value={0} icon={Loader2} isLoading />
    <DataCard label="Ready" value={0} icon={CheckCircle2} isLoading />
  </div>
)
