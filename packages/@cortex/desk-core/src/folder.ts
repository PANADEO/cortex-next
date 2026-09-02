import type { DeskEvent, FileMeta } from "./types"

/**
 * Pochodzenie pliku w teczce sprawy wyliczamy ze zdarzeń, nie z układu katalogów.
 *
 * Dwa źródła, bo załącznik istnieje na dysku ZANIM powstanie polecenie:
 * `zalacznik` zapisuje wgranie w chwili, gdy plik ląduje w teczce, a `mysl.zalaczniki`
 * mówi, co ostatecznie poszło z poleceniem. Bez pierwszego z nich plik wgrany
 * i jeszcze niewysłany przez półtorej sekundy udaje wynik pracy agenta —
 * i tak właśnie trafiał do panelu wyniku, obok dokumentów, których nikt nie tworzył.
 *
 * Ten moduł musi zostać CZYSTY — sięga po niego komponent kliencki, więc żaden import
 * `pg` ani `node:fs` nie może tu trafić. Część serwerowa siedzi w `teczka-serwer.ts`.
 */
/**
 * Nazwa katalogu na dysku, nie etykieta. Zostaje po polsku w każdym języku interfejsu:
 * przemianowanie jej przy przełączeniu języka rozjechałoby ścieżki zapisane w sprawach,
 * w zdarzeniach i w dzienniku. Na ekranie podmienia ją klucz `files.myFilesFolder`.
 *
 * Stoi TUTAJ, a nie w `desk-storage`, bo sięgają po nią komponenty klienckie — a tamten
 * moduł zaczyna się od `node:fs` i wciągnięcie go do bundla przeglądarki wywala budowanie
 * na `UnhandledSchemeError`. To jest cały powód tej lokalizacji.
 */
export const MY_FILES = "Moje pliki"

/**
 * WSPÓLNA PÓŁKA — jedyny katalog, który NIE należy do jednego biurka.
 *
 * Leży fizycznie poza katalogami osób (`<dane>/wspolne`, nie `<dane>/biurka/<osoba>`),
 * a w ścieżkach logicznych występuje pod tą nazwą, tak jak „Moje pliki". Dzięki temu
 * reszta produktu — teczki, dowód, montaże do piaskownicy — operuje dalej na napisach
 * i nie musi wiedzieć, że istnieją dwa korzenie.
 *
 * NIE JEST dowiązaniem symbolicznym w biurku osoby, i to jest decyzja, nie wygoda:
 * dowiązanie w katalogu, który trafia do piaskownicy, to dokładnie ta ścieżka
 * wyprowadzania cudzych danych, którą demon musi po sobie zamiatać.
 *
 * Ta sama zasada co przy `MY_FILES`: nazwa katalogu, nie etykieta — zostaje po polsku
 * w każdym języku interfejsu, bo przemianowanie rozjechałoby ścieżki zapisane w sprawach.
 */
export const SHARED = "Wspólne pliki"

/**
 * Czy ta ścieżka logiczna wskazuje na wspólną półkę. Stoi tu, a nie w `desk-storage`,
 * z tego samego powodu co `MY_FILES`: to jest arytmetyka na napisach, pytają o nią
 * i brama, i komponenty klienckie, a tamten moduł zaczyna się od `node:fs`.
 *
 * Porównanie po SEGMENCIE, nie po prefiksie napisu — „Wspólne plikiXYZ" nie jest
 * wspólną półką i nie ma prawa się nią stać przez zbieżność pierwszych liter.
 */
export const isShared = (relative: string) =>
  relative === SHARED || relative.startsWith(SHARED + "/")

export function splitFolder(files: FileMeta[], events: DeskEvent[], uploading: string[] = []) {
  const fromHuman = new Set<string>(uploading)
  for (const e of events) {
    if (e.type === "prompt") for (const n of e.attachments ?? []) fromHuman.add(n)
    if (e.type === "attachment") for (const n of e.names) fromHuman.add(n)
  }
  const documents = files.filter((p) => !p.folder)
  return {
    results: documents.filter((p) => !fromHuman.has(p.name)),
    attachments: documents.filter((p) => fromHuman.has(p.name)),
  }
}
