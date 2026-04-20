import type { Story } from "@ladle/react"
import { useState } from "react"
import { ThemeToggle, type ThemeMode } from "./theme-toggle"

export default {
  title: "Domain / ThemeToggle",
}

export const Interactive: Story = () => {
  const [mode, setMode] = useState<ThemeMode>("system")
  return (
    <div className="flex items-center gap-4 p-6">
      <ThemeToggle mode={mode} onModeChange={setMode} />
      <code className="text-sm text-muted-foreground">mode: {mode}</code>
    </div>
  )
}
