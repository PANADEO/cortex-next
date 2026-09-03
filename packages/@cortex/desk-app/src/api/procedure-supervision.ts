import * as audit from "@cortex/desk-core/audit-log"
import { whoAmI } from "@cortex/desk-core/identity"
import { DEPARTMENTS, names } from "@cortex/desk-core/people"
import {
  parseSkill,
  SkillProblem,
  type Loading,
  type Procedure,
} from "@cortex/desk-core/procedures/frontmatter"
import { promptBlock } from "@cortex/desk-core/procedures/prompt-block"
import {
  allProcedures,
  editionsOf,
  procedureByName,
  publish,
  restore,
  withdraw,
  type StoredProcedure,
} from "@cortex/desk-core/procedures/store"
import { visibleFor } from "@cortex/desk-core/procedures/visible"
import type { DeskT } from "@cortex/desk-ui/i18n/locale"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * PROCEDURY OD STRONY PRZEŁOŻONEGO — to samo pytanie, co przy narzędziach MCP:
 * „co podpisałem, kiedy i czy mogę to wycofać".
 *
 * Bramka roli jest PO STRONIE SERWERA i jest jedyną, jaka się liczy. Zakładka na ekranie
 * nadzoru nie broni niczego — adres trasy da się wpisać ręcznie, a pracownik, który to
 * zrobi, wydawałby procedury całej firmie. Kształt odmowy jest przepisany z `mcp.ts`
 * co do wpisu w dzienniku, bo to ta sama granica.
 */
async function managerOnly() {
  const u = await whoAmI()
  if (u.role !== "management") {
    // `what` idzie do DZIENNIKA, nie na ekran — zostaje w języku instancji.
    await audit.write(u.id, "access.denied", { what: "procedury firmowe" })
    const translate = await deskT()
    return {
      u: null,
      refusal: NextResponse.json({ error: translate("api.managerOnly") }, { status: 403 }),
    }
  }
  return { u, refusal: null }
}

/** Wydanie w postaci, w jakiej czyta je człowiek: bez odcisku, z nazwiskiem albo bez. */
const edition = (
  one: { edition: number; author: string; at: string },
  people: Record<string, string>,
) => ({
  edition: one.edition,
  // Puste nazwisko znaczy „nikt tego nie podpisał" — tak jest przy zasiewie. Podstawienie
  // tam kogokolwiek byłoby zmyśleniem podpisu pod dokumentem, którym ludzie się bronią.
  signedBy: people[one.author] ?? null,
  at: one.at,
})

/** Ile znaków dokłada do KAŻDEJ tury ta jedna procedura. Zero, gdy nie jest `always`. */
const costOf = (p: StoredProcedure) => promptBlock([p]).alwaysChars

export async function GET() {
  const { u, refusal } = await managerOnly()
  if (!u) return refusal

  const [all, people] = await Promise.all([allProcedures(), names()])
  const withHistory = await Promise.all(
    all.map(async (p) => ({
      name: p.name,
      title: p.title,
      description: p.description,
      loading: p.loading,
      paths: p.paths,
      scope: p.scope,
      status: p.status,
      body: p.current.body,
      alwaysChars: costOf(p),
      ...edition(p.current, people),
      editions: (await editionsOf(p.name)).map((one) => edition(one, people)),
    })),
  )

  const active = all.filter((p) => p.status === "active")
  return NextResponse.json({
    departments: DEPARTMENTS,
    procedures: withHistory,
    // KOSZT LICZONY PER DZIAŁ, a nie jedną liczbą dla całej firmy. Zasięg sprawia, że
    // nie ma czegoś takiego jak „koszt procedur": księgowa płaci za swoje, marketing za
    // swoje. Jedna liczba byłaby średnią, której nie płaci nikt.
    alwaysCost: DEPARTMENTS.map((department) => ({
      department,
      chars: promptBlock(visibleFor(active, department)).alwaysChars,
    })),
  })
}

