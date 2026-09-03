// Każda trasa, która sięga po dysk Biurka, NAPRAWDĘ ODMAWIA osobie bez zdolności
// do wspólnej półki — sprawdzone wywołaniem, nie czytaniem kodu.
//
// DLACZEGO TEN PLIK ISTNIEJE. Brama była pilnowana w połowie i nikt tego nie widział,
// bo połowa działała wzorowo: `files.ts` filtrował spis i blokował zmiany, więc wspólnych
// katalogów na ekranie nie było. Ale `file.ts` oddawał BAJTY każdemu, kto zna ścieżkę,
// a `files-upload.ts` przyjmował katalog z formularza. Odebranie zdolności nie odbierało nic.
//
// DLACZEGO TEST ZACHOWANIA, A NIE SKAN KODU. Poprzednie dwie wersje szukały bramy
// w źródle — najpierw wyrażeniem regularnym, potem w drzewie składniowym. Każda była
// obchodzona, i to nie sztuczkami, tylko zwykłym TypeScriptem: innym zapisem importu,
// `require`, reeksportem z sąsiedniego pliku, bramą w funkcji pomocniczej, wywołaniem
// z wynikiem wyrzuconym do kosza. Ostatnia wersja obchodziła się nawet zaślepką
// `mayTouchShared(() => true, …)` — brama rozstrzygała, tylko nigdy nie odmawiała.
//
// Wspólny mianownik: statycznie da się sprawdzić, czy brama ROZSTRZYGA COKOLWIEK,
// nie czy rozstrzyga O TYM ŻĄDANIU. Tamte wersje miały też gorszą wadę niż przecieki —
// karały kod poprawny (alias importu, brama w helperze), a strażnik, który myli się
// przeciwko dobremu kodowi, uczy ludzi wpisywać się na listę zwolnień.
//
// Tutaj pytanie jest jedno i jest tym właściwym: wołam trasę jako osoba BEZ `shared.read`
// i sprawdzam kod odpowiedzi. Żaden zapis importu tego nie zmieni, a zaślepka bramy
// natychmiast czerwieni się na kontroli pozytywnej niżej.

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { beforeEach, describe, expect, it, vi } from "vitest"

const API = __dirname

/** Zdolności, które ma udawana osoba w danym przebiegu — podmieniane per test. */
let granted = new Set<string>()

vi.mock("@cortex/desk-ui/i18n/server", () => ({ deskT: async () => (key: string) => key }))
vi.mock("@cortex/desk-core/identity", () => ({
  whoAmI: async () => ({ id: "anna", role: "member" }),
}))
vi.mock("@cortex/desk-core/capability-gate", () => ({
  policyFor: async () => ({ granted: [] }),
  hasCapability: (_p: unknown, id: string) => granted.has(id),
  spentToday: async () => 0,
}))

/**
 * DYSK JEST ATRAPĄ, KTÓRA RZUCA — i to jest poprawka po prawdziwej szkodzie, nie
 * ostrożność. Bez niej kontrola pozytywna przechodziła bramę i naprawdę ZAPISYWAŁA:
 * w `.data/wspolne` narosły dwadzieścia dwa pliki `cennik (N).csv`, po jednym na każde
 * uruchomienie testów. Na maszynie z ustawionym `DESK_DATA_DIR` byłby to zapis na
 * PRAWDZIWĄ wspólną półkę firmy, wykonany przez test jednostkowy.
 *
 * Rzucająca stub naprawia przy okazji drugą, subtelniejszą wadę: „przeszło bramę"
 * znaczy teraz dokładnie tyle i nic więcej. Wcześniej wyjątek z bazy liczył się za
 * przejście, więc test nie odróżniał „doszło do dysku i padło" od „doszło do dysku
 * i zapisało".
 */
