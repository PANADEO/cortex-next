"use client"

import type { TabsVariant } from "@/lib/presets/registry"
import { cn } from "@cortex/utils"
import { cva } from "class-variance-authority"
import { Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { CategoryTab } from "./types"

/**
 * Warstwa 2 (D3): zakładki kategorii w dwóch wyglądach. `underline` to pasek
 * z podkreśleniem aktywnej pozycji, `folder` to teczki Notesa wtapiające się w
 * górną krawędź panelu — ten sam DOM, inna tabela klas.
 *
 * Przed E4 były to dwa komponenty, bo ich markup „nie pokrywał się ani jednym
 * elementem". To była prawda o markupie, nie o zakładkach: różnicę robiły
 * opakowanie listy, separator i liczniki przy kategoriach, czyli trzy węzły —
 * reszta była tym samym przyciskiem w innych kolorach.
 *
 * O chudych bazach `cva` i kolejności tokenów: patrz `tile-card.tsx`. Ta sama
 * bramka, ten sam powód.
 */
const slots = {
  nav: cva("", {
    variants: {
      variant: { underline: "mb-8 border-b border-border", folder: "pr-2" },
    },
  }),
  list: cva("flex flex-wrap", {
    variants: {
      variant: { underline: "items-center gap-0.5", folder: "gap-1" },
    },
  }),
  button: cva("", {
    variants: {
      variant: {
        underline: "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        // `-mb-0.5` (czyli minus grubość ramki pod Dominem) wsuwa zakładkę pod
        // górną krawędź panelu, a `border-b-transparent` na aktywnej wycina w
        // tej krawędzi dziurę — stąd wrażenie teczki otwartej na panel.
        folder:
          "-mb-0.5 inline-flex items-center gap-1.5 rounded-t-sm border-token border-border px-3 py-1.5 text-xs font-semibold transition-[color,background-color,transform] motion-reduce:transition-none",
      },
      active: { true: "", false: "" },
    },
    compoundVariants: [
      { variant: "underline", active: true, class: "border-cortex text-foreground" },
      {
        variant: "underline",
        active: false,
        class: "border-transparent text-muted-foreground hover:text-foreground",
      },
      {
        variant: "folder",
        active: true,
        class: "relative z-[1] border-b-transparent bg-chart-1 text-chart-1-foreground",
      },
      {
        variant: "folder",
        active: false,
        class: "bg-muted text-muted-foreground hover:-translate-y-0.5 hover:text-foreground",
      },
    ],
  }),
  favInner: cva("flex items-center", {
    variants: { variant: { underline: "gap-1", folder: "gap-1.5" } },
  }),
  star: cva("", {
    variants: { variant: { underline: "h-3.5 w-3.5", folder: "h-3 w-3" } },
  }),
  count: cva("", {
    variants: {
      variant: {
        underline: "text-xs tabular-nums text-muted-foreground",
        folder: "font-mono text-[11px] opacity-75",
      },
    },
  }),
} as const

/**
 * Cztery różnice, których NIE da się wyrazić klasą, bo dotyczą węzłów i
 * atrybutów, nie wyglądu. Jedna tabela zamiast czterech `variant === …`
 * rozsypanych po pliku: trzeci wariant zakładek dopisuje się wtedy w dwóch
 * miejscach, a nie w sześciu.
 *
 * `navLabel` jest tu ZNALEZISKIEM, nie decyzją projektową: `underline` renderuje
 * landmark `<nav>` bez nazwy dostępnej, co jest drobnym defektem a11y sprzed
 * tego etapu. Dopisanie etykiety zmienia DOM presetów `neutral` i `customs`,
 * których E4 z założenia nie rusza, więc poprawka należy do osobnej zmiany —
 * zapisana tutaj, żeby nie zginęła.
 */
const SHAPE: Readonly<
  Record<
    TabsVariant,
    {
      navLabelKey: string | undefined
      /** Kreska między zakładkami syntetycznymi a kategoriami; `folder` jej nie ma. */
      separator: string | undefined
      /** Czy zakładka kategorii pokazuje własny licznik. */
      categoryCounts: boolean
      /** Odstęp przed licznikiem w zakładce „Wszystkie". `underline` robi go
       *  marginesem, bo ta jedna zakładka nie ma opakowania z `gap` — to
       *  niekonsekwencja zastana, nie wprowadzona. */
      countLead: string | undefined
    }
  >
> = {
  underline: {
    navLabelKey: undefined,
    separator: "mx-1 h-4 w-px bg-border",
    categoryCounts: false,
    countLead: "ml-1",
  },
  folder: {
    navLabelKey: "hub.categoriesNavLabel",
    separator: undefined,
    categoryCounts: true,
    countLead: undefined,
  },
}

interface CategoryTabsProps {
  totalCount: number
  favoritesCount: number
  // `readonly`, bo lista przychodzi z HubModel, który celowo oddaje kolekcje
  // tylko do odczytu — komponent i tak jej nie modyfikuje.
  categories: readonly CategoryTab[]
  activeId: string
  onSelect: (id: string) => void
  variant: TabsVariant
}

export function CategoryTabs({
  totalCount,
  favoritesCount,
  categories,
  activeId,
  onSelect,
  variant,
}: CategoryTabsProps) {
  const { t } = useTranslation("shell")
  const isActive = (id: string) => id === activeId
  const shape = SHAPE[variant]
  return (
    <nav
      className={slots.nav({ variant })}
      aria-label={shape.navLabelKey ? t(shape.navLabelKey) : undefined}
    >
      <div className={slots.list({ variant })}>
        <TabButton
          variant={variant}
          isActive={isActive("all")}
          onClick={() => onSelect("all")}
          aria-label={t("hub.allTabLabel")}
        >
          {t("hub.allTab")}{" "}
          <span className={cn(shape.countLead, slots.count({ variant }))}>{totalCount}</span>
        </TabButton>
        <TabButton
          variant={variant}
          isActive={isActive("favorites")}
          onClick={() => onSelect("favorites")}
          aria-label={t("hub.favoritesTabLabel")}
        >
          <span className={slots.favInner({ variant })}>
            <Star className={slots.star({ variant })} />
            {t("hub.favoritesTab")}{" "}
            <span className={slots.count({ variant })}>{favoritesCount}</span>
          </span>
        </TabButton>
        {shape.separator && categories.length > 0 ? (
          <span className={shape.separator} aria-hidden />
        ) : null}
        {categories.map((cat) => (
          <TabButton
            key={cat.id}
            variant={variant}
            isActive={isActive(cat.id)}
            onClick={() => onSelect(cat.id)}
          >
            {cat.label}
            {shape.categoryCounts ? (
              <>
                {" "}
                <span className={slots.count({ variant })}>{cat.count}</span>
              </>
            ) : null}
          </TabButton>
        ))}
      </div>
    </nav>
  )
}

interface TabButtonProps {
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
  variant: TabsVariant
  "aria-label"?: string
}

function TabButton({ isActive, onClick, children, variant, ...rest }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={slots.button({ variant, active: isActive })}
      {...rest}
    >
      {children}
    </button>
  )
}
