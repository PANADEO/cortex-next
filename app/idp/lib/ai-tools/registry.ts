import type { LucideIcon } from "lucide-react"
import {
  Bot,
  FileText,
  Highlighter,
  MessageSquareText,
  Presentation,
  ReceiptText,
  Sparkles,
  TextCursorInput,
  Wand2,
} from "lucide-react"
import { AI_TOOLS_TILE_ID, type AiToolId } from "./app-codes"

export {
  AI_TOOL_APP_CODES,
  AI_TOOLS_TILE_ID,
  canAccessAiTool,
  hasAnyAiToolAccess,
  isAiToolId,
} from "./app-codes"

export type AiToolCategory = "Tekst" | "Treści" | "Dokumenty" | "Asystenci"

export interface AiToolDefinition {
  id: AiToolId
  label: string
  shortLabel: string
  description: string
  category: AiToolCategory
  icon: LucideIcon
  scope: string
  isFeatured?: boolean
  supportsFiles?: boolean
  maxTokens?: number
}

export const AI_TOOL_DEFINITIONS: readonly AiToolDefinition[] = [
  {
    id: "text-highlighter",
    label: "Podświetlacz tekstu",
    shortLabel: "Podświetlacz",
    description: "Wyróżnia konkretne fragmenty według celu analizy i zwraca uzasadnienie.",
    category: "Tekst",
    icon: Highlighter,
    scope: "text-highlighter",
    isFeatured: true,
  },
  {
    id: "text-transformer",
    label: "Transformator tekstu",
    shortLabel: "Transformator",
    description: "Przepisuje tekst pod odbiorcę, ton, poziom trudności i konkretny cel.",
    category: "Tekst",
    icon: Wand2,
    scope: "text-transformer",
    isFeatured: true,
  },
  {
    id: "text-analyzer",
    label: "Analizator tekstu",
    shortLabel: "Analizator",
    description: "Diagnozuje sentyment, styl, strukturę, czytelność, tematy i słowa kluczowe.",
    category: "Tekst",
    icon: TextCursorInput,
    scope: "text-analyzer",
  },
  {
    id: "ai-summarizer",
    label: "Sumaryzator",
    shortLabel: "Sumaryzator",
    description: "Tworzy streszczenia operacyjne, listy punktów, FAQ i wersje dla odbiorców.",
    category: "Tekst",
    icon: FileText,
    scope: "summarizer",
    isFeatured: true,
  },
  {
    id: "content-guru",
    label: "Kreator treści",
    shortLabel: "Kreator treści",
    description: "Generuje robocze treści marketingowe, produktowe, rekrutacyjne i PR.",
    category: "Treści",
    icon: Sparkles,
    scope: "content-creator",
    maxTokens: 8000,
  },
  {
    id: "linkedin-generator",
    label: "Generator LinkedIn",
    shortLabel: "LinkedIn",
    description: "Buduje posty LinkedIn z hookiem, strukturą, CTA i wariantami tonu.",
    category: "Treści",
    icon: MessageSquareText,
    scope: "linkedin-generator",
  },
  {
    id: "visual-guru",
    label: "Generator prezentacji",
    shortLabel: "Prezentacje",
    description: "Projektuje strukturę prezentacji i slajdy gotowe do eksportu jako HTML.",
    category: "Treści",
    icon: Presentation,
    scope: "presentation-generator",
    maxTokens: 12000,
  },
  {
    id: "fakturomat",
    label: "Analizator faktur",
    shortLabel: "Faktury",
    description: "Czyta faktury ze zdjęć i zwraca dane, ryzyka formalne oraz raport kontrolny.",
    category: "Dokumenty",
    icon: ReceiptText,
    scope: "invoice-analyzer",
    supportsFiles: true,
    maxTokens: 12000,
  },
  {
    id: "ai-daily-assistant",
    label: "Chatbot AI",
    shortLabel: "Chatbot",
    description: "Krótki asystent roboczy do szybkich pytań i redakcji odpowiedzi.",
    category: "Asystenci",
    icon: Bot,
    scope: "chatbot",
  },
]

export const AI_TOOL_CATEGORIES: readonly AiToolCategory[] = [
  "Tekst",
  "Treści",
  "Dokumenty",
  "Asystenci",
]

export function getAiToolDefinition(id: string): AiToolDefinition | undefined {
  return AI_TOOL_DEFINITIONS.find((tool) => tool.id === id)
}

export function getVisibleAiTools(apps: readonly string[]): AiToolDefinition[] {
  if (apps.includes(AI_TOOLS_TILE_ID)) return [...AI_TOOL_DEFINITIONS]
  return AI_TOOL_DEFINITIONS.filter((tool) => apps.includes(tool.id))
}
