"use client"

import i18n from "@/lib/i18n"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { useEffect } from "react"

/**
 * Stosuje ZAPISANY wybór języka na każdej trasie i utrzymuje `<html lang>`.
 *
 * Powód istnienia jest konkretny, nie porządkowy. `locale-store` sam w sobie
 * przywraca język — robi to w `onRehydrateStorage`. Ale store jest modułem,
 * więc rehydracja odpala się dopiero wtedy, gdy ktoś ten moduł zaimportuje,
 * a importowała go WYŁĄCZNIE stopka i kilka widoków. Stopka żyje w `(shell)`,
 * czyli na hubie. Wchodząc wprost na kafelek pod `(main)` — z zakładki, z
 * linku, po odświeżeniu — nikt store'u nie ładował i i18next zostawał na
 * języku domyślnym. Objaw był mylący, bo przejście na ten sam ekran KLIKNIĘCIEM
 * z huba działało poprawnie: store był już wtedy w pamięci karty.
 *
 * Dlatego wybór stosuje warstwa providerów, obecna na każdej trasie, a nie
 * widok, który akurat store'u używa.
 *
 * `<html lang>` był zaszyty na `"en"` w `app/idp/app/layout.tsx` i nic go nie
 * zmieniało, więc dokument deklarował angielski także przy polskim interfejsie
 * — czytnik ekranu czytał polskie zdania angielską fonetyką. Atrybut nadajemy
 * po stronie klienta, bo tylko tam znamy wybór użytkownika; serwer renderuje
 * język domyślny i nie ma jak zgadnąć.
 */
export function LocaleProvider() {
  const locale = useLocaleStore((s) => s.locale)

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale)
    document.documentElement.lang = locale
  }, [locale])

  return null
}
