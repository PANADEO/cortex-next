#!/usr/bin/env node
/**
 * Partia do tłumaczenia — składa napis z jego kontekstem w jedną pozycję.
 *
 * POWÓD ISTNIENIA. Kontekst dla tłumacza siedzi w sekcji `_ctx`, płaskim
 * bloku na górze pliku, a napisy leżą w zagnieżdżonej strukturze pod nim.
 * Tak MUSI być: i18next wymaga, żeby wartością klucza był napis, więc metadanej
 * nie da się położyć obok. Skutek uboczny jest jednak dotkliwy — w pliku z 818
 * kluczami kontekst i opisywany przez niego napis dzieli tysiąc linii, więc
 * czytając plik nie widzi się ich razem.
 *
 * Ten skrypt składa je z powrotem: na wyjściu każda pozycja niesie klucz,
 * napis źródłowy, kontekst i dotychczasowe tłumaczenie.
 *
 * WYDANIE PARTII
 *   node scripts/i18n-batch.mjs export <język> [przestrzeń…] [--missing]
 *
 * PRZYJĘCIE PARTII (ten sam kształt, uzupełniony o `target`)
 *   node scripts/i18n-batch.mjs import <plik.json>
 *
 * `--missing` wydaje wyłącznie to, czego w języku docelowym jeszcze nie ma —
 * przy dokładaniu języka to jest normalny tryb pracy.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const LOCALES_DIR = path.join(process.cwd(), "app/idp/locales")
const SOURCE = "pl"
const CONTEXT_KEY = "_ctx"

function flatten(value, prefix = "") {
  if (value === null || typeof value !== "object") return [[prefix, value]]
  return Object.entries(value).flatMap(([key, child]) =>
    key === CONTEXT_KEY ? [] : flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function load(locale, namespace) {
  const file = path.join(LOCALES_DIR, locale, `${namespace}.json`)
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return {}
  }
}

function setDeep(target, dottedKey, value) {
  const parts = dottedKey.split(".")
  let node = target
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object" || node[part] === null) node[part] = {}
    node = node[part]
  }
  node[parts[parts.length - 1]] = value
}

/**
 * Kolejność kluczy zostaje TAKA, JAKA BYŁA. Kuszące alfabetyczne sortowanie
 * przy zapisie daje przy pierwszym imporcie diff na cały plik — jedna zmieniona
 * wartość ginie wtedy wśród kilkudziesięciu przestawionych linii, a przegląd
 * takiej zmiany nic nie wnosi. Nowe klucze dopisują się tam, gdzie wypadną.
 */
function namespaces() {
  return readdirSync(path.join(LOCALES_DIR, SOURCE))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
}

function doExport(target, wanted, onlyMissing) {
  const list = wanted.length ? wanted : namespaces()
  const batches = list.map((namespace) => {
    const source = load(SOURCE, namespace)
    const context = source[CONTEXT_KEY] ?? {}
    const existing = Object.fromEntries(flatten(load(target, namespace)))
    const entries = flatten(source)
      .filter(([key]) => !onlyMissing || existing[key] === undefined)
      .map(([key, value]) => ({
        key,
        source: value,
        context: context[key] ?? null,
        target: existing[key] ?? null,
      }))
    return { namespace, entries }
  })
  const withWork = batches.filter((batch) => batch.entries.length > 0)
  return { sourceLocale: SOURCE, targetLocale: target, namespaces: withWork }
}

function doImport(file) {
  const batch = JSON.parse(readFileSync(file, "utf8"))
  const target = batch.targetLocale
  if (!target) throw new Error("partia nie mówi, do jakiego języka należy (targetLocale)")
  let written = 0
  for (const { namespace, entries } of batch.namespaces) {
    const current = load(target, namespace)
    for (const entry of entries) {
      if (typeof entry.target !== "string" || entry.target === "") continue
      setDeep(current, entry.key, entry.target)
      written += 1
    }
    const file = path.join(LOCALES_DIR, target, `${namespace}.json`)
    writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`)
  }
  return written
}

const [command, ...rest] = process.argv.slice(2)

if (command === "export") {
  const onlyMissing = rest.includes("--missing")
  const args = rest.filter((arg) => !arg.startsWith("--"))
  const [target, ...wanted] = args
  if (!target) {
    console.error("użycie: i18n-batch.mjs export <język> [przestrzeń…] [--missing]")
    process.exit(1)
  }
  process.stdout.write(`${JSON.stringify(doExport(target, wanted, onlyMissing), null, 2)}\n`)
} else if (command === "import") {
  const [file] = rest
  if (!file) {
    console.error("użycie: i18n-batch.mjs import <plik.json>")
    process.exit(1)
  }
  console.error(`wpisanych tłumaczeń: ${doImport(file)}`)
} else {
  console.error("polecenia: export | import")
  process.exit(1)
}
