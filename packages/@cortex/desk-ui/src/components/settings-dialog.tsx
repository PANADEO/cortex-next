"use client"
import * as Dialog from "@radix-ui/react-dialog"
import { Check, X } from "lucide-react"
import { useState } from "react"
import { useDeskAppearance, useDeskLocale, useDeskT, useSetDeskLocale } from "../i18n/client"
import { DESK_LOCALES, DESK_LOCALE_NAMES } from "../i18n/locale"
import { Icon } from "./icon"

/**
 * USTAWIENIA W OKNIE, WIDOCZNE ZAWSZE — i to drugie jest tu ważniejsze niż pierwsze.
 *
 * DLACZEGO POWSTAŁO. Język i wygląd mieszkały w rozwijanym menu osoby na dole paska
 * bocznego, razem z przełączaniem osób. Trzy różne rzeczy pod jedną strzałką w dół to
 * element bez pierwowzoru w Outlooku ani w banku — a przede wszystkim menu było JEDYNĄ
 * drogą do języka, i to drogą, która u klienta na telefonie NIE ISTNIEJE:
 *
 *     szerokość ≥768 px          telefon <768 px
 *     pasek boczny: jest         pasek boczny: SCHOWANY (`md:flex`)
 *       └ język ✔                  └ język niedostępny
 *     ekran „Ja": —              ekran „Ja": jest
 *       └ ustawienia: pod `switchable`, a `identity()` zwraca tam FAŁSZ
 *         wszędzie tam, gdzie tożsamość daje brama logowania — czyli u KAŻDEGO klienta
 *
 * Wychodziło z tego, że pracownica z telefonem nie mogła zmienić języka w ogóle. Dlatego
 * to okno stoi BEZWARUNKOWO, a `switchable` rządzi wyłącznie przełączaniem osób, które
 * jest funkcją pokazu, a nie ustawieniem.
 *
 * SEKCJA „KOLORY" BYWA NIEOBECNA i to nie jest usterka: `useDeskAppearance()` czyta
 * kontekst wystawiany przez powłokę, a samodzielne Biurko (`apps/desk`) go nie ma.
 * Wtedy okno pokazuje sam język — jeden rząd zamiast dwóch.
 */
export function SettingsDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const translate = useDeskT()
  const locale = useDeskLocale()
  const setLocale = useSetDeskLocale()
  const appearance = useDeskAppearance()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-desk-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-desk-surface shadow-desk-window">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Dialog.Title className="t-h3 flex-1">{translate("settings.title")}</Dialog.Title>
            <Dialog.Close
              aria-label={translate("settings.close")}
              className="grid h-7 w-7 place-items-center rounded-md text-desk-muted hover:bg-desk-raised/70 hover:text-desk-ink"
            >
              <Icon as={X} px={16} />
            </Dialog.Close>
          </div>

          <div className="p-4">
            <div className="t-section pb-2">{translate("settings.language")}</div>
            <div className="flex flex-wrap gap-2">
              {DESK_LOCALES.map((code) => (
                <Choice
                  key={code}
                  label={DESK_LOCALE_NAMES[code]}
                  chosen={code === locale}
                  pick={() => setLocale(code)}
                />
              ))}
            </div>

            {appearance && (
              <>
                <div className="t-section pb-2 pt-5">{translate("settings.appearance")}</div>
                <div className="flex flex-wrap gap-2">
                  {appearance.choices.map((choice) => (
                    <Choice
                      key={choice.id}
                      label={choice.label}
                      chosen={choice.id === appearance.current}
                      pick={() => appearance.set(choice.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Zdanie, którego brak kosztował najwięcej pytań: człowiek nieprzyzwyczajony
                do ustawień szuka „Zapisz" i nie klika, dopóki go nie znajdzie. */}
            <p className="t-meta pt-5">{translate("settings.appliesAtOnce")}</p>
          </div>

          <div className="flex justify-end border-t px-4 py-3">
            <Dialog.Close className="t-btn h-9 rounded-md bg-desk-accent px-5 text-desk-accent-ink hover:bg-desk-accent-hover">
              {translate("settings.done")}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Wybór jako PRZYCISK Z PODPISEM, nie pozycja menu z ptaszkiem po prawej. Widać wszystkie
 * możliwości naraz i widać, która jest włączona — bez rozwijania i bez pamiętania.
 */
function Choice({ label, chosen, pick }: { label: string; chosen: boolean; pick: () => void }) {
  return (
    <button
      type="button"
      onClick={pick}
      aria-pressed={chosen}
      className={`t-body flex h-9 items-center gap-1.5 rounded-md border px-3 ${
        chosen
          ? "border-desk-accent-soft-line bg-desk-accent-soft text-desk-accent-soft-ink"
          : "hover:bg-desk-raised/70"
      }`}
    >
      {chosen && <Icon as={Check} px={14} />}
      {label}
    </button>
  )
}