const SHARED = "Wspólne pliki"
const OFF_THE_DISK = "brama przepuściła — dalej już nie idziemy"
const refuse = () => {
  throw new Error(OFF_THE_DISK)
}
vi.mock("@cortex/desk-core/desk-storage", () => ({
  list: refuse,
  trash: refuse,
  folders: refuse,
  fullPath: refuse,
  writeNew: refuse,
  move: refuse,
  copy: refuse,
  toTrash: refuse,
  restore: refuse,
  // Udaje plik wyrzucony ZE WSPÓLNEJ PÓŁKI: tam właśnie chciałby wrócić.
  restoreTarget: async () => ({ folder: SHARED, landedElsewhere: false }),
  emptyTrash: refuse,
  createFolder: refuse,
  caseFolder: () => "Sprawy/x",
  // ATRAPA MUSI BYĆ KOMPLETNA, i to nie jest porządkowanie. Brak eksportu nie daje
  // odmowy — daje `TypeError: … is not a function`, a kontrola dodatnia niżej liczyła
  // KAŻDY wyjątek za „brama przepuściła". Trasa, która wywracała się na dziurawej
  // atrapie, wyglądała więc dokładnie tak samo jak trasa, która przeszła bramę.
  // Pilnuje tego test „stub zna każdą czynność dysku".
  prepareDesk: refuse,
  read: refuse,
  readBinary: refuse,
  write: refuse,
  NameClash: class NameClash extends Error {},
  // Klasa, nie stub funkcji: `files.ts` robi na niej `instanceof`, a `instanceof`
  // na `undefined` sam rzuca — czyli znowu wyglądałoby to na przejście bramy.
  StorageProblem: class StorageProblem extends Error {},
}))
vi.mock("@cortex/desk-core/file-origin", () => ({ originsInMyFiles: refuse }))


/**
 * Jak zawołać każdą trasę tak, żeby DOTKNĘŁA wspólnej półki. To jest jedyne miejsce,
 * w którym trzeba wiedzieć cokolwiek o kształcie żądania — reszta pliku jest wspólna.
 */
const CALLS: { route: string; what: string; call: () => Promise<Response> }[] = [
  {
    route: "file.ts",
    what: "pobranie zawartości pliku ze wspólnej półki",
    call: async () => {
      const { GET } = await import("./file")
      return GET(new Request(`http://d/api/file?path=${encodeURIComponent(`${SHARED}/cennik.csv`)}`))
    },
  },
  {
    route: "files.ts",
    what: "wylistowanie wspólnej półki",
    call: async () => {
      const { GET } = await import("./files")
      return GET(new Request(`http://d/api/files?folder=${encodeURIComponent(SHARED)}`))
    },
  },
  {
    route: "files.ts",
    what: "przeniesienie pliku NA wspólną półkę",
    call: async () => {
      const { POST } = await import("./files")
      return POST(
        new Request("http://d/api/files", {
          method: "POST",
          body: JSON.stringify({ action: "move", from: "Moje pliki/a.csv", to: `${SHARED}/a.csv` }),
        }),
      )
    },
  },
  {
    route: "files.ts",
    what: "przywrócenie z kosza pliku, który wrócić chce NA wspólną półkę",
    call: async () => {
      const { POST } = await import("./files")
      return POST(
        new Request("http://d/api/files", {
          method: "POST",
          body: JSON.stringify({ action: "restore", id: "cennik.csv__1234" }),
        }),
      )
    },
  },
  {
    route: "files-upload.ts",
    what: "wgranie pliku NA wspólną półkę",
    call: async () => {
      const { POST } = await import("./files-upload")
      const form = new FormData()
      form.set("folder", SHARED)
      form.set("file", new File([new Uint8Array([1, 2, 3])], "cennik.csv"))
      return POST(new Request("http://d/api/files/upload", { method: "POST", body: form }))
    },
  },
]

/**
 * Trasy, które dysku dotykają, a wspólnej półki dotknąć NIE MOGĄ — każda z powodem
 * wpisanym tutaj, a nie domyślnym. Dopisanie się do tej listy ma być decyzją, którą
 * ktoś zobaczy w przeglądzie zmian.
 */
const EXEMPT: Record<string, string> = {
  "case-new.ts":
    "ścieżkę teczki składa serwer z identyfikatora sprawy — katalog nie przychodzi od przeglądarki",
  "case-events.ts": "parametr `from` to kursor zdarzeń (liczba), nie ścieżka na dysku",
  "case-stop.ts": "nie przyjmuje żadnej ścieżki — zatrzymuje turę po identyfikatorze sprawy",
  "case-turn.ts": "załączniki wskazuje się nazwą w teczce sprawy, nie ścieżką od użytkownika",
  "test-reset.ts": "narzędzie testowe, nie trasa produktu",
  "test-saved-file.ts": "narzędzie testowe, nie trasa produktu",
  "test-seed-turn.ts": "narzędzie testowe, nie trasa produktu",
}

