import type { Story } from "@ladle/react"
import { useState } from "react"
import { Combobox } from "./combobox"

const CATEGORIES = ["Dokumenty", "Finanse", "Badania", "Administracja", "Agenci", "AI Tools", "Uprawnienia"]

export default {
  title: "Primitives / Combobox",
}

export const Interactive: Story = () => {
  const [value, setValue] = useState("Finanse")
  return (
    <div className="max-w-xs p-6">
      <Combobox value={value} onChange={setValue} options={CATEGORIES} />
      <p className="mt-3 text-xs text-muted-foreground">Wybrano: {value || "(brak)"}</p>
    </div>
  )
}

export const Empty: Story = () => {
  const [value, setValue] = useState("")
  return (
    <div className="max-w-xs p-6">
      <Combobox value={value} onChange={setValue} options={CATEGORIES} placeholder="np. Administracja" />
    </div>
  )
}

export const CustomValueAlreadySet: Story = () => {
  const [value, setValue] = useState("Kategoria niestandardowa")
  return (
    <div className="max-w-xs p-6">
      <Combobox value={value} onChange={setValue} options={CATEGORIES} />
      <p className="mt-3 text-xs text-muted-foreground">
        Wartość spoza listy opcji (wpisana wcześniej ręcznie) — wciąż wyświetlana wprost.
      </p>
    </div>
  )
}

export const Disabled: Story = () => (
  <div className="max-w-xs p-6">
    <Combobox value="Finanse" onChange={() => {}} options={CATEGORIES} disabled />
  </div>
)
