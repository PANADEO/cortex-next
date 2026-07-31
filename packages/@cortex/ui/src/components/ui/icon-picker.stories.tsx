import type { Story } from "@ladle/react"
import { useState } from "react"
import { IconPicker } from "./icon-picker"

export default {
  title: "Primitives / IconPicker",
}

export const Interactive: Story = () => {
  const [value, setValue] = useState("Settings")
  return (
    <div className="max-w-xs p-6">
      <IconPicker value={value} onChange={setValue} />
      <p className="mt-3 text-xs text-muted-foreground">Wybrano: {value || "(brak)"}</p>
    </div>
  )
}

export const Empty: Story = () => {
  const [value, setValue] = useState("")
  return (
    <div className="max-w-xs p-6">
      <IconPicker value={value} onChange={setValue} />
    </div>
  )
}

export const UnknownValue: Story = () => {
  const [value, setValue] = useState("NieIstniejacaIkona")
  return (
    <div className="max-w-xs p-6">
      <IconPicker value={value} onChange={setValue} />
      <p className="mt-3 text-xs text-muted-foreground">
        Nazwa spoza katalogu — pokazuje fallback (LayoutDashboard).
      </p>
    </div>
  )
}

export const Disabled: Story = () => (
  <div className="max-w-xs p-6">
    <IconPicker value="Bot" onChange={() => {}} disabled />
  </div>
)
