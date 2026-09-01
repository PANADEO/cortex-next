import { migrate, pool } from "./db"

/**
 * SKĄD SIĘ WZIĄŁ PLIK — odczytane ze zdarzeń narzędzia, nigdy z domysłu.
 *
 * W „Moich plikach" leżą obok siebie dwie różne rzeczy: to, co człowiek wgrał sam,
 * i to, co asystent odłożył na jego prośbę po skończonej sprawie. Na ekranie wyglądały
 * identycznie, więc po tygodniu `podsumowanie-sierpien.md` był plikiem nie wiadomo
 * z czego. To dziura w tezie produktu: „widzisz, co asystent zrobił i z czego" działa
 * wewnątrz sprawy i rozpada się dokładnie tam, gdzie wynik pracy ma zostać na dłużej.
 *
 * Nowej tabeli nie ma i nie potrzeba: `save_to_my_files` zapisuje `tool_end` ze ŚCIEŻKĄ
 * DOCELOWĄ w polu `summary`, a zdarzenie wisi przy sprawie. Ta ścieżka to dokładnie to,
 * co niesie `FileMeta.path`.
 *
 * DWIE REGUŁY, KTÓRE Z TEGO WYNIKAJĄ:
 *
 * 1. Pochodzenie dostaje wyłącznie plik, dla którego zdarzenie ISTNIEJE. Reszta nie
 *    dostaje nic — a konkretnie nie dostaje napisu „wgrany przez Ciebie". Brak dowodu
 *    nie jest dowodem; to ta sama reguła, na której stoi panel wyniku.
 * 2. Zmiana nazwy zrywa powiązanie i tak ma być. Kluczem jest ścieżka, więc po
 *    przeniesieniu zdarzenie mówi o pliku, którego już nie ma. Alternatywą byłoby
 *    przepisywanie historii przy każdej zmianie nazwy, czyli to, czego dziennik
 *    robić nie może. Zerwane powiązanie znaczy „nie wiem" i tak wygląda: bez plakietki.
 */
export type FileOrigin = { caseId: string; title: string; at: string }

/**
 * Ścieżka → sprawa, z której plik przyszedł. Klucz jest pełną ścieżką względną,
 * bo ten sam plik może stać w podfolderze i nazwa go nie rozróżnia.
 *
 * `distinct on` z porządkiem malejącym po `seq` bierze OSTATNIE odłożenie pod tą
 * ścieżką: gdy człowiek skasował plik i kazał odłożyć go jeszcze raz z innej sprawy,
 * prawdziwa jest ta druga.
 */
export async function originsInMyFiles(owner: string): Promise<Record<string, FileOrigin>> {
  await migrate()
  const r = await pool.query(
    `select distinct on (e.payload->>'summary')
            e.payload->>'summary' as path,
            e.case_id as "caseId",
            c.title,
            e.at
       from desk.event e
       join desk.case_file c on c.id = e.case_id
      where c.owner = $1
        and e.payload->>'name' = 'save_to_my_files'
        and e.payload->>'type' = 'tool_end'
        and e.payload->>'ok' = 'true'
      order by e.payload->>'summary', e.seq desc`,
    [owner],
  )
  const out: Record<string, FileOrigin> = {}
  for (const w of r.rows) {
    if (typeof w.path === "string" && w.path) {
      out[w.path] = { caseId: w.caseId, title: w.title, at: new Date(w.at).toISOString() }
    }
  }
  return out
}