/**
 * NAZWA BIERZE SIĘ Z TYTUŁU, bo pole na nią byłoby polem, którego pani z księgowości nie
 * ma jak wypełnić sensownie — a jest kluczem głównym i częścią adresu.
 *
 * Ogonki schodzą przez rozkład Unicode; `ł` i `Ł` trzeba wymienić ręcznie, bo jako jedyne
 * polskie litery nie rozkładają się na literę bazową i znak diakrytyczny.
 */
export function nameFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export type Draft = {
  name: string
  title: string
  description: string
  loading: Loading
  paths: string[]
  scope: string[]
  body: string
}

/**
 * SKŁADANIE `SKILL.md` Z PÓL FORMULARZA — odwrotność `parseSkill`, i jedyna rzecz w tym
 * pliku, która wie cokolwiek o formacie.
 *
 * DLACZEGO W OGÓLE SKŁADAMY TEKST, skoro `publish` przyjmuje gotowy obiekt. Bo wtedy
 * walidacja byłaby DRUGA: musiałbym tu powtórzyć wzorzec nazwy, zakaz pustej treści
 * i obie połowy reguły o wzorcach ścieżek. Dwa zestawy reguł na to samo rozjeżdżają się
 * przy pierwszej poprawce w jednym z nich, a rozjazd wychodzi dopiero na pliku wgranym
 * ręcznie. Tekst przechodzi więc przez ten sam `parseSkill`, co plik od człowieka —
 * drugiej drogi wejścia procedury do produktu nie ma.
 *
 * Poprawność samego składania pilnuje PRZEBIEG TAM I Z POWROTEM w `readBack` niżej,
 * a nie moja wiara w to, że wszystkie znaki są niewinne.
 */
export function composeSkill(d: Draft): string {
  const head = [
    `name: ${d.name}`,
    `title: ${d.title}`,
    `description: ${d.description}`,
    `loading: ${d.loading}`,
    ...(d.paths.length > 0 ? [`paths: [${d.paths.join(", ")}]`] : []),
    ...(d.scope.length > 0 ? [`scope: [${d.scope.join(", ")}]`] : []),
  ]
  return `---\n${head.join("\n")}\n---\n\n${d.body}`
}

/** Jedna linia frontmattera nie zniesie łamania wiersza — zwijamy odstępy, nie treść. */
const oneLine = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()

const asList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : String(value ?? "").split("\n"))
    .map((one) => oneLine(one))
    .filter((one) => one !== "")

/**
 * Czy to, co poszło do tekstu, wróciło z niego bez zmian.
 *
 * Znak, którego format nie unosi — przecinek we wzorcu ścieżki, cudzysłów obejmujący cały
 * tytuł — nie wywala `parseSkill`. Daje procedurę, która wygląda na wydaną i niesie CO
 * INNEGO, niż człowiek wpisał. To jest cichsza szkoda niż odmowa, więc pilnujemy jej
 * porównaniem, a nie listą zakazanych znaków, która i tak byłaby niepełna.
 */
function readBack(draft: Draft, parsed: Procedure, translate: DeskT): NextResponse | null {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
  if (!same(parsed.paths, draft.paths)) {
    return NextResponse.json({ error: translate("api.procedureBadPath") }, { status: 400 })
  }
  if (
    parsed.name !== draft.name ||
    parsed.title !== draft.title ||
    parsed.description !== draft.description ||
    parsed.body !== draft.body.trim() ||
    !same(parsed.scope, draft.scope)
  ) {
    return NextResponse.json({ error: translate("api.procedureBroken") }, { status: 400 })
  }
  return null
}

/** Odmowa `parseSkill` przełożona na zdanie, które mówi, KTÓRE pole poprawić. */
function refusalFor(e: SkillProblem, translate: DeskT): NextResponse {
  const key =
    e.code === "bad-name" || (e.code === "missing-field" && e.detail === "name")
      ? "api.procedureBadTitle"
      : e.code === "missing-field"
        ? "api.procedureNeedsWords"
        : e.code === "mode-without-paths"
          ? "api.procedureNeedsPaths"
          : e.code === "empty-body"
            ? "api.procedureNeedsBody"
            : "api.procedureBroken"
  return NextResponse.json({ error: translate(key) }, { status: 400 })
}

