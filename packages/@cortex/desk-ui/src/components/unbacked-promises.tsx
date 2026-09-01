"use client"
import { TriangleAlert } from "lucide-react"
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
  if (!names.length) return null
  const one = names.length === 1
  return (
    <div className="max-w-desk-measure rounded-lg border border-desk-warn/40 bg-desk-warn-soft px-3.5 py-3">
      <div className="flex items-start gap-2">
        <Icon as={TriangleAlert} px={16} className="mt-0.5 shrink-0 text-desk-warn" />
        <div className="min-w-0">
          <p className="t-body-m">{one ? "Ten plik nie powstał." : "Te pliki nie powstały."}</p>
          <p className="t-meta mt-0.5">
            W odpowiedzi {one ? "pada nazwa" : "padają nazwy"}{" "}
            {names.map((n, i) => (
              <span key={n}>
                {i > 0 && ", "}
                <span className="font-medium text-desk-ink">{n}</span>
              </span>
            ))}
            {one
              ? ", ale takiego pliku nie ma w teczce sprawy"
              : ", ale takich plików nie ma w teczce sprawy"}{" "}
            i nie powstał{one ? "" : "y"} w żadnej czynności. To lista tego, co faktycznie się
            wydarzyło — nie tego, co napisał asystent.
          </p>
          <button
            onClick={() => names[0] && request(names[0])}
            className="t-btn mt-2 flex h-8 items-center rounded-md border border-desk-warn/40 bg-desk-surface px-2.5 hover:bg-desk-raised"
          >
            Poproś jeszcze raz
          </button>
        </div>
      </div>
    </div>
  )
}
