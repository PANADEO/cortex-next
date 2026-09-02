// Strażnik parzystości BAZY między docker-compose.yml (lokalnie) a
// docker-compose.image.yml (wdrożone obrazy) — brat seed-chain-parity.test.ts,
// osobny plik, bo pilnuje innej rzeczy niż łańcuch seedów.
//
// Powód powstania: do 07.08.2026 usługa `postgres` istniała WYŁĄCZNIE
// w docker-compose.yml. Plik wdrożeniowy miał `migrate` i `cortex-frontend`,
// a DATABASE_URL tylko w komentarzu — zakładał bazę „gdzieś obok", której nic
// nie stawia (zero wzmianek o postgresie w devops/playbooks/). Nie było to
// widoczne wyłącznie dlatego, że wdrożone instancje chodzą na tagach z `main`,
// gdzie `migrate` jeszcze nie istnieje. Pierwszy tag z tej gałęzi zatrzymałby
// deploy: `migrate` kończy się „DATABASE_URL nie jest ustawione", a aplikacja
// nie wstaje w ogóle przez depends_on: service_completed_successfully.
//
// To jest dokładnie ta sama klasa błędu co rozjazd łańcucha seedów (dodane do
// jednego pliku, zapomniane w drugim), tylko ostrzejsza: tam padał jeden
// kafelek, tu nie wstaje nic. Dlaczego test, a nie komentarz: komentarz
// w nagłówku docker-compose.image.yml już raz nie wystarczył dwa razy z rzędu.
// Dlaczego test, a nie lint: `pnpm lint` obejmuje wyłącznie
// `{app,packages}/**/*.{ts,tsx}`, plików compose nie sprawdza nic.
//
// Test NIE porównuje całych plików ani nawet pełnych list usług — te dwa pliki
// mają się prawnie różnić (build vs `image:`, ENVIRONMENT_TAG, a image.yml nie
// ma dziś kontenerów Pythona). Sprawdzane są trzy niezmienniki, każdy o cenie
// wyrażonej w utraconym dostępie albo utraconych danych.

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")

const COMPOSE_FILES = ["docker-compose.yml", "docker-compose.image.yml"] as const

/** Treść pliku bez linii komentarza — inaczej wzmianka o `postgres:` albo
 *  `ports:` w uzasadnieniu liczyłaby się jak realna konfiguracja. */
