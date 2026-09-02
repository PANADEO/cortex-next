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
   * ŻADNE ZDANIE NIE ODSYŁA DO BEZIMIENNEJ WŁADZY.
   *
   * Ten ślepy zaułek wracał w tym produkcie DWA RAZY. Najpierw siedział w `failure.ts`
   * („zgłoś to administratorowi"), został stamtąd usunięty — i wrócił tydzień później
   * w słowniku przebiegu, przy okazji przebudowy kroku, który padł. Pani Basia nie wie,
   * kto to administrator, nie ma jego numeru i nie ma jak go zapytać; zdanie, które ją
   * tam odsyła, kończy się dla niej ścianą i powrotem do robienia ręcznie.
   *
   * Wolno odesłać do PRZEŁOŻONEGO, bo tę osobę Biurko umie wskazać z imienia
   * (`approver()` w `people.ts`), i wolno powiedzieć, że asystent zgłosi rzecz sam.
   * Nie wolno odesłać do nikogo.
   */
  it("żadne zdanie nie odsyła do bezimiennej władzy", () => {
    // Lista rośnie po każdej próbie obejścia. Weryfikator przeszedł przez „admin",
    // „informatyk" i „dział techniczny" — żadne nie było w pierwszej wersji, a każde
    // odsyła Basię dokładnie tam samo: do kogoś, kogo nie zna i nie ma jak zapytać.
    const FACELESS =
      /\badmin\w*|helpdesk|help desk|informatyk\w*|serwisant\w*|wsparci\w+ (?:techniczn\w*|IT)|dzia[łl]\w* (?:IT|techniczn\w+)|dzia[łl]\w+ techniczn\w+|support (?:team|desk)|IT (?:department|support)|obs[łl]ug[aię] techniczn\w+/i
    const offenders: string[] = []
    const walk = (node: unknown, key: string) => {
      if (typeof node === "string") {
        if (FACELESS.test(node)) offenders.push(`${key} = ${node}`)
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
