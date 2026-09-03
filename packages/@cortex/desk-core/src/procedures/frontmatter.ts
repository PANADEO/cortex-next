// CZYTANIE `SKILL.md` — nasz nadzbiór wspólnego frontmattera, walidowany.
//
// DLACZEGO `SKILL.md`, skoro pojęcie nazywa się „procedura". Bo to nazwa FORMATU, nie
// pojęcia — tak jak mówimy „docx" o dokumencie. Frontmatter `name` + `description` jest
// wspólny dla Anthropic, VS Code, Cursora, Goose, OpenCode i Gemini CLI; jesteśmy
// konsumentem tego ekosystemu, nie jego właścicielem. Nasz nadzbiór dokłada `title`,
// `scope`, `loading` i `paths`.
//
// CO ODRZUCAMY I DLACZEGO GŁOŚNO (ADR-0001 §5). `scripts`, `allowed-tools`, `hooks`
// i `context: fork` są w tym formacie legalne, a u nas są zakazane: procedura to WYŁĄCZNIE
// tekst. Skrypt w procedurze byłby narzędziem bez bramki narzędziowej — czyli obejściem
// jedynego mechanizmu, na którym stoi zgoda przełożonego. Pominięcie ich po cichu byłoby
// gorsze niż odrzucenie: przełożony wgrałby plik, zobaczył „przyjęto" i żył w przekonaniu,
// że jego `hooks` działają.
//
// Parser jest własny i celowo maleńki. Wciągnięcie biblioteki YAML dla sześciu pól
// otworzyłoby cały YAML — z kotwicami, znacznikami typów i resztą powierzchni, której
// ten produkt nie potrzebuje, a musiałby pilnować.

/** Tryb wejścia procedury do tury. Znaczenia rozpisane w ADR-0001 §4. */
export type Loading = "index" | "always" | "paths"

export type Procedure = {
  name: string
  title: string
  description: string
  loading: Loading
  paths: string[]
  scope: string[]
  body: string
}

export type ParseCode =
  | "missing-frontmatter"
  | "missing-field"
  | "bad-name"
  | "bad-loading"
  | "paths-without-mode"
  | "mode-without-paths"
  | "forbidden-key"
  | "empty-body"

export class SkillProblem extends Error {
  constructor(
    public code: ParseCode,
    public detail = "",
  ) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = "SkillProblem"
  }
}

/**
 * Klucze, które w tym formacie znaczą „wykonaj coś". Każdy z nich obchodziłby bramkę
 * czynności, więc każdy kończy się odmową z nazwą klucza — człowiek ma wiedzieć, CO
 * dokładnie wyciąć, a nie szukać po omacku.
 */
const FORBIDDEN = ["scripts", "allowed-tools", "allowed_tools", "hooks", "context"]

/** Identyfikator: kebab, bo jest też nazwą katalogu i częścią adresu. */
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function parseSkill(text: string): Procedure {
  const trimmed = text.replace(/^﻿/, "")
  // Frontmatter musi otwierać plik. Bloku w środku nie szukamy z rozmysłu: plik, który
  // zaczyna się prozą, jest notatką, a nie procedurą, i ma to usłyszeć.
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(trimmed)
  if (!m) throw new SkillProblem("missing-frontmatter")
  const [, head, body = ""] = m

  const fields = new Map<string, string>()
  for (const raw of (head ?? "").split(/\r?\n/)) {
    const line = raw.trim()
    if (line === "" || line.startsWith("#")) continue
    const at = line.indexOf(":")
    if (at < 0) continue
    fields.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim())
  }

  for (const key of FORBIDDEN) {
    if (!fields.has(key)) continue
    // `context` jest zakazany tylko w znaczeniu `fork` — samo słowo bywa niewinne.
    if (key === "context" && !/fork/i.test(fields.get(key) ?? "")) continue
    throw new SkillProblem("forbidden-key", key)
  }

  const name = unquote(fields.get("name") ?? "")
  const title = unquote(fields.get("title") ?? "")
  const description = unquote(fields.get("description") ?? "")
  for (const [what, value] of [
    ["name", name],
    ["title", title],
    ["description", description],
  ] as const) {
    if (value === "") throw new SkillProblem("missing-field", what)
  }
  if (!NAME.test(name)) throw new SkillProblem("bad-name", name)

  const loadingRaw = unquote(fields.get("loading") ?? "index")
  if (loadingRaw !== "index" && loadingRaw !== "always" && loadingRaw !== "paths") {
    throw new SkillProblem("bad-loading", loadingRaw)
  }
  const loading: Loading = loadingRaw

  const paths = list(fields.get("paths"))
  const scope = list(fields.get("scope"))

  // Dwie połowy tej samej pomyłki, obie kończące się procedurą, która nigdy nie zadziała
  // i nigdy o tym nie powie: wzorce bez trybu (nikt ich nie czyta) i tryb bez wzorców
  // (nie ma czego dopasować).
  if (paths.length > 0 && loading !== "paths") throw new SkillProblem("paths-without-mode")
  if (loading === "paths" && paths.length === 0) throw new SkillProblem("mode-without-paths")

  const trimmedBody = body.trim()
  // Procedura bez treści weszłaby do indeksu, kosztowała w każdej turze i nie dała nic.
  if (trimmedBody === "") throw new SkillProblem("empty-body")

  return { name, title, description, loading, paths, scope, body: trimmedBody }
}

/** `["a", "b"]` albo `a, b` — obie formy spotyka się w tym formacie. */
function list(value: string | undefined): string[] {
  const raw = (value ?? "").trim()
  if (raw === "") return []
  const inner = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw
  return inner
    .split(",")
    .map((one) => unquote(one.trim()))
    .filter((one) => one !== "")
}

function unquote(value: string): string {
  const v = value.trim()
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1)
  }
  return v
}
