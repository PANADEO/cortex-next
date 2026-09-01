"use client"
import { TriangleAlert } from "lucide-react"
import { Ikona } from "./ikona"

/**
 * Ostatnia linia obrony reguły dowodu: zdanie modelu skonfrontowane z listą czynności.
 * Świadomie stoi POD odpowiedzią, a nie zamiast niej — nie ukrywamy tego, co napisał,
 * tylko dopisujemy to, czego nie zrobił.
 */
export function BezPokrycia({
  nazwy,
  popros,
}: {
  nazwy: string[]
  popros: (nazwa: string) => void
}) {
  if (!nazwy.length) return null
  const jeden = nazwy.length === 1
  return (
    <div className="max-w-miara rounded-lg border border-warn/40 bg-warn-soft px-3.5 py-3">
      <div className="flex items-start gap-2">
        <Ikona jako={TriangleAlert} px={16} klasa="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0">
          <p className="t-tresc-m">{jeden ? "Ten plik nie powstał." : "Te pliki nie powstały."}</p>
          <p className="t-meta mt-0.5">
            W odpowiedzi {jeden ? "pada nazwa" : "padają nazwy"}{" "}
            {nazwy.map((n, i) => (
              <span key={n}>
                {i > 0 && ", "}
                <span className="font-medium text-ink">{n}</span>
              </span>
            ))}
            {jeden
              ? ", ale takiego pliku nie ma w teczce sprawy"
              : ", ale takich plików nie ma w teczce sprawy"}{" "}
            i nie powstał{jeden ? "" : "y"} w żadnej czynności. To lista tego, co faktycznie się
            wydarzyło — nie tego, co napisał asystent.
          </p>
          <button
            onClick={() => nazwy[0] && popros(nazwy[0])}
            className="t-btn mt-2 flex h-8 items-center rounded-md border border-warn/40 bg-surface px-2.5 hover:bg-raised"
          >
            Poproś jeszcze raz
          </button>
        </div>
      </div>
    </div>
  )
}
