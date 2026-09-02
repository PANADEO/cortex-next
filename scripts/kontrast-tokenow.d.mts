/**
 * Deklaracje typów dla `kontrast-tokenow.mjs`.
 *
 * DLACZEGO OSOBNY PLIK, a nie skrypt napisany od razu w TypeScripcie: skrypt ma być
 * uruchamialny wprost (`node scripts/kontrast-tokenow.mjs`) na każdym Node, jaki stoi
 * w tym repozytorium i w obrazie `node:22-alpine`. Wersja `.ts` wymagałaby albo
 * zdejmowania typów przez Node (jest dopiero od 22.18), albo dołożenia narzędzia —
 * jedno i drugie po to, żeby test mógł zaimportować listę par. Ten plik kosztuje
 * dwadzieścia linii i nie kosztuje nic w czasie działania.
 */

/** Skórka razem z motywem — zbiór klas, jaki naprawdę siada na `<html>`. */
export type Skin = { readonly name: string; readonly classes: readonly string[] }

/** `text` → próg WCAG 1.4.3 (4,5:1); `control` → próg 1.4.11 (3:1). */
export type Role = "text" | "control"

/** Pary poniżej progu, na które jest zgoda — jedyne źródło, importowane też przez e2e. */
export declare const KNOWN_BELOW: readonly string[]

/** Para „kolor treści na swoim tle”, wyrażona kluczami ról z `tailwind.config.ts`. */
export type Pair = {
  readonly ink: string
  readonly ground: string
  readonly role: Role
  readonly why: string
}

export type Reading = {
  readonly skin: string
  readonly pair: Pair
  readonly ratio: number
  readonly floor: number
  readonly passes: boolean
}

export declare const STYLESHEETS: readonly string[]
export declare const SKINS: readonly Skin[]
export declare const PAIRS: readonly Pair[]
export declare const FLOORS: Readonly<Record<Role, number>>

export declare const label: (pair: Pair) => string
export declare function deskColors(): Map<string, string>
export declare function environment(classes: readonly string[]): Map<string, string>
export declare function origins(
  token: string,
  classes: readonly string[],
): { file: string; selector: string; value: string | undefined }[]
export declare function color(expression: string, values: Map<string, string>): number[]
export declare function contrast(one: readonly number[], other: readonly number[]): number
export declare function skinClasses(): string[]
export declare function measure(): Reading[]
