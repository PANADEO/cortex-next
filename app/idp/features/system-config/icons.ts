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
import dynamic from "next/dynamic"

// Jawna, ręcznie wypisana lista NAZWANYCH importów — świadomie NIE
// `import * as Icons`. `next.config.ts` (`experimental.optimizePackageImports:
// ["lucide-react", "date-fns"]`) przepisuje nazwane importy na tanie,
// per-ikonę deep-importy; nie potrafi tego zrobić dla namespace/wildcard
// importu, bo nie da się statycznie ustalić, których właściwości on w ogóle
// użyje. Namespace-import w tym miejscu psuł tree-shaking `lucide-react` DLA
// CAŁEJ APLIKACJI — First Load JS KAŻDEJ trasy (nie tylko ekranów /system-config/applications)
// urósł o ~183-187 kB, bo cały katalog 1731 ikon lądował w chunku wspólnym
// dla root layoutu. Odkryte przez review 31.07.2026 realnym pomiarem
// `next build`. Lista niżej pokrywa WSZYSTKIE nazwy ikon dziś REACHABLE —
// faktycznie używane jako `applications.icon` (seed-system-config.mjs,
// seed-token-usage.mjs, seed-ilustromat.mjs) i jako `icon:` kafelków w
// `lib/tiles.ts`/`ai-tools/registry.ts` — rośnie tylko wtedy, gdy faktycznie
// dochodzi nowa ikona w jednym z tych miejsc. Renderuje się SYNCHRONICZNIE,
// zero opóźnienia — to jest hot path każdego renderu huba.
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

// Krok 4 (PROJECT/cortex-frontend-hub-db-driven-projekt.md): `IconPicker`
// (@cortex/ui) oferuje CAŁY katalog lucide-react (~3472 ikon) z wyszukiwarką
// — świadomy wybór wcześniej w tej sesji, niezależny od listy `ICONS` wyżej.
// Admin może więc zapisać w `applications.icon` dowolną nazwę spoza tej
// listy (dla KAŻDEGO `kind` — pole ikony w formularzu Aplikacja nie jest
// warunkowane typem aplikacji). Rozwiązanie NIE jest ani (a) ręcznie
// dopisywaną listą, ani (b) listą generowaną build-time z dzisiejszych
// wartości — obie te opcje z natury nie obejmują ikony, którą admin wybierze
// PO DEPLOYU, bez nowego builda (dokładnie ten przypadek jest zgłoszonym
// bugiem: wybór "Rocket" w pickerze zapisuje się poprawnie, ale renderuje
// jako fallback wszędzie poza samym pickerem). Zamiast tego: leniwe
// dociągnięcie POJEDYNCZEJ, konkretnej ikony z pełnego katalogu, WYŁĄCZNIE
// gdy nazwa nie jest w statycznej liście wyżej — reużywa dokładnie ten sam,
// już zweryfikowany mechanizm izolacji co `IconPicker` (osobny moduł,
// `@cortex/ui/components/ui/icon-catalog`, importowany WYŁĄCZNIE przez
// `next/dynamic()`, nigdy statycznie z góry pliku) — zero wpływu na First
// Load JS tras, które tego nie potrzebują (zweryfikowane realnym
// `next build`, patrz raport Kroku 4).
const DYNAMIC_ICON_CACHE = new Map<string, LucideIcon>()

function resolveDynamicIcon(name: string): LucideIcon {
  const cached = DYNAMIC_ICON_CACHE.get(name)
  if (cached) return cached

  // Cache PRZED przypisaniem: kolejne wywołania dla tej samej nazwy (kolejne
  // kafelki na hubie, kolejne wiersze na liście Aplikacje) muszą dostać TEN
  // SAM komponent — inaczej każdy render tworzyłby nowy `dynamic()`, co
  // React traktowałby jako inny typ komponentu (remount + migotanie).
  const Icon = dynamic(
    () =>
      import("@cortex/ui/components/ui/icon-catalog").then((mod) => ({
        default: mod.lookupLucideIcon(name) ?? LayoutDashboard,
      })),
    { ssr: false, loading: () => null },
  ) as unknown as LucideIcon

  DYNAMIC_ICON_CACHE.set(name, Icon)
  return Icon
}

/** `applications.icon` (nazwa z lucide-react) → komponent, z fallbackiem dla
 *  pustej/nieznanej nazwy (literówka, legacy wpis w bazie). Nazwy spoza
 *  statycznej listy `ICONS` (Krok 4) dociągają się leniwie z pełnego
 *  katalogu zamiast cicho spadać na fallback. */
export function resolveApplicationIcon(name: string | null | undefined): LucideIcon {
  if (!name) return LayoutDashboard
  const known = ICONS[name]
  if (known) return known
  return resolveDynamicIcon(name)
}
