"use client"
import { TriangleAlert } from "lucide-react"
import { useDeskT } from "../i18n/client"
import { Icon } from "./icon"

/**
 * Ostatnia linia obrony reguły dowodu: zdanie modelu skonfrontowane z listą czynności.
 * Świadomie stoi POD odpowiedzią, a nie zamiast niej — nie ukrywamy tego, co napisał,
 * tylko dopisujemy to, czego nie zrobił.
 */
export function UnbackedPromises({
  names,
  request,
}: {
  names: string[]
  request: (name: string) => void
}) {
  const translate = useDeskT()
  if (!names.length) return null
  // Zdanie składa się w SŁOWNIKU, nie tutaj: polska odmiana („pada nazwa" / „padają nazwy",
  // „nie powstał" / „nie powstały") i angielska mnogość rozchodzą się w innych miejscach,
  // więc sklejanie kawałków w JSX-ie da się napisać tylko dla jednego języka naraz.
  return (
    <div className="max-w-desk-measure rounded-lg border border-desk-warn/40 bg-desk-warn-soft px-3.5 py-3">
      <div className="flex items-start gap-2">
        <Icon as={TriangleAlert} px={16} className="mt-0.5 shrink-0 text-desk-warn" />
        <div className="min-w-0">
          <p className="t-body-m">{translate("promises.title", { count: names.length })}</p>
          <p className="t-meta mt-0.5">
            {translate("promises.body", {
              count: names.length,
              names: names.join(", "),
            })}
          </p>
          <button
            onClick={() => names[0] && request(names[0])}
            className="t-btn mt-2 flex h-8 items-center rounded-md border border-desk-warn/40 bg-desk-surface px-2.5 hover:bg-desk-raised"
          >
            {translate("promises.askAgain")}
          </button>
        </div>
      </div>
    </div>
  )
}
