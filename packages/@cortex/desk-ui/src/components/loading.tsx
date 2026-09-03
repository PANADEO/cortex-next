/**
 * ŁADOWANIE — szkielet listy. JEDEN nośnik czekania w całym Biurku.
 *
 * DLACZEGO SZKIELET, A NIE KÓŁKO. Kółko mówi tylko „czekaj" i jest małym obiektem
 * pośrodku pustej płachty — czyli ekran DALEJ wygląda na pusty, a to jest dokładnie to
 * nieporozumienie, które ten komponent ma usunąć. Szkielet pokazuje KSZTAŁT odpowiedzi
 * (tyle a tyle wierszy listy) i trzyma jej wysokość, więc treść nie podskakuje, kiedy
 * dojdzie. Wariant z kółkiem był tu wcześniej i nie miał ANI JEDNEGO wywołania — poszedł,
 * żeby dwa nośniki nie rozjechały się między ekranami.
 *
 * DLACZEGO BEZ NAPISU. Napis wymagałby tłumaczenia, tłumaczenie na serwerze wymaga
 * `await deskT()` (a ten sięga po ciasteczko), i przez to komponent był FUNKCJĄ
 * ASYNCHRONICZNĄ importującą `i18n/server`. Dwa skutki, oba złe: bramka `desk-client-purity`
 * słusznie nie wpuściłaby go do komponentu przeglądarki — a właśnie tam czekanie trwa
 * najdłużej — i zapasowa treść `<Suspense>` sama się zawieszała. Bez napisu komponent jest
 * zwykłą funkcją i wolno go użyć PO OBU STRONACH granicy: w `loading.tsx` trasy, w
 * `fallback` `<Suspense>` i w komponencie klienckim, który dopiero pobiera dane.
 *
 * DLACZEGO `aria-busy` ZAMIAST TEKSTU DLA CZYTNIKA. `aria-busy="true"` to standardowy
 * sposób powiedzenia „ten obszar jest właśnie uzupełniany" — czytnik wstrzymuje się
 * z czytaniem, aż flaga zniknie razem ze szkieletem, i wtedy ogłasza TREŚĆ. Zdanie
 * „Ładuję…" powiedziałoby mniej, a kosztowało napis w dwóch słownikach.
 *
 * Pasek ma WYSOKOŚĆ WIERSZA (`h-desk-row`), a nie wysokość dobraną na oko — inaczej treść
 * podskakuje w chwili, w której dochodzi, czyli szkielet oddaje ręką to, co wziął nogą.
 * Wartość idzie z tokenu, więc zmiana gęstości list nie rozjedzie się z tym plikiem.
 *
 * Same paski są `aria-hidden`: to rysunek zastępczy, nie informacja. Klasa `desk-wait`
 * (patrz `desk.css`) odpowiada za to, że szkielet ujawnia się dopiero po 100 ms —
 * tam stoi pomiar, z którego wzięła się ta liczba.
 */
export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="desk-wait space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-desk-row animate-pulse rounded-desk bg-desk-line/40 motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
