// Procedura, która nie zadziała, ma to POWIEDZIEĆ przy wgraniu — nie milczeć w turze.
//
// Ten plik pilnuje jednej reguły z ADR-0001 §5: procedura to WYŁĄCZNIE tekst, a plik
// niosący cokolwiek wykonywalnego jest odrzucany Z KOMUNIKATEM. Ciche pominięcie
// zakazanego klucza byłoby gorsze niż odrzucenie — przełożony zobaczyłby „przyjęto"
// i żył w przekonaniu, że jego `hooks` działają.

import { describe, expect, it } from "vitest"
import { parseSkill, SkillProblem } from "./frontmatter"

const ok = `---
name: zestawienie-vat
title: Zestawienie VAT
description: Jak składamy miesięczne zestawienie VAT.
---

Bierzemy faktury z katalogu Faktury i sumujemy po stawkach.`

/** Ten sam plik z jedną podmienioną albo dołożoną linią frontmattera. */
const withHead = (extra: string) => ok.replace("---\n\n", `${extra}\n---\n\n`)

const problem = (text: string) => {
  try {
    parseSkill(text)
  } catch (e) {
    if (e instanceof SkillProblem) return { code: e.code, detail: e.detail }
    throw e
  }
  return null
}

describe("czytanie SKILL.md", () => {
  it("przyjmuje plik minimalny i domyśla tryb `index`", () => {
    const p = parseSkill(ok)
    expect(p.name).toBe("zestawienie-vat")
    expect(p.title).toBe("Zestawienie VAT")
    expect(p.loading).toBe("index")
    expect(p.scope).toEqual([])
    expect(p.body).toContain("sumujemy po stawkach")
    // Frontmatter NIE MOŻE zostać w treści — poszedłby do modelu jako tekst procedury.
    expect(p.body).not.toContain("name:")
  })

  it("czyta listy w obu formach, w jakich ludzie je piszą", () => {
    expect(parseSkill(withHead("scope: [accounting, finance]")).scope).toEqual([
      "accounting",
      "finance",
    ])
    expect(parseSkill(withHead('scope: "accounting"')).scope).toEqual(["accounting"])
    expect(parseSkill(withHead("scope: accounting, finance")).scope).toEqual([
      "accounting",
      "finance",
    ])
  })

  it.each([
    ["scripts", "scripts: ./licz.py"],
    ["allowed-tools", "allowed-tools: [read_file]"],
    ["hooks", "hooks: pre-turn"],
    ["context", "context: fork"],
  ])("ODRZUCA plik z kluczem `%s` i nazywa winowajcę", (key, line) => {
    const p = problem(withHead(line))
    expect(p?.code).toBe("forbidden-key")
    // Sama odmowa nie wystarcza: człowiek ma wiedzieć, CO wyciąć.
    expect(p?.detail).toBe(key === "context" ? "context" : key)
  })

  it("nie odrzuca słowa `context` w niewinnym znaczeniu", () => {
    // Kontrola ujemna. Reguła, która zapala się na samym słowie, wycięłaby procedurę
    // opisującą „kontekst" pracy — a zakazany jest wyłącznie `fork`.
    expect(parseSkill(withHead("context: rozliczenia miesięczne")).name).toBe("zestawienie-vat")
  })

  it.each([
    ["bez frontmattera", "Bierzemy faktury i sumujemy.", "missing-frontmatter"],
    ["bez nazwy", ok.replace("name: zestawienie-vat\n", ""), "missing-field"],
    ["bez opisu", ok.replace(/description: .*\n/, ""), "missing-field"],
    ["nazwa nie-kebab", ok.replace("zestawienie-vat", "Zestawienie VAT"), "bad-name"],
    ["nieznany tryb", withHead("loading: magic"), "bad-loading"],
    ["wzorce bez trybu", withHead('paths: ["Moje pliki/Faktury"]'), "paths-without-mode"],
    ["tryb bez wzorców", withHead("loading: paths"), "mode-without-paths"],
    ["pusta treść", "---\nname: a\ntitle: A\ndescription: B\n---\n\n   ", "empty-body"],
  ])("odrzuca plik %s", (_what, text, code) => {
    expect(problem(text)?.code).toBe(code)
  })

  it("przyjmuje tryb `paths` razem ze wzorcami", () => {
    // Kontrola dodatnia do dwóch odmów wyżej: reguła ma odrzucać POŁOWĘ pary, nie parę.
    const p = parseSkill(withHead('loading: paths\npaths: ["Moje pliki/Faktury"]'))
    expect(p.loading).toBe("paths")
    expect(p.paths).toEqual(["Moje pliki/Faktury"])
  })
})