export async function POST(req: Request) {
  const { u, refusal } = await managerOnly()
  if (!u) return refusal
  const d = await req.json()
  const translate = await deskT()

  /**
   * LICZNIK KOSZTU DLA TEKSTU, KTÓRY JESZCZE NIE ISTNIEJE.
   *
   * Liczy go `promptBlock`, czyli ta sama funkcja, która składa prompt tury — powtórzenie
   * wzoru w przeglądarce dałoby liczbę, która zgadza się dziś i rozjeżdża po pierwszej
   * zmianie nagłówka bloku. Wtedy przełożony podejmowałby decyzję o wydatku na podstawie
   * liczby, której nikt nie płaci.
   */
  if (d.action === "measure") {
    return NextResponse.json({
      alwaysChars: promptBlock([
        {
          name: "draft",
          title: oneLine(d.title),
          description: "",
          loading: "always",
          paths: [],
          scope: [],
          status: "active",
          origin: "human",
          current: {
            edition: 1,
            body: String(d.body ?? "").trim(),
            author: u.id,
            fingerprint: "",
            at: new Date().toISOString(),
          },
        },
      ]).alwaysChars,
    })
  }

  if (d.action === "withdraw" || d.action === "restore") {
    const found = await procedureByName(String(d.name ?? ""))
    if (!found) {
      return NextResponse.json({ error: translate("api.procedureNoSuch") }, { status: 404 })
    }
    if (d.action === "withdraw") await withdraw(u.id, found.name)
    else await restore(u.id, found.name)
    return NextResponse.json({ ok: true })
  }

  if (d.action === "publish") {
    const loading: Loading = d.loading === "always" || d.loading === "paths" ? d.loading : "index"
    // Wzorce ścieżek NALEŻĄ do trybu `paths` i tylko do niego. Przełożony, który wpisał
    // foldery i zmienił zdanie co do trybu, ma dostać to, co wybrał ostatnie — a nie
    // odmowę o „wzorcach bez trybu", której nie ma jak powiązać z żadnym swoim ruchem.
    const paths = loading === "paths" ? asList(d.paths) : []
    const scope = asList(d.scope)
    const unknown = scope.filter((one) => !DEPARTMENTS.includes(one))
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: translate("api.procedureNoSuchDepartment") },
        { status: 400 },
      )
    }

    const title = oneLine(d.title)
    // Nazwa istniejącej procedury jest DANA, nie liczona z tytułu: kolejne wydanie ma
    // zostać kolejnym wydaniem TEJ SAMEJ rzeczy także wtedy, gdy przełożony poprawił
    // w tytule literówkę. Liczenie z tytułu założyłoby wtedy drugą procedurę obok.
    const existing = d.name ? await procedureByName(String(d.name)) : null
    if (d.name && !existing) {
      return NextResponse.json({ error: translate("api.procedureNoSuch") }, { status: 404 })
    }
    const draft: Draft = {
      name: existing?.name ?? nameFromTitle(title),
      title,
      description: oneLine(d.description),
      loading,
      paths,
      scope,
      body: String(d.body ?? "").trim(),
    }
    // Nowa procedura o nazwie już zajętej to NIE jest kolejne wydanie tamtej. Ciche
    // dopisanie wydania podmieniłoby komuś tekst podpisany jego nazwiskiem.
    if (!existing && (await procedureByName(draft.name))) {
      return NextResponse.json({ error: translate("api.procedureExists") }, { status: 409 })
    }

    let parsed: Procedure
    try {
      parsed = parseSkill(composeSkill(draft))
    } catch (e) {
      if (e instanceof SkillProblem) return refusalFor(e, translate)
      throw e
    }
    const mismatch = readBack(draft, parsed, translate)
    if (mismatch) return mismatch

    return NextResponse.json({ edition: await publish(u.id, parsed) })
  }

  return NextResponse.json({ error: translate("api.unknownAction") }, { status: 400 })
}
