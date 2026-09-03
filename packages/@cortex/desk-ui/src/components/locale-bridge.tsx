"use client"
import { useShellLocaleBridge } from "../i18n/client"

/**
 * MOST JĘZYKA WISI NA POWŁOCE, NIE NA MENU OSOBY.
 *
 * DLACZEGO ISTNIEJE. `useShellLocaleBridge()` synchronizuje język Biurka z powłoką:
 * gdy ktoś przestawi język w katalogu aplikacji, Biurko ma go dogonić przy wejściu.
 * Do 03.09.2026 hak miał w całym repo JEDNO wywołanie i siedział w `persona-switcher.tsx`
 * — czyli w komponencie, który akurat stał na każdym ekranie. To był zbieg okoliczności,
 * a nie decyzja: przy przebudowie paska bocznego menu osoby przestaje istnieć, a razem
 * z nim zniknąłby most na WSZYSTKICH ekranach poza „Ja".
 *
 * Zniknąłby po cichu. Nic by nie pękło, żaden test by nie spadł — po prostu powłoka
 * zostałaby w poprzednim języku, a Biurko w swoim, i nikt by nie wiedział dlaczego.
 * Stąd osobny komponent bez wyglądu: most ma własne miejsce zamieszkania i widać,
 * że go montujemy.
 */
export function LocaleBridge() {
  useShellLocaleBridge()
  return null
}
