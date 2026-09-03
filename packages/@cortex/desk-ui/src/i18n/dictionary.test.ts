// Słownik Biurka: oba języki mają te same klucze, a każdy klucz z kodu istnieje.
//
// DLACZEGO POWSTAŁ. Brak klucza nie wywraca ekranu — `makeDeskT` oddaje wtedy sam klucz,
// więc na ekranie stoi `case.stop` zamiast „Stop". To jest awaria widoczna wyłącznie
// dla kogoś, kto akurat na ten ekran patrzy, i to w tym jednym języku. Dwa języki
// utrzymywane ręcznie rozjeżdżają się przy pierwszym pośpiechu.
//
// CZEGO NIE ŁAPIE: klucza sklejanego w całości ze zmiennej. Klucz z literalnym
// przedrostkiem (`case.status.${x}`) sprawdzamy po przedrostku — musi istnieć
// przynajmniej jedno rozwinięcie, więc literówka w przedrostku dalej jest czerwona.

import { capabilityCatalogue } from "@cortex/desk-core/capability-gate"
import { demoPeople, DEPARTMENTS, quickTasksByRole } from "@cortex/desk-core/people"
import { cardFor, TOOL_CARDS } from "@cortex/desk-core/tool-cards"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import en from "./en.json"
import { DESK_LOCALES, makeDeskT } from "./locale"
import pl from "./pl.json"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../../..")
const ROOTS = ["packages/@cortex/desk-ui/src", "packages/@cortex/desk-app/src"]

/** Ścieżki do liści. Liść mnogi liczy się jako JEDEN klucz, bo formy różnią się językiem. */
function keysOf(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix]
  const entries = Object.entries(node as Record<string, unknown>)
  // Liść mnogi: same nazwy form CLDR w środku, żadnego zagnieżdżenia.
  const forms = new Set(["zero", "one", "two", "few", "many", "other"])
  if (entries.length > 0 && entries.every(([k, v]) => forms.has(k) && typeof v === "string")) {
    return [prefix]
  }
  return entries.flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}

const plKeys = keysOf(pl).sort()
const enKeys = keysOf(en).sort()

