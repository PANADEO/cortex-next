import type { Story } from "@ladle/react"
import { Download, Plus, RefreshCw } from "lucide-react"
import { PageHeader } from "./page-header"
import { Button } from "./ui/button"

export default {
  title: "Domain / PageHeader",
}

export const TitleOnly: Story = () => <PageHeader title="Dashboard" />

export const WithDescription: Story = () => (
  <PageHeader
    title="Packages"
    description="Imported invoice bundles waiting for analysis and verification."
  />
)

export const WithActions: Story = () => (
  <PageHeader
    title="Packages"
    description="Imported invoice bundles waiting for analysis and verification."
    actions={
      <>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New package
        </Button>
      </>
    }
  />
)