function composeLines(composeFile: string): string[] {
  return readFileSync(path.join(repoRoot, composeFile), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
}

/** Blok o zadanym kluczu: od linii `<wcięcie><klucz>:` do pierwszej niepustej
 *  linii o wcięciu mniejszym lub równym. Zwraca null, gdy klucza nie ma —
 *  rozróżnienie „nie ma" od „jest, ale pusty" jest tu istotne. */
function block(lines: string[], key: string, indent: number): string[] | null {
  const header = `${" ".repeat(indent)}${key}:`
  const start = lines.indexOf(header)
  if (start === -1) return null

  const body = lines.slice(start + 1)
  const end = body.findIndex(
    (line) => line.trim().length > 0 && !line.startsWith(" ".repeat(indent + 2)),
  )
  return end === -1 ? body : body.slice(0, end)
}

function service(composeFile: string, name: string): string[] | null {
  return block(composeLines(composeFile), name, 2)
}

function waitsForHealthyPostgres(serviceBody: string[]): boolean {
  const dependsOn = block(serviceBody, "depends_on", 4)
  if (dependsOn === null) return false
  return /\bpostgres:\s*\n\s+condition:\s*service_healthy\b/.test(dependsOn.join("\n"))
}

describe("baza w plikach compose", () => {
  it.each(COMPOSE_FILES)("%s definiuje usługę postgres", (composeFile) => {
    const postgres = service(composeFile, "postgres")

    expect(postgres, `${composeFile}: brak usługi postgres`).not.toBeNull()
    // Asercja na treść, nie tylko na obecność klucza: gdyby ekstrakcja bloku
    // przestała działać (zmiana wcięć), pusta tablica przeszłaby powyższe
    // sprawdzenie, nie dowodząc niczego.
    expect(postgres?.join("\n")).toMatch(/image:\s*postgres:/)
  })

  it.each(COMPOSE_FILES)(
    "%s: migrate i cortex-frontend czekają na zdrową bazę, nie startują obok niej",
    (composeFile) => {
      // Bez tego `migrate` rusza na nieprzyjmującej połączeń bazie i kończy się
      // błędem, a cortex-frontend nie wstaje przez
      // depends_on: service_completed_successfully — cała instancja jest martwa,
      // nie „częściowo sprawna".
      for (const name of ["migrate", "cortex-frontend"]) {
        const body = service(composeFile, name)
        expect(body, `${composeFile}: brak usługi ${name}`).not.toBeNull()
        expect(
          waitsForHealthyPostgres(body ?? []),
          `${composeFile}: ${name} nie ma depends_on postgres/condition: service_healthy`,
        ).toBe(true)
      }
    },
  )

  it("docker-compose.image.yml NIE publikuje portu bazy na hoście", () => {
    // docker-compose.yml publikuje ${POSTGRES_PORT:-5432}:5432 świadomie i tylko
    // lokalnie. Na serwerze ten sam wpis wystawił system_config (użytkowników,
    // role, granty) na całą sieć ZeroTier z domyślnymi `cortex/cortex` —
    // zweryfikowane `nc` na cortex-next 07.08.2026. Lokalny `ufw` tego NIE
    // zasłania: Docker wpina reguły w łańcuch DOCKER przed regułami ufw.
    // Lokalny plik ratuje override cortex-next (`ports: !reset []`); wdrożeniowy
    // nie ma żadnej takiej siatki, więc pilnuje go ten test.
    const postgres = service("docker-compose.image.yml", "postgres")

    expect(postgres).not.toBeNull()
    expect(postgres?.join("\n")).toMatch(/image:\s*postgres:/)
    expect(block(postgres ?? [], "ports", 4)).toBeNull()
  })

  it("docker-compose.image.yml parametryzuje nazwę kontenera i wolumenu bazy przez ENVIRONMENT_TAG", () => {
    // Na jednym hoście stoją równolegle instancja produkcyjna i UAT (devops:
    // deploy-cortex-frontend.yml vs deploy-cortex-frontend-uat.yml, które
    // wstawia ENVIRONMENT_TAG=UAT). Zgubiony tag w nazwie kontenera zatrzymuje
    // deploy głośno; zgubiony w nazwie wolumenu daje dwie instancje piszące do
    // JEDNEJ bazy — po cichu.
    const lines = composeLines("docker-compose.image.yml")
    const postgres = block(lines, "postgres", 2)

    expect(postgres?.join("\n")).toMatch(/container_name:.*\$\{ENVIRONMENT_TAG\}/)

    const volume = block(lines, "cortex_frontend_postgres_data", 2)
    expect(volume, "brak wolumenu cortex_frontend_postgres_data").not.toBeNull()
    expect(volume?.join("\n")).toMatch(/name:.*\$\{ENVIRONMENT_TAG\}/)
  })

  // CZWARTY NIEZMIENNIK, dopisany 02.09.2026 po znalezisku, które kosztowało
  // dokładnie to, przed czym broni nagłówek tego pliku: „utracone dane".
  //
  // Pliki Biurka — „Moje pliki", teczki spraw i kosz — NIE MIAŁY WOLUMENU
  // W ŻADNYM z plików compose, a `desk-storage.ts` domyśla się `./.data`.
  // Czyli dokumenty klienta leżały w warstwie zapisywalnej kontenera i każde
  // wdrożenie nowego obrazu je kasowało. Baza przeżywała, dysk nie — więc
  // po wdrożeniu zostawały sprawy opisujące pliki, których już nie ma,
  // a dowód pracy jest rozdzielony między jedno i drugie.
  //
  // To nie była luka funkcjonalna, tylko trwająca utrata danych. Nic tego nie
  // zgłaszało, bo lokalnie `./.data` żyje w katalogu repozytorium i wygląda,
  // jakby działało.
  it.each(COMPOSE_FILES)("%s: pliki Biurka mają wolumen, a nie warstwę kontenera", (composeFile) => {
    const lines = composeLines(composeFile)
    const frontend = service(composeFile, "cortex-frontend")
    expect(frontend, `${composeFile}: brak usługi cortex-frontend`).not.toBeNull()
    const body = (frontend ?? []).join("\n")

    // Zmienna MUSI być ustawiona jawnie — domyślka w kodzie celuje w katalog,
    // który znika razem z kontenerem.
    const declared = body.match(/DESK_DATA_DIR[:=]\s*(\S+)/)
    expect(declared, `${composeFile}: cortex-frontend nie ustawia DESK_DATA_DIR`).not.toBeNull()
    const target = declared![1]!

    // ...i musi wskazywać na NAZWANY wolumen zamontowany dokładnie tam.
    const mounts = block(frontend ?? [], "volumes", 4)
    expect(mounts, `${composeFile}: cortex-frontend nie ma sekcji volumes`).not.toBeNull()
    const mount = (mounts ?? []).find((line) => line.includes(`:${target}`))
    expect(
      mount,
      `${composeFile}: nic nie jest zamontowane w ${target} — pliki Biurka zniknęłyby przy odtworzeniu kontenera`,
    ).toBeTruthy()

    const volumeName = mount!.trim().replace(/^-\s*/, "").split(":")[0]!
    expect(
      block(lines, volumeName, 2),
      `${composeFile}: wolumen ${volumeName} zamontowany, ale niezadeklarowany`,
    ).not.toBeNull()
  })
})