/**
 * Moduły, przez które da się dotknąć dysku — po NAZWIE MODUŁU. `moduleSpecifier.text`
 * nie zawiera cudzysłowów, więc wzorzec, który ich wymagał, nie widział `from "fs"` —
 * ta sama dziura, którą domknąłem rundę wcześniej i otworzyłem z powrotem, przepisując
 * regex. Stąd teraz zbiór dokładnych nazw plus `desk-core/sandbox`, który też kopiuje
 * pliki z biurka (`mounts.fromDesk`).
 */
const DISK_MODULES = new Set([
  "fs",
  "fs/promises",
  "node:fs",
  "node:fs/promises",
  "@cortex/desk-core/desk-storage",
  "@cortex/desk-core/sandbox",
])
const DISK = { test: (spec: string) => DISK_MODULES.has(spec) }

function touchesDisk(file: string): boolean {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(API, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  let found = false
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (DISK.test(node.moduleSpecifier.text)) found = true
    }
    // `require(...)`, `await import(...)` i reeksport — wszystko, co wciąga cudzy moduł.
    if (ts.isCallExpression(node)) {
      const first = node.arguments[0]
      const dynamic =
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")
      if (dynamic && first && ts.isStringLiteralLike(first) && DISK.test(first.text)) found = true
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) found = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

beforeEach(() => {
  granted = new Set()
  vi.resetModules()
})

describe("wspólna półka odmawia na każdej trasie", () => {
  it.each(CALLS.map((one) => [`${one.route} — ${one.what}`, one] as const))(
    "%s bez zdolności kończy się odmową",
    async (_n, one) => {
      const r = await one.call()
      expect(
        r.status,
        `${one.route}: ${one.what} przeszło bez zdolności. To jest wyciek wspólnej półki, ` +
          "nie usterka wyglądu.",
      ).toBe(403)
    },
  )

  it("z nadaną zdolnością te same trasy PRZESTAJĄ odmawiać", async () => {
    // KONTROLA POZYTYWNA. Bez niej brama, która odmawia ZAWSZE — choćby zaślepka
    // `() => false` — przechodziłaby wszystkie testy wyżej i wyglądała na wzorową.
    //
    // Pytanie brzmi WYŁĄCZNIE „czy brama przepuściła", nie „czy trasa się wykonała".
    // Za bramą stoi prawdziwa baza i prawdziwy dysk, których w teście jednostkowym nie
    // ma — więc wyjątek stamtąd jest tu DOWODEM PRZEJŚCIA, a nie porażką. Udawanie ich
    // zamieniłoby tę kontrolę w test atrap.
    granted = new Set(["shared.read", "shared.write"])
    const refused: string[] = []
    for (const one of CALLS) {
      try {
        const r = await one.call()
        if (r.status === 403) refused.push(`${one.route} — ${one.what}`)
      } catch (e) {
        // Przeszło bramę i przewróciło się dalej, na infrastrukturze — to znaczy
        // „przeszło". ALE nie każdy wyjątek to znaczy: `… is not a function` albo
        // „No export defined" mówi, że rozsypała się ATRAPA, a nie że brama puściła.
        // Bez tego rozróżnienia dziurawa stub udawała dowód.
        const reason = String(e)
        if (/is not a function|No .* export|not defined/i.test(reason)) {
          throw new Error(`${one.route} — ${one.what}: stub jest niepełna, nie brama puściła. ${reason}`)
        }
      }
    }
    expect(refused, "brama odmawia mimo nadanej zdolności — to nie jest brama, to ściana")
      .toEqual([])
  })
})

describe("żadna trasa nie wymyka się temu sprawdzeniu", () => {
  const onDisk = readdirSync(API).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))

  it("w ogóle znajduje trasy sięgające po dysk", () => {
    // Bez tego cały plik mógłby być zielony dlatego, że nie sprawdził niczego.
    expect(onDisk.filter(touchesDisk).length).toBeGreaterThanOrEqual(4)
    expect(CALLS.length).toBeGreaterThanOrEqual(4)
  })

  it.each(onDisk.map((f) => [f, f] as const))(
    "%s jest albo sprawdzana wywołaniem, albo ma wpisany powód",
    (_n, file) => {
      if (!touchesDisk(file)) return
      if (EXEMPT[file]) {
        expect(EXEMPT[file]!.length, `powód zwolnienia ${file} jest pusty`).toBeGreaterThan(20)
        return
      }
      expect(
        CALLS.some((one) => one.route === file),
        `${file} sięga po dysk Biurka, a nikt nie sprawdza, czy odmawia. Dopisz wywołanie ` +
          "do CALLS albo powód do EXEMPT — skan kodu tego nie zastąpi, bo bramę da się " +
          "wymówić, nie stosując jej.",
      ).toBe(true)
    },
  )

  it("katalog tras nie urósł w głąb ani poza .ts", () => {
    // Skan pokrycia jest PŁASKI i obejmuje wyłącznie `.ts`. Gdy pojawi się podkatalog
    // albo `.tsx`, ta granica stanie się dziurą — i stanie się nią po cichu. Test zniknął
    // przy przepisywaniu strażnika na wołanie tras; wraca, bo granica została.
    const strays = readdirSync(API).filter(
      (entry) => statSync(path.join(API, entry)).isDirectory() || entry.endsWith(".tsx"),
    )
    expect(
      strays,
      "skan pokrycia jest płaski i tylko dla .ts — rozszerz go, zanim dołożysz takie pliki",
    ).toEqual([])
  })

  it("nie zwalnia tras, których już nie ma", () => {
    const present = new Set(readdirSync(API))
    for (const file of Object.keys(EXEMPT)) {
      expect(present.has(file), `EXEMPT wymienia ${file}, którego nie ma w katalogu`).toBe(true)
    }
  })

  it("stub zna każdą czynność dysku", () => {
    // PRZYCZYNA, NIE OBJAW. Brak jednej nazwy w atrapie nie daje odmowy — daje
    // `TypeError`, a wyjątek do złudzenia przypomina „przeszło bramę i przewróciło się
    // dalej". Tak właśnie `file.ts` przez pewien czas UDAWAŁ, że przechodzi bramę,
    // podczas gdy wywracał się na `storage.read`, którego stub nie miała.
    //
    // Trzymanie listy ręcznie nie działa: `desk-storage` rośnie (`restoreTarget`
    // i `StorageProblem` doszły w tym tygodniu), a stub nie ma jak o tym wiedzieć.
    const STORAGE = path.resolve(API, "../../../desk-core/src/desk-storage.ts")
    const realModule = ts.createSourceFile(
      "desk-storage.ts",
      readFileSync(STORAGE, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const exported = realModule.statements
      .filter((one) =>
        one.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
      )
      .flatMap((one) => {
        if (ts.isFunctionDeclaration(one) || ts.isClassDeclaration(one))
          return one.name ? [one.name.text] : []
        if (ts.isVariableStatement(one))
          return one.declarationList.declarations.flatMap((d) =>
            ts.isIdentifier(d.name) ? [d.name.text] : [],
          )
        return []
      })
    expect(exported.length, "nie odczytałem eksportów desk-storage").toBeGreaterThan(10)

    // Nazwy w atrapie czytamy z TEGO pliku — jedyne miejsce, gdzie naprawdę stoją.
    const selfSource = ts.createSourceFile(
      "self.ts",
      readFileSync(path.join(API, "shared-shelf-routes.test.ts"), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const stub = new Set<string>()
    const walk = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        node.arguments[0].text === "@cortex/desk-core/desk-storage"
      ) {
        const factory = node.arguments[1]
        if (factory && ts.isArrowFunction(factory)) {
          const literal = ts.isParenthesizedExpression(factory.body)
            ? factory.body.expression
            : factory.body
          if (ts.isObjectLiteralExpression(literal)) {
            for (const property of literal.properties) {
              if (property.name && ts.isIdentifier(property.name)) stub.add(property.name.text)
            }
          }
        }
      }
      ts.forEachChild(node, walk)
    }
    walk(selfSource)
    expect(stub.size, "nie odczytałem atrapy z tego pliku").toBeGreaterThan(10)

    expect(
      exported.filter((name) => !stub.has(name)),
      "stub nie zna tych czynności — trasa, która po nie sięgnie, wywali się na " +
        "`is not a function`, a to wygląda w tym teście jak przejście bramy",
    ).toEqual([])
  })
})
