import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * ZAKAZ TEKSTU W KODZIE — egzekwowany maszynowo, nie dyscypliną.
 *
 * Cel postawiony przez Alexa brzmi „nigdzie nie może być plain textu". Bez
 * tego testu jest to postanowienie, a nie własność: napis dopisany w pośpiechu
 * nie odróżnia się od reszty niczym, co dałoby się zobaczyć na przeglądzie.
 *
 * SKANUJE ŹRÓDŁO, NIE RENDER, i to jest istotne — render pokrywa wyłącznie
 * ekrany, które ktoś zamontował w teście, a napis w rzadkiej gałęzi błędu
 * przechodzi wtedy niezauważony.
 *
 * Komentarze są WYCINANE przed sprawdzeniem. Zostają po polsku świadomie: są
 * dla nas, nie dla użytkownika, a wymuszanie na nich angielskiego kosztowałoby
 * dokładność opisu decyzji projektowych.
 *
 * Teksty JSX łamane na WIELE LINII są objęte tak samo jak jednolinijkowe —
 * pierwsza wersja ekstraktora liczyła tylko jedną linię i przez to przeoczyła
 * cztery akapity na samym ekranie logowania. To jest ta klasa błędu, przed
 * którą ten test ma bronić, więc nie może jej powielać.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/

/**
 * Katalogi jeszcze niezmigrowane. Lista ma DĄŻYĆ DO ZERA — pusta znaczy, że
 * cel jest osiągnięty i ten mechanizm wyjątków można skasować razem z nią.
 * Dopisanie się tutaj jest świadomą decyzją, nie sposobem na zielony test.
 */
const NOT_MIGRATED_YET: string[] = [
  "app/idp/app/(main)/",
  "app/idp/components/ai-tools/",
  "app/idp/components/invoice-supervisor/",
  "app/idp/components/idp-basic/",
  "app/idp/components/transport-orders/",
  "app/idp/components/export-menu.tsx",
  "app/idp/features/",
  "app/idp/lib/",
  "packages/",
]

/** Nazwy własne i identyfikatory, które zostają nietknięte w każdym języku. */
const ALLOWED = [/Cortex360/, /OpenWebUI/, /LinkedIn/, /Intrastat/, /Store-Pit/]

function stripNonUi(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "") // komentarze blokowe i JSDoc
    .replace(/^\s*\/\/.*$/gm, "") // komentarze liniowe
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // komentarze w JSX
    .replace(/import[\s\S]*?from\s*"[^"]*"/g, "") // ścieżki importów
}

/** Napisy widoczne dla użytkownika: literały, atrybuty i tekst JSX — ten
 *  ostatni także wtedy, gdy formatter połamał go na kilka linii. */
function userFacingStrings(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(/"([^"\n]{2,200})"|'([^'\n]{2,200})'/g)) {
    found.push((match[1] ?? match[2] ?? "").trim())
  }
  for (const match of source.matchAll(/>([^<>{}]{2,400}?)</g)) {
    found.push((match[1] ?? "").replace(/\s+/g, " ").trim())
  }
  return found
}

/** Bez biblioteki glob — `readdirSync({recursive})` wystarcza, a każda
 *  zależność dołożona dla jednego skanu to zależność do utrzymania. */
const SKIP = ["node_modules", ".next", "mocks"]

function listTsx(root: string): string[] {
  return readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => file.endsWith(".tsx"))
    .filter((file) => !file.endsWith(".test.tsx") && !file.endsWith(".stories.tsx"))
    .filter((file) => !SKIP.some((part) => file.includes(`/${part}/`)))
    .filter((file) => !NOT_MIGRATED_YET.some((prefix) => file.startsWith(prefix)))
}

const files = [...listTsx("app"), ...listTsx("packages")]

describe("zakaz tekstu w kodzie", () => {
  it("skan obejmuje realny zbiór plików, a nie pusty", () => {
    // Bez tej asercji zaostrzenie globa albo literówka w `ignore` dałaby
    // triumfalnie zielony test, który nie sprawdza niczego.
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)("%s nie zawiera napisu po polsku", (relative) => {
    const source = stripNonUi(readFileSync(path.join(repoRoot, relative), "utf8"))
    const offenders = userFacingStrings(source).filter(
      (value) => POLISH.test(value) && !ALLOWED.some((allowed) => allowed.test(value)),
    )

    expect({ [relative]: offenders }).toEqual({ [relative]: [] })
  })
})