/** Klucze, po które kod naprawdę sięga — z wywołań `translate("…")`. */
function usedKeys(): { exact: string[]; prefixes: string[] } {
  const exact = new Set<string>()
  const prefixes = new Set<string>()
  for (const root of ROOTS) {
    const files = readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
      .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    for (const relative of files) {
      const source = ts.createSourceFile(
        relative,
        readFileSync(path.join(repoRoot, relative), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "translate" &&
          node.arguments[0]
        ) {
          const arg = node.arguments[0]
          if (ts.isStringLiteralLike(arg)) exact.add(arg.text)
          else if (ts.isTemplateExpression(arg) && arg.head.text) prefixes.add(arg.head.text)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  return { exact: [...exact].sort(), prefixes: [...prefixes].sort() }
}

describe("słownik Biurka", () => {
  it("ma oba języki i niepusty zestaw kluczy", () => {
    expect(DESK_LOCALES).toEqual(["pl", "en"])
    expect(plKeys.length).toBeGreaterThan(20)
  })

  it("oba języki mają dokładnie te same klucze", () => {
    expect({
      brakujeWEn: plKeys.filter((k) => !enKeys.includes(k)),
      nadmiarWEn: enKeys.filter((k) => !plKeys.includes(k)),
    }).toEqual({ brakujeWEn: [], nadmiarWEn: [] })
  })

  it("każdy klucz użyty w kodzie istnieje w słowniku", () => {
    const { exact, prefixes } = usedKeys()
    expect(exact.length).toBeGreaterThan(20)
    expect({
      nieznane: exact.filter((k) => !plKeys.includes(k)),
      puste: prefixes.filter((p) => !plKeys.some((k) => k.startsWith(p))),
    }).toEqual({ nieznane: [], puste: [] })
  })

  it("podstawia zmienne i wybiera formę liczby mnogiej", () => {
    const t = makeDeskT("pl")
    expect(t("case.seconds", { count: 5 })).toBe("5 s")
    expect(t("shell.allCases", { count: 12 })).toBe("Wszystkie sprawy (12)")
    const e = makeDeskT("en")
    expect(e("shell.skills", { granted: 1, count: 1 })).toBe("I can do 1 of 1 thing")
    expect(e("shell.skills", { granted: 2, count: 9 })).toBe("I can do 2 of 9 things")
  })

  it("każdy klucz z karty narzędzia istnieje w słowniku", () => {
    // Karty żyją w `desk-core` i niosą KLUCZE, nie zdania — więc skan wywołań
    // `translate("…")` ich nie widzi. Literówka w karcie pokazałaby na ekranie
    // `tools.read_file.ok` zamiast „Przeczytałem", i to tylko przy tym jednym narzędziu.
    // Dwie karty budowane w locie idą razem z wbudowanymi, bo to WŁAŚNIE one
    // niosą klucze, których nie widzi żaden skan: karta obcego serwera i karta
    // narzędzia bez rozpoznawalnego źródła powstają dopiero przy pierwszym wywołaniu.
    const cards = [
      ...Object.values(TOOL_CARDS),
      cardFor("mcp_nbp_kurs_waluty", "nbp"),
      cardFor("nic_takiego_nie_znam"),
    ]
    const fromCards = cards.flatMap((card) =>
      [
        card.running,
        card.ok,
        // `failed` doszło razem z krokiem, który przestał kłamać w tytule. Bez tej pozycji
        // literówka w kluczu porażki pokazałaby na ekranie `tools.write_sheet.failed`
        // dokładnie w chwili, w której coś poszło nie tak — czyli w najgorszym momencie.
        card.failed,
        card.group?.phrase,
        card.evidence?.phrase,
        card.evidence?.phraseBare,
      ].filter((key): key is string => typeof key === "string"),
    )
    expect(fromCards.length).toBeGreaterThan(20)
    expect(fromCards.filter((key) => !plKeys.includes(key))).toEqual([])
  })

  it("każda zdolność, dział i zlecenie startowe ma swoje słowa", () => {
    // Zasiew niesie TOŻSAMOŚĆ, słowa stoją tutaj — a klucz buduje `capabilityLabel`,
    // więc skan wywołań `translate("…")` go nie widzi. Bez tego testu nowa zdolność
    // w katalogu pokazuje się na ekranie jako `files.list`, po cichu i w obu językach.
    const wanted = [
      ...capabilityCatalogue.flatMap((z) => [
        `capability.${z.id}.name`,
        `capability.${z.id}.description`,
        `capability.department.${z.department}`,
      ]),
      ...Object.values(quickTasksByRole)
        .flat()
        .flatMap((id) => [`quickTask.${id}.title`, `quickTask.${id}.hint`, `quickTask.${id}.text`]),
      ...DEPARTMENTS.map((d) => `capability.department.${d}`),
      ...demoPeople.map((u) => `capability.department.${u.department}`),
    ]
    expect(wanted.length).toBeGreaterThan(30)
    expect(wanted.filter((k) => !plKeys.includes(k))).toEqual([])
  })

  /**
   * ŻADNA TRASA NIE ODDAJE ZDANIA WPISANEGO NA SZTYWNO.
   *
   * Napis w kodzie trasy jest niewidoczny dla wszystkiego, co pilnuje słownika: nie ma go
   * w `pl.json`, więc nie ma go też w `en.json`, i użytkownik anglojęzyczny dostaje
   * mieszankę dwóch języków w jednej sesji. Poprawiane ręcznie trzy razy pod rząd —
   * `file.ts`, potem `files-upload.ts`, potem `case-events/turn/stop`. Za czwartym razem
   * ma zapalić się światło, a nie znowu czyjaś czujność.
   *
   * REGUŁA JEST NIEZALEŻNA OD JĘZYKA i to nie jest ozdoba. Pierwsza wersja szukała
   * polskich znaków diakrytycznych — i przepuściłaby większość zdań, których miała
   * pilnować, bo „To nie jest Twoja sprawa." i „Nie ma takiej sprawy." nie mają ANI
   * JEDNEGO ogonka. Wykryło to dopiero wstrzyknięcie; sam wcześniejszy `grep` po
   * diakrytykach pokazywał zero i niczego nie dowodził.
   *
   * Reguła brzmi więc odwrotnie: pole `error` dostaje WYŁĄCZNIE wynik `translate(...)`.
   * Napis dosłowny jest zabroniony, chyba że stoi na krótkiej liście kodów, które front
   * czyta maszynowo i nikt ich nie ogląda.
   */
  it("żadna trasa nie oddaje zdania wpisanego na sztywno", () => {
    const API = path.join(here, "../../../desk-app/src/api")
    /** Kody czytane przez front, nie zdania dla człowieka. */
    const MACHINE_CODES = new Set(["name-clash"])
    const offenders: string[] = []
    for (const file of readdirSync(API).filter((one) => one.endsWith(".ts"))) {
      if (file.startsWith("test-")) continue // narzędzia testowe nie mówią do człowieka
      const source = ts.createSourceFile(
        file,
        readFileSync(path.join(API, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAssignment(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === "error" &&
          ts.isStringLiteralLike(node.initializer) &&
          !MACHINE_CODES.has(node.initializer.text)
        ) {
          offenders.push(`${file}: "${node.initializer.text}"`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(offenders).toEqual([])
  })

  /**
   * ŻADNA TRASA NIE PORÓWNUJE SIĘ Z NAPISEM ZE SŁOWNIKA.
   *
   * `case-turn.ts` sprawdzał `title === "Nowa sprawa"`, żeby wiedzieć, czy sprawa ma
   * jeszcze tytuł zastępczy — a `case-new.ts` nadaje ten tytuł przez `translate`, więc
   * po angielsku brzmi on „New case". Porównanie nie zgadzało się nigdy i sprawa
   * anglojęzycznego użytkownika zostawała bez tytułu NA ZAWSZE.
   *
   * To jest skutek uboczny przenoszenia napisów do słownika: poprawia się nadawanie,
   * zapomina o porównaniu — i nic nie pęka, bo po polsku wszystko działa. Klasa błędu,
   * nie literówka: powtórzy się przy każdym napisie, który jest jednocześnie znacznikiem
   * stanu. Stąd strażnik, a nie poprawka.
   */
  it("żadna trasa nie porównuje się z napisem ze słownika", () => {
    const API = path.join(here, "../../../desk-app/src/api")
    // Bierzemy pod uwagę wyłącznie napisy, które są ZDANIAMI: mają spację albo literę
    // spoza ASCII. Jednowyrazowy token bez ogonków to kod, nie tekst dla człowieka —
    // a kolizje bywają prawdziwe: angielskie `requests.stateGranted` to dosłownie słowo
    // „granted", identyczne z kodem stanu, którym `request.ts` słusznie się posługuje.
    // Bez tego zawężenia strażnik karałby kod poprawny, czyli robiłby dokładnie to,
    // co przy poprzednich strażnikach okazało się gorsze od przecieku.
    const isSentence = (text: string) => /\s/.test(text) || /[^\u0000-\u007F]/.test(text)
    const values = new Set<string>()
    const collect = (node: unknown) => {
      if (typeof node === "string") {
        if (isSentence(node)) values.add(node)
      } else if (node && typeof node === "object") Object.values(node).forEach(collect)
    }
    collect(pl)
    collect(en)
    const offenders: string[] = []
    for (const file of readdirSync(API).filter((one) => one.endsWith(".ts"))) {
      const source = ts.createSourceFile(
        file,
        readFileSync(path.join(API, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isBinaryExpression(node) &&
          (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
        ) {
          for (const side of [node.left, node.right]) {
            if (ts.isStringLiteralLike(side) && values.has(side.text)) {
              offenders.push(`${file}: porównanie z „${side.text}” — to jest napis ze słownika`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(offenders).toEqual([])
  })

  /**
   * ŻADNE ZAKOŃCZENIE NIE ODSYŁA DO BEZIMIENNEJ WŁADZY.
   *
   * Reguła produktu jest jedna: gdy praca się nie udaje albo czegoś nie wolno, człowiek
   * ma dostać CZASOWNIK i osobę, do której da się podejść. „Zgłoś to administratorowi"
   * jest ścianą — pani Basia nie wie, kto to, nie ma jego numeru i nie ma jak zapytać.
   * Ten zaułek wracał w tym produkcie już DWA RAZY, za każdym razem w innym pliku.
   *
   * ZAKRES, NIE DŁUGOŚĆ LISTY — i to jest sedno tej wersji. Dwie poprzednie skanowały
   * CAŁY słownik w poszukiwaniu słów, i obie były złe w obie strony naraz: przepuszczały
   * kilkanaście form odesłania, a jednocześnie zapalały się na zdaniach niewinnych,
   * bo „serwis", „technik" i „support" to słownictwo z FAKTUR, a nie z odesłań.
   * Zablokowanie zdania „Poproś o fakturę za serwis auta" byłoby gorsze niż przeciek:
   * strażnik, który myli się przeciwko dobrej treści, zostaje obejściem, nie regułą.
   *
   * Sprawdzamy więc wyłącznie ZAKOŃCZENIA — zdania, które domykają trudny moment
   * i jako jedyne mają obowiązek kogoś wskazać. Jest ich kilkanaście i są policzalne.
   * W tym zbiorze słownictwo faktur nie występuje, więc kolizja znika sama, a nie przez
   * łatanie wzorca — i dlatego wolno tu trzymać „serwis" oraz „technik", które przy
   * skanie całego słownika zapalałyby się na każdej fakturze za naprawę samochodu. Zdanie z `{{person}}` przechodzi zawsze: skoro pada imię, adresat
   * nie jest bezimienny, choćby stał obok słowa „IT".
   */
  /**
   * ZDANIA, KTÓRE DOMYKAJĄ trudny moment — jedyne, na których ciąży obowiązek wskazania
   * człowieka. Zakres z rundy poprzedniej obejmował cztery przedrostki i był ZA WĄSKI:
   * `composer.startFailed` („nie udało się zacząć sprawy") oraz `trail.failure.happened.*`
   * i `changed.*` to zakończenia w czystej postaci, a przechodziły bokiem — bo objęty
   * był wyłącznie `trail.failure.next.*`, czyli jedno z trzech zdań tej samej karty.
   *
   * Wszystkie te grupy to komunikaty systemu. Słownictwo faktur — „serwis", „technik",
   * „support" — w nich nie występuje, więc rozszerzenie zakresu nie wnosi z powrotem
   * kolizji, przez którą ta reguła była przepisywana.
   */
  const ENDING_PREFIXES = [
    /^trail\./,
    /^lock\./,
    /^failure\./,
    /^api\./,
    /^composer\./,
    /^mcp\./,
    /^promises\./,
    /^otherRequest\./,
  ]

  it("żadne zakończenie nie odsyła do bezimiennej władzy", () => {
    /** Klucze, które DOMYKAJĄ trudny moment — jedyne miejsce, gdzie odesłanie ma sens. */
    const ENDINGS = ENDING_PREFIXES
    // „dostawca" i „producent" świadomie POZA listą: w `mcp.*` to dostawca serwera
    // narzędzi, zwykły rzeczownik z opisu, a nie ktoś, do kogo odsyłamy człowieka.
    // Wpisane na próbę, dały trzy fałszywe alarmy na własnym słowniku i wyleciały.
    //
    // `\p{L}` zamiast `\w`, bo `\w` bez tego NIE OBEJMUJE polskich liter — przez to
    // „obsługa techniczna" było łapane, a „obsługę techniczną" przechodziło. Ten sam
    // błąd wracał tu dwa razy, więc znika razem z `\w`.
    const FACELESS =
      /admin\p{L}*|helpdesk|help[- ]desk|informatyk\p{L}*|serwis\p{L}*|technik\p{L}*|sysadmin\p{L}*|infolini\p{L}*|programi[sś][tc]\p{L}*|deweloper\p{L}*|dzia[łl]\p{L}* (?:techniczn\p{L}+|informatyczn\p{L}+)|wsparci\p{L}+|obs[łl]ug\p{L}+ techniczn\p{L}+|opiekun\p{L}* systemu|tech support|\bsupport(?:u|em|owi|cie)?\b(?!s)/iu
    const offenders: string[] = []
    const walk = (node: unknown, key: string) => {
      if (typeof node === "string") {
        if (!ENDINGS.some((one) => one.test(key.replace(/^(pl|en)\./, "")))) return
        // Imię własne w zdaniu znaczy, że adresat JEST wskazany — reszta zdania może
        // wtedy nazywać jego dział, i to jest pomoc, nie ściana.
        // Wskazanie człowieka znosi zarzut: imię podstawiane przez `{{person}}` ALBO
        // słowo „przełożony", które Biurko umie rozwinąć do imienia (`approver()`).
        if (node.includes("{{person}}") || /prze[łl]o[żz]on|manager|kierownik/iu.test(node)) return
        // Samo „IT" jako dział — WIELKIMI literami, i to nie jest drobiazg: z flagą `i`
        // angielskie „check whether it supports text" jest odesłaniem do działu IT.
        // Fałszywy alarm na własnym słowniku wrócił tą drogą raz i tędy nie wróci.
        if (FACELESS.test(node) || /\bIT\b/u.test(node)) offenders.push(`${key} = ${node}`)
        return
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) walk(v, key ? `${key}.${k}` : k)
      }
    }
    walk(pl, "pl")
    walk(en, "en")
    expect(offenders).toEqual([])
  })

  it("strażnik zakończeń w ogóle coś ogląda", () => {
    // Bez tego cały test wyżej mógłby być zielony dlatego, że zakres jest pusty —
    // wystarczyłaby zmiana nazwy grupy w słowniku i nikt by się nie dowiedział.
    const ENDINGS = ENDING_PREFIXES
    const counted: string[] = []
    const walk = (node: unknown, key: string) => {
      if (typeof node === "string") {
        if (ENDINGS.some((one) => one.test(key))) counted.push(key)
      } else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) walk(v, key ? `${key}.${k}` : k)
      }
    }
    walk(pl, "")
    expect(counted.length, "zbiór zakończeń jest pusty — reguła nie ma czego pilnować")
      .toBeGreaterThan(20)
  })

  it("żadne zdanie nie kończy się samą rolą, bez zadania", () => {
    // Ten sam ślepy zaułek, który zamknięto w `failure.ts`, wchodził tą drugą drogą:
    // przez słownik. „…zgłoś to administratorowi." jest CAŁĄ radą, jaką człowiek
    // dostawał — rola bez zadania, bez treści zgłoszenia, często zamiast czynności,
    // którą mógł wykonać sam. Wolno wymienić administratora czy przełożonego, ale nie
    // jako ostatnie słowo zdania.
    const DEAD_ENDS: Record<string, RegExp[]> = {
      pl: [/zgłoś to (administratorowi|przełożonemu)\.?$/i, /skontaktuj się z administratorem\.?$/i],
      en: [/report it to (your |the )?administrator\.?$/i, /contact (your |the )?administrator\.?$/i],
    }
    for (const locale of DESK_LOCALES) {
      const translate = makeDeskT(locale)
      const guilty = (locale === "pl" ? plKeys : enKeys).filter((key) =>
        (DEAD_ENDS[locale] ?? []).some((shape) => shape.test(translate(key).trim())),
      )
      expect(guilty, `${locale}: zdanie kończy się rolą bez zadania`).toEqual([])
    }
  })

  it("brak klucza oddaje sam klucz, a nie pustkę", () => {
    // Pusty napis znika z ekranu bez śladu i wygląda jak układ bez treści.
    expect(makeDeskT("pl")("nie.ma.takiego")).toBe("nie.ma.takiego")
  })
})
