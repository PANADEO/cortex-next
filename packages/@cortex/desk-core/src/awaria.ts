/**
 * Awaria mówi prawdę: po polsku, z powodem — i NIGDY nie produkuje pliku.
 *
 * Czysty moduł, bez zależności od runtime'u, żeby dało się go sprawdzić testem
 * bez stawiania modelu i bazy.
 */

/**
 * Adres z panelu dostawcy nie ma czego szukać na ekranie pracownika.
 * Prawdziwy komunikat, który tu trafił, brzmiał: „To increase, visit
 * https://openrouter.ai/workspaces/default/keys/327df36…" — czyli nazwa dostawcy,
 * którego pani Basia nie zna, i identyfikator klucza, którego nie powinna widzieć.
 */
const bezAdresow = (s: string) =>
  s.replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,.:;]+$/, '').trim()

export function czytelnyBlad(e: unknown): string {
  const s = String((e as { message?: unknown })?.message ?? e)

  if (/401|unauthor|api key/i.test(s)) return 'Brak ważnego klucza do modelu — zgłoś to administratorowi.'
  if (/timeout|ETIMEDOUT|aborted/i.test(s)) return 'Model nie odpowiedział na czas. Spróbuj ponownie za chwilę.'
  if (/ECONNREFUSED|fetch failed/i.test(s)) return 'Nie udało się połączyć z usługą modelu. Sprawdź, czy cortex-proxy działa.'
  if (/rate limit|429/i.test(s)) return 'Przekroczony limit zapytań u dostawcy modelu. Spróbuj za minutę.'
  // Rozróżnienie jest istotne: „skończył się budżet" brzmi jak dzienny limit z „Co potrafię",
  // a to zupełnie inna rzecz i inna osoba ją odblokowuje.
  if (/credit|quota|insufficient|billing|payment|afford/i.test(s))
    return 'Skończyły się środki na modele po stronie firmy — zgłoś to administratorowi. To nie jest Twój dzienny limit.'

  return `Nie udało się dokończyć: ${bezAdresow(s).slice(0, 160)}`
}
