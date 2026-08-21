import type { TFunction } from "i18next"

/**
 * Krótka nazwa narzędzia AI — ta z menu bocznego i z okruszka.
 *
 * NIE jest daną instancji: administrator nigdzie jej nie edytuje, to czysto
 * kodowy skrót prezentacyjny kafelka AI Tools. Dlatego mieszka w przestrzeni
 * `ai-tools`, razem z resztą tekstu tego kafelka, a NIE w `tiles` — tam
 * właścicielem nazwy jest baza i obowiązuje odwrotna reguła pierwszeństwa
 * (patrz `tile-names.ts`).
 *
 * Zapasem zostaje rejestr, więc narzędzie dołożone w kodzie bez wpisu
 * w tłumaczeniach pokaże swoją polską nazwę zamiast surowego klucza. Klucz
 * jest tu SKLEJANY z identyfikatora, czyli niewidoczny dla bramki
 * `keys-exist` — kompletności pilnuje osobno `ai-tool-names.test.ts`.
 */
export function aiToolShortLabel(
  t: TFunction<"ai-tools">,
  id: string,
  fromRegistry: string,
): string {
  return t(`shortLabels.${id}`, { defaultValue: "" }) || fromRegistry
}
