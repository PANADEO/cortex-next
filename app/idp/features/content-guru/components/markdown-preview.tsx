"use client"

import { cn } from "@cortex/utils"
import ReactMarkdown, { type Components } from "react-markdown"

// Podgląd Markdown dla profili klienta/rynku (design doc §4.3) — kopia
// wzorca z app/idp/features/document-parser/components/markdown.tsx (code-
// service SKILL.md "Kiedy coś jest code-service, a kiedy nie": lokalna kopia
// per moduł jest normalna, ekstrakcja dopiero przy realnej duplikacji logiki
// biznesowej, nie stylowania). Podzbiór elementów — profile-markdown.ts
// generuje wyłącznie **pogrubione etykiety** + akapity, bez tabel/list/kodu,
// więc `remark-gfm` nie jest tu potrzebny.

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

export function ContentGuruMarkdownPreview({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}
