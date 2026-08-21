import type { ReactNode } from "react"
import "../packages/@cortex/styles/globals.css"

// Komponenty z `@cortex/ui` wołają `useTranslation("ui")`, więc instancja
// i18next musi wstać także tutaj — dokładnie z tego samego powodu, dla którego
// robi to `setupFiles` w `vitest.config.ts`. Właścicielem singletonu jest HOST
// (aplikacja, vitest, Ladle), nie pakiet: pakiet zna wyłącznie bibliotekę i
// nazwę przestrzeni, nigdy aplikacji. Bez tego importu stories pokazałyby
// surowe klucze zamiast napisów.
import "../app/idp/lib/i18n"

export const Provider = ({ children }: { children: ReactNode }) => <>{children}</>
