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
