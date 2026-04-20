import type { Story } from "@ladle/react"
import { Inbox, Upload } from "lucide-react"
import { Button } from "./ui/button"
import { EmptyState } from "./empty-state"
import { ErrorState } from "./error-state"
import { LoadingState } from "./loading-state"

export default {
  title: "Domain / States",
}

export const Empty: Story = () => (
  <div className="p-6">
    <EmptyState
      icon={Inbox}
      title="No packages yet"
      description="Import your first invoice bundle to see it here."
      action={
        <Button size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Import package
        </Button>
      }
    />
  </div>
)

export const EmptyMinimal: Story = () => (
  <div className="p-6">
    <EmptyState title="No results match your filters." />
  </div>
)

export const LoadingSpinner: Story = () => (
  <div className="p-6">
    <LoadingState label="Loading packages…" />
  </div>
)

export const LoadingSkeleton: Story = () => (
  <div className="p-6">
    <LoadingState variant="skeleton" rows={5} />
  </div>
)

export const Error: Story = () => (
  <div className="p-6">
    <ErrorState
      title="Failed to load packages"
      message="The API returned 503. Check that the backend is reachable."
      onRetry={() => console.log("retry")}
    />
  </div>
)

export const ErrorMinimal: Story = () => (
  <div className="p-6">
    <ErrorState message="Network request timed out." />
  </div>
)
