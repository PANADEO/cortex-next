import {
  BarChart3,
  Bot,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  Highlighter,
  Image,
  LayoutDashboard,
  MessageSquareText,
  Presentation,
  Receipt,
  ReceiptText,
  ScanText,
  Settings,
  ShieldCheck,
  Sparkles,
  TextCursorInput,
  Users,
  Video,
  Wand2,
  Workflow,
  type LucideIcon,
} from "lucide-react"

// Jawna, ręcznie wypisana lista NAZWANYCH importów — świadomie NIE
// `import * as Icons`. `next.config.ts` (`experimental.optimizePackageImports:
// ["lucide-react", "date-fns"]`) przepisuje nazwane importy na tanie,
// per-ikonę deep-importy; nie potrafi tego zrobić dla namespace/wildcard
// importu, bo nie da się statycznie ustalić, których właściwości on w ogóle
// użyje. Namespace-import w tym miejscu psuł tree-shaking `lucide-react` DLA
// CAŁEJ APLIKACJI — First Load JS KAŻDEJ trasy (nie tylko ekranów Aplikacje)
// urósł o ~183-187 kB, bo cały katalog 1731 ikon lądował w chunku wspólnym
// dla root layoutu. Odkryte przez review 31.07.2026 realnym pomiarem
// `next build`. Lista niżej pokrywa WSZYSTKIE nazwy ikon dziś używane jako
// `applications.icon` (seed-system-config.mjs, seed-token-usage.mjs,
// seed-ilustromat.mjs) i jako `icon:` kafelków w `lib/tiles.ts` — rośnie
// tylko wtedy, gdy faktycznie dochodzi nowa ikona w jednym z tych miejsc.
// NIE zamieniać z powrotem na `import * as Icons` — to dokładnie ta zmiana,
// która wprowadziła regresję.
const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  Bot,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  Highlighter,
  Image,
  MessageSquareText,
  Presentation,
  Receipt,
  ReceiptText,
  ScanText,
  Settings,
  ShieldCheck,
  Sparkles,
  TextCursorInput,
  Users,
  Video,
  Wand2,
  Workflow,
}

/** `applications.icon` (nazwa z lucide-react) → komponent, z fallbackiem dla
 *  pustej/nieznanej nazwy (literówka, legacy wpis w bazie). */
export function resolveApplicationIcon(name: string | null | undefined): LucideIcon {
  if (!name) return LayoutDashboard
  return ICONS[name] ?? LayoutDashboard
}
