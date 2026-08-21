"use client"

// Edytowalna lista tematów dla trybów "Kilka"/"Pakiet" (design doc §4.1) —
// wiersz per temat: tekst + checkbox aktywny + usuń, przycisk "Dodaj temat".
// Lokalny komponent w features/content-guru/ (nie @cortex/ui) — jeden
// konsument (page.tsx, wołany dwa razy dla dwóch trybów, ale to nadal JEDEN
// miejsce w kodzie, nie dwa niezależne narzędzia) — ekstrakcja do wspólnego
// dopiero przy 2. konsumencie SPOZA tego modułu (architecture_rules.md §3).
// "Generator tematów" (mini-generator wypełniający tabelę naraz) to Round D
// — poza zakresem, stąd brak tego przycisku tutaj.

import { Button, Checkbox, Input } from "@cortex/ui"
import { Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"

export interface TopicRow {
  id: string
  topic: string
  active: boolean
}

const TOPIC_MAX = 500

export function createEmptyTopicRow(): TopicRow {
  return { id: crypto.randomUUID(), topic: "", active: true }
}

interface TopicTableProps {
  rows: TopicRow[]
  onChange: (rows: TopicRow[]) => void
}

export function TopicTable({ rows, onChange }: TopicTableProps) {
  const { t } = useTranslation("content-guru")

  function updateRow(id: string, patch: Partial<TopicRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id))
  }

  function addRow() {
    onChange([...rows, createEmptyTopicRow()])
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-2">
          <Checkbox
            checked={row.active}
            onCheckedChange={(checked) => updateRow(row.id, { active: checked === true })}
            aria-label={t("topicTable.a11y.active", { index: index + 1 })}
          />
          <Input
            value={row.topic}
            maxLength={TOPIC_MAX}
            placeholder={t("topicTable.topicPlaceholder", { index: index + 1 })}
            onChange={(event) => updateRow(row.id, { topic: event.target.value })}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(row.id)}
            disabled={rows.length <= 1}
            aria-label={t("topicTable.a11y.remove", { index: index + 1 })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
        <Plus className="mr-2 h-4 w-4" />
        {t("topicTable.addButton")}
      </Button>
    </div>
  )
}
