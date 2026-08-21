"use client"

import { cva } from "class-variance-authority"
import { Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { LOCALES, type Locale } from "@/lib/i18n/config"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { usePreset } from "@/lib/presets/preset-store"
import pkg from "../../../../package.json"
import { SHELL_VERSION, stripLeadingV } from "./version-label"

const APP_VERSION = stripLeadingV(SHELL_VERSION === "dev" ? pkg.version : SHELL_VERSION)

interface Diagnostics {
  time: string
  resolution: string
  online: boolean
}

/** Browser-only diagnostics; null until mounted so SSR markup stays stable. */
function useDiagnostics(): Diagnostics | null {
  const [diag, setDiag] = useState<Diagnostics | null>(null)

  useEffect(() => {
    function read(): Diagnostics {
      return {
        time: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
        resolution: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
      }
    }
    const update = () => setDiag(read())
    update()
    const clock = setInterval(update, 15_000)
    window.addEventListener("resize", update)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      clearInterval(clock)
      window.removeEventListener("resize", update)
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  return diag
}

/**
 * Stopka ekranu startowego i huba — odpowiednik `.ch-shellfoot` z oryginału.
 * Wariant zmienia grubość linii, rolę tła i typografię; wartości kolorów
 * zostają tokenami.
 *
 * KOREKTA WCZEŚNIEJSZEGO ZAPISU. Komentarz w tym miejscu twierdził, że
 * monospace „nie było w oryginale" i dlatego go nie przenoszę. To była
 * nieprawda — `.ch-shellfoot` miał `font-family: IBM Plex Mono`,
 * `letter-spacing: 0.08em` i `text-transform: uppercase`. Wszystkie trzy są
 * teraz przeniesione. Twierdzenie o cudzym projekcie, którego nikt nie
 * sprawdził, jest gorsze niż brak komentarza; wychwycił to dopiero przegląd.
 */
const shellFoot = cva("border-border backdrop-blur", {
  variants: {
    variant: {
      plain: "border-t bg-card/60",
      ruled: "border-t-2 bg-sidebar/60",
    },
  },
  defaultVariants: { variant: "plain" },
})

const footText = cva(
  "mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-3 text-[11px]",
  {
    variants: {
      variant: {
        plain: "text-muted-foreground",
        ruled: "font-mono uppercase tracking-[0.08em] text-sidebar-foreground",
      },
    },
    defaultVariants: { variant: "plain" },
  },
)

export function ShellFooter() {
  const diag = useDiagnostics()
  const variant = usePreset().variants.shell
  const { t } = useTranslation("common")
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  // Stylowanie tokenami, NIE klasą zakresowaną do `.cortex-home` (D5: powłoka
  // zostaje na warstwie 1). Ta stopka renderuje się w DWÓCH miejscach — pod
  // hubem i w `landing-hero.tsx`, gdzie `.cortex-home` nie istnieje — więc
  // stylowanie zakresowane do jednego wyglądu znaczyłoby stopkę bez ramki i tła
  // na ekranie logowania.
  return (
    <footer className={shellFoot({ variant })}>
      <div className={footText({ variant })}>
        <div>Cortex360 © {new Date().getFullYear()}</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>{t("footer.version")}: {APP_VERSION}</span>
          <span>{t("footer.time")}: {diag?.time ?? "—"}</span>
          <span>{t("footer.resolution")}: {diag?.resolution ?? "—"}</span>
          {/* Przełącznik języka stoi W STOPCE, bo tak prosił Cezary i tak było
              w `cortex-box-prototype` — na dole ekranu kafelków. Natywny
              `<select>`, nie `Select` z Radiksa: ta stopka renderuje się także
              na ekranie logowania, gdzie nie ma dostawców portalowych, a
              element ma 13 pikseli wysokości i jedno zadanie. */}
          <span className="flex items-center gap-1.5">
            <Globe size={13} aria-hidden="true" />
            <label htmlFor="locale" className="sr-only">
              {t("language.label")}
            </label>
            <select
              id="locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="cursor-pointer border-none bg-transparent text-[11px] text-inherit outline-none focus-visible:underline"
            >
              {LOCALES.map((value) => (
                <option key={value} value={value}>
                  {t(`language.${value}`)}
                </option>
              ))}
            </select>
          </span>
          <span>
            {t("footer.online")}: {diag ? (diag.online ? t("footer.yes") : t("footer.no")) : "—"}
          </span>
        </div>
      </div>
    </footer>
  )
}
