import type { Story } from "@ladle/react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "./button"

export default {
  title: "Primitives / Button",
}

export const Variants: Story = () => (
  <div className="flex flex-wrap items-center gap-3 p-6">
    <Button>Default</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Link</Button>
    <Button variant="destructive">Destructive</Button>
  </div>
)

export const Sizes: Story = () => (
  <div className="flex flex-wrap items-center gap-3 p-6">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add">
      <Plus className="h-4 w-4" />
    </Button>
  </div>
)

export const WithIcons: Story = () => (
  <div className="flex flex-wrap items-center gap-3 p-6">
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      New package
    </Button>
    <Button variant="destructive">
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </Button>
    <Button disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing
    </Button>
  </div>
)

export const Disabled: Story = () => (
  <div className="flex flex-wrap items-center gap-3 p-6">
    <Button disabled>Default</Button>
    <Button variant="outline" disabled>
      Outline
    </Button>
    <Button variant="destructive" disabled>
      Destructive
    </Button>
  </div>
)
