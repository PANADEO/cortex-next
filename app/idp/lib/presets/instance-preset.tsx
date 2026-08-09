"use client"

import { createContext, useContext, type ReactNode } from "react"

/**
 * Preset narzucony instancji, podany PROPSEM Z SERWERA (`app/idp/app/layout.tsx`
 * → `AppProviders`), a nie pobrany zapytaniem.
 *
 * TO JEST CAŁY MECHANIZM „PRESET PRZED PIERWSZYM RENDEREM" (§5e). Wartość
 * przechodzi przez granicę RSC razem z HTML-em, więc jest w pamięci klienta
 * ZANIM React wykona pierwszy render — dokładnie tak samo, jak wybór
 * użytkownika, który `persist` zustanda czyta z `localStorage` synchronicznie.
 * Dzięki temu `usePreset()` zwraca ostateczną odpowiedź od razu i hub nie ma
 * jak wyrenderować najpierw jednego layoutu, a po chwili drugiego.
 *
 * ODRZUCONE ZAPYTANIE (`useQuery` do `/api/system-config/appearance`).
 * Rozwiązanie oczywiste i błędne: preset instancji byłby wtedy nieznany w
 * pierwszym renderze, więc `resolvePresetId()` oddawałoby `DEFAULT_PRESET`, a
 * hub — który czeka na WŁASNE zapytanie o katalog — pojawiłby się jako
 * `classic` i przeskoczył na `masthead`, gdyby jego zapytanie wróciło
 * pierwsze. Kto wygra ten wyścig, zależy od sieci i obciążenia procesora, więc
 * „zwykle się nie zdarza" jest tu jedyną możliwą gwarancją. Pełna PODMIANA
 * UKŁADU po pojawieniu się treści to nieporównanie więcej niż mignięcie
 * kolorów, którego E4 świadomie odmówił opłacać w CSS-ie.
 *
 * ODRZUCONE CIASTECZKO z presetem instancji. Serwer i tak musi tę wartość
 * znać, żeby wstawić klasę skinu do `<html>`, a wtedy ciasteczko jest kopią
 * prawdy w miejscu, w którym prawda już jest — z własnym cyklem życia
 * (nieświeże po zmianie ustawienia, puste przy pierwszej wizycie, kasowalne
 * przez użytkownika). Odczyt z bazy w layoucie jest zawsze świeży i poprawny
 * już przy pierwszym wejściu.
 *
 * NOWA POWIERZCHNIA MIGNIĘCIA — zapis, nie przeoczenie. Dla użytkownika, który
 * ma WŁASNY wybór różny od presetu instancji (lokalnie `neutral`, instancja
 * `domino`), `<html>` niesie `skin-domino` od pierwszego bajtu, a efekt w
 * `theme-provider.tsx` zdejmuje tę klasę dopiero po hydratacji. Układ się przy
 * tym NIE zmienia — `usePreset()` zna oba źródła synchronicznie, więc hub
 * renderuje `classic` za pierwszym razem (zmierzone: 30/30 plus 5/5 dla tego
 * właśnie przypadku). Zmienia się sama paleta, i to jest populacja, która
 * przed E5 dostawała neutralną od pierwszego bajtu.
 *
 * Mieści się w polityce przyjętej świadomie w E4 („mignięcie kolorów tak,
 * mignięcie układu nie"), ale wtedy nie istniała, więc musi być zapisana.
 * Zmierzone na buildzie produkcyjnym (`next start`), 5 przebiegów na wariant,
 * moment zdjęcia klasy wobec pierwszego malowania z treścią:
 *
 *   bez dławienia, zimny cache: zdjęta w 67–77 ms, FCP 100–116 ms
 *   CPU x20,       zimny cache: zdjęta w 1194–1339 ms, FCP 1832–1956 ms
 *   bez dławienia, ciepły cache: zdjęta w 32–78 ms, FCP 52–104 ms
 *   CPU x20,       ciepły cache: zdjęta w 520–677 ms, FCP 804–1032 ms
 *
 * We WSZYSTKICH 20 przebiegach klasa znika PRZED pierwszym malowaniem, więc
 * żadna klatka nie pokazała cudzej palety. Ale — inaczej niż własność o
 * układzie — NIE JEST TO GWARANCJA STRUKTURALNA: wynika z tego, że malowanie
 * czeka na blokujący arkusz, a hydratacja zdąży się przed nim rozstrzygnąć.
 * Zmiana, która przyspieszy malowanie względem hydratacji (usunięcie
 * blokującego arkusza, cięższy bundel), odwróci tę kolejność i mignięcie stanie
 * się widoczne. Wtedy — i tylko wtedy — warto rozważyć wybór użytkownika
 * dostarczany serwerowo (patrz szew w `preset-store.ts`), bo to jedyna rzecz,
 * która tę populację domyka.
 *
 * Typ to `string | null`, nie `PresetId`: wartość idzie z bazy, której nikt po
 * drodze nie waliduje (patrz `PresetSources` w `registry.ts`). Zawężenie robi
 * `resolvePresetId()`, w jednym miejscu.
 */
const InstancePresetContext = createContext<string | null>(null)

export function InstancePresetProvider({
  value,
  children,
}: {
  value: string | null
  children: ReactNode
}) {
  return <InstancePresetContext.Provider value={value}>{children}</InstancePresetContext.Provider>
}

/** Domyślne `null` (brak dostawcy) znaczy „instancja nic nie narzuca" — czyli
 *  zachowanie sprzed E5. Testy montujące pojedyncze komponenty nie muszą więc
 *  o tym dostawcy wiedzieć. */
export function useInstancePreset(): string | null {
  return useContext(InstancePresetContext)
}
