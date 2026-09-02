#!/usr/bin/env node
/**
 * POMIAR KONTRASTU PALETY BIURKA — WCAG 2.1 AA, liczony z plików repozytorium.
 *
 * POWÓD ISTNIENIA. Konsylium podało dla tokenu `warn` dwie liczby naraz — 2,14:1
 * i 4,35:1 — i obie były policzone POPRAWNIE. Rozjazd brał się z tego, że
 * `desk.css` deklaruje `--desk-warn` dwa razy: raz jako własną wartość Biurka
 * (§1), a zaraz potem jako `var(--warning)` z powłoki (§1b, mostek). Oba bloki
 * siedzą na `:root`, mają równą swoistość i rozstrzyga je KOLEJNOŚĆ, więc
 * widać wyłącznie drugą — a kto czytał §1, mierzył kolor, którego nikt nigdy
 * nie zobaczył. Dokładnie tak samo rozjeżdża się tło: §1 daje `--desk-surface`
 * kremowe `35 40% 99%`, a mostek białe `var(--card)`.
 *
 * Dlatego ten skrypt nie czyta wartości „z góry pliku”, tylko ODTWARZA KASKADĘ:
 * bierze arkusze w tej samej kolejności, w jakiej wciąga je aplikacja, układa
 * reguły po swoistości i kolejności, rozwija `var()` do końca łańcucha i dopiero
 * wtedy liczy. Następnym razem nikt nie zgaduje — uruchamia.
 *
 * URUCHOMIENIE
 *   node scripts/kontrast-tokenow.mjs              cała macierz: skórki × motywy
 *   node scripts/kontrast-tokenow.mjs --failures   tylko pary poniżej progu
 *   node scripts/kontrast-tokenow.mjs --sources    skąd pochodzi każdy token
 *   node scripts/kontrast-tokenow.mjs warn         filtr po nazwie pary
 *
 * Kod wyjścia 1, gdy choć jedna para jest poniżej progu — skrypt nadaje się
 * więc na bramkę. Bramką dla Biurka jest jednak `apps/desk/e2e/15-dostepnosc.spec.ts`,
 * który mierzy to samo W PRZEGLĄDARCE i importuje stąd listę par: liczy silnik
 * renderujący, a nie druga implementacja tej samej arytmetyki.
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

/**
 * Korzeń repozytorium szukany W GÓRĘ OD KATALOGU ROBOCZEGO, a nie z `import.meta.url`.
 *
 * Powód jest konkretny: ten plik importuje też scenariusz `apps/desk/e2e/15-dostepnosc.spec.ts`,
 * a Playwright przepisuje wciągane moduły na CommonJS — `import.meta` w takim pliku
 * przestaje istnieć i cały zestaw wywraca się na „Cannot use 'import.meta' outside a module”,
 * zanim wykona się choć jeden test. Szukanie w górę działa i spod korzenia (`npm run
 * kontrast:pomiar`), i spod `apps/desk` (tak uruchamia się bramka Playwrighta).
 */
function findRepoRoot(start) {
  let directory = path.resolve(start)
  while (!existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    const above = path.dirname(directory)
    if (above === directory) {
      throw new Error(`nie znalazłem korzenia repozytorium (pnpm-workspace.yaml) powyżej ${start}`)
    }
    directory = above
  }
  return directory
}

const repoRoot = findRepoRoot(process.cwd())

/**
 * Arkusze W KOLEJNOŚCI WCZYTANIA — ta kolejność jest częścią pomiaru, nie
 * porządkiem alfabetycznym. Wynika z `apps/desk/src/app/globals.css`: najpierw
 * tokeny powłoki, potem mostek Biurka, który część z nich przejmuje.
 */
export const STYLESHEETS = [
  "packages/@cortex/styles/globals.css",
  "packages/@cortex/styles/desk.css",
]

/** Plik, z którego role Biurka biorą swoje wyrażenia kolorów (także `color-mix`). */
const TAILWIND_CONFIG = "tailwind.config.ts"

/**
 * Skórki i motywy jako ZBIÓR KLAS NA `<html>` — bo tak to działa naprawdę:
 * `.skin-*` i `.dark` siadają na tym samym elemencie co `:root`, a nie zagnieżdżają się.
 * Każda pozycja to jeden przebieg pomiaru.
 */
export const SKINS = [
  { name: "domyślna · jasny", classes: [] },
  { name: "domyślna · ciemny", classes: ["dark"] },
  { name: "customs · jasny", classes: ["skin-customs"] },
  { name: "customs · ciemny", classes: ["skin-customs", "dark"] },
  { name: "domino · jasny", classes: ["skin-domino"] },
  { name: "domino · ciemny", classes: ["skin-domino", "dark"] },
]

/**
 * Progi WCAG 2.1 AA. `text` to 1.4.3 (tekst normalny — Biurko nie ma ani jednej
 * pary, w której kolor występowałby WYŁĄCZNIE w napisie ≥18,66 px albo ≥14 px
 * pogrubionym, więc ulga dla dużego tekstu nikomu się tu nie należy).
 * `control` to 1.4.11: obrys skupienia, wypełnienie przycisku, uchwyt paska
 * przewijania — rzeczy, po których poznaje się granicę sterowania.
 */
export const FLOORS = { text: 4.5, control: 3 }

/**
 * ZNANE ODSTĘPSTWA — pary, o których wiemy, że są poniżej progu, i na które jest zgoda.
 *
 * DLACZEGO TU, A NIE W TEŚCIE. Ta lista stała najpierw wyłącznie w e2e, a skrypt jej nie
 * znał — więc `npm run kontrast:pomiar` kończył się kodem 1 na zdrowym drzewie, podczas
 * gdy test na tym samym drzewie był zielony. Dwa źródła prawdy o tym, co jest dopuszczalne,
 * to DOKŁADNIE ta klasa defektu, przez którą powstał spór o kontrast `warn`: jedna wartość
 * deklarowana w dwóch miejscach i nikt nie wie, które wygrywa. Lista mieszka więc tam,
 * gdzie mieszka pomiar, a test ją stąd importuje.
 *
 * Wpis na tej liście jest ZGODĄ, nie schowkiem: osobny test pilnuje, że lista może tylko
 * maleć, więc pozycja, która przestała być odstępstwem, musi z niej zniknąć.
 */
export const KNOWN_BELOW = [
  "domyślna · jasny — desk-muted-2 na desk-surface (tekst)", // 2,83:1
  "domyślna · jasny — desk-muted-2 na desk-raised (tekst)", // 2,59:1
  "domyślna · jasny — desk-line-strong na desk-surface (element)", // 1,66:1
  "domyślna · ciemny — desk-muted-2 na desk-surface (tekst)", // 3,37:1
  "domyślna · ciemny — desk-muted-2 na desk-raised (tekst)", // 2,84:1
  "domyślna · ciemny — desk-line-strong na desk-surface (element)", // 2,23:1
  "customs · jasny — desk-muted-2 na desk-surface (tekst)", // 3,22:1
  "customs · jasny — desk-muted-2 na desk-raised (tekst)", // 2,93:1
  "customs · jasny — desk-accent na desk-surface (tekst)", // 3,23:1
  "customs · jasny — desk-line-strong na desk-surface (element)", // 1,63:1
  "customs · ciemny — desk-muted-2 na desk-surface (tekst)", // 3,42:1
  "customs · ciemny — desk-muted-2 na desk-raised (tekst)", // 3,02:1
  "customs · ciemny — desk-line-strong na desk-surface (element)", // 2,07:1
  "domino · jasny — desk-muted-2 na desk-surface (tekst)", // 2,96:1
  "domino · jasny — desk-muted-2 na desk-raised (tekst)", // 2,59:1
  "domino · jasny — desk-line-strong na desk-surface (element)", // 1,53:1
  "domino · ciemny — desk-muted-2 na desk-surface (tekst)", // 3,11:1
  "domino · ciemny — desk-muted-2 na desk-raised (tekst)", // 3,16:1
  "domino · ciemny — desk-line-strong na desk-surface (element)", // 1,99:1
]

/**
 * PARY „treść na swoim tle”. Każda ma wskazane miejsce w kodzie — para bez
 * miejsca użycia mierzyłaby wyobrażenie o produkcie, a nie produkt.
 *
 * ŚWIADOMIE POZA LISTĄ:
 *  · `desk-line` i `desk-accent-soft-line` jako cienkie kreski rozdzielające —
 *    1.4.11 dotyczy granic STEROWANIA i grafik niosących treść, nie ozdób;
 *  · warianty z przezroczystością (`bg-desk-raised/60`) — ich wynik zależy od
 *    tego, co leży pod spodem, więc nie da się ich zmierzyć samą paletą;
 *  · kolory, które są WYŁĄCZNIE wypełnieniem kropki stanu (`ok`, `warn`, `bad`),
 *    nie dostają osobnego wpisu z progiem 3:1 — te same tokeny stoją niżej jako
 *    tekst z progiem 4,5:1, a ostrzejszy próg pochłania łagodniejszy.
 */
export const PAIRS = [
  // ── tekst ────────────────────────────────────────────────────────────────
  { ink: "desk-ink", ground: "desk-bg", role: "text", why: "treść na tle strony" },
  { ink: "desk-ink", ground: "desk-surface", role: "text", why: "treść na karcie (bg-desk-surface, 51 użyć)" },
  { ink: "desk-ink", ground: "desk-raised", role: "text", why: "treść na tle podniesionym (bg-desk-raised, 70 użyć)" },
  { ink: "desk-ink", ground: "desk-sunken", role: "text", why: "`code` w treści dokumentu (prose-desk)" },
  { ink: "desk-ink", ground: "desk-warn-soft", role: "text", why: "zakładka przekroju z ostrzeżeniem (section-tabs.tsx:60)" },
  { ink: "desk-ink-2", ground: "desk-surface", role: "text", why: "drugi stopień atramentu na karcie" },
  { ink: "desk-muted", ground: "desk-bg", role: "text", why: "podpis `t-meta` na tle strony" },
  { ink: "desk-muted", ground: "desk-surface", role: "text", why: "podpis `t-meta` na karcie (text-desk-muted, 91 użyć)" },
  { ink: "desk-muted", ground: "desk-raised", role: "text", why: "podpis w pasku i na liście" },
  { ink: "desk-muted-2", ground: "desk-surface", role: "text", why: "podpowiedź w polu zlecenia (composer.tsx:155)" },
  { ink: "desk-muted-2", ground: "desk-raised", role: "text", why: "przygaszony podpis na tle podniesionym" },
  { ink: "desk-accent", ground: "desk-surface", role: "text", why: "napis akcji (text-desk-accent, 10 użyć)" },
  { ink: "desk-accent-ink", ground: "desk-accent", role: "text", why: "etykieta na przycisku akcji (11 użyć)" },
  { ink: "desk-accent-soft-ink", ground: "desk-accent-soft", role: "text", why: "dymek rozmowy i plakietka osoby (case-view.tsx:812)" },
  { ink: "desk-warn", ground: "desk-surface", role: "text", why: "ostrzeżenie na karcie (mcp-supervision.tsx:116)" },
  { ink: "desk-warn", ground: "desk-raised", role: "text", why: "ostrzeżenie w śladzie działań (activity-trail.tsx:183)" },
  { ink: "desk-warn", ground: "desk-warn-soft", role: "text", why: "karta limitu i awarii (result-panel.tsx:136)" },
  { ink: "desk-ok", ground: "desk-surface", role: "text", why: "potwierdzenie na karcie (activity-trail.tsx:219)" },
  { ink: "desk-ok", ground: "desk-raised", role: "text", why: "potwierdzenie w liście zespołu (team.tsx:215)" },
  { ink: "desk-bad", ground: "desk-surface", role: "text", why: "błąd na karcie (text-desk-bad, 7 użyć)" },
  { ink: "desk-bad", ground: "desk-raised", role: "text", why: "błąd na tle podniesionym (memory-list.tsx:149)" },
  // ── elementy interfejsu ──────────────────────────────────────────────────
  { ink: "desk-focus", ground: "desk-bg", role: "control", why: "obrys skupienia na tle strony" },
  { ink: "desk-focus", ground: "desk-surface", role: "control", why: "obrys skupienia na karcie" },
  { ink: "desk-accent", ground: "desk-bg", role: "control", why: "wypełnienie przycisku na tle strony (bg-desk-accent, 19 użyć)" },
  { ink: "desk-accent", ground: "desk-surface", role: "control", why: "wypełnienie przycisku na karcie" },
  { ink: "desk-line-strong", ground: "desk-surface", role: "control", why: "uchwyt paska przewijania (desk.css §3)" },
]

/**
 * Czytelna nazwa pary — ta sama w raporcie skryptu i w komunikacie testu.
 * Rola jest częścią nazwy, bo ta sama para kolorów bywa na liście dwa razy z dwoma
 * progami: akcent na karcie jest i napisem akcji (4,5:1), i wypełnieniem przycisku (3:1).
 */
export const label = (pair) => `${pair.ink} na ${pair.ground} (${pair.role === "text" ? "tekst" : "element"})`

/* ══ 1. KASKADA ═══════════════════════════════════════════════════════════ */

const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "")

/** Deklaracje własności niestandardowych z ciała reguły. */
function declarations(body) {
  const found = new Map()
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    found.set(name, value.trim())
  }
  return found
}

/**
 * Reguły w kolejności dokumentu. `@layer base` jest PRZEZROCZYSTE — w tym
 * repozytorium wszystkie tokeny powłoki siedzą właśnie w nim, a reguła
 * wewnątrz warstwy zachowuje swoją swoistość. Pozostałe reguły `@` (`@media`,
 * `@keyframes`, `@supports`) są pomijane: nie deklarują ani jednego koloru.
 */
function rules(css, file, collected) {
  let index = 0
  let start = 0
  while (index < css.length) {
    const sign = css[index]
    if (sign === "{") {
      const selector = css.slice(start, index).trim()
      let depth = 1
      let end = index + 1
      while (end < css.length && depth > 0) {
        if (css[end] === "{") depth += 1
        else if (css[end] === "}") depth -= 1
        end += 1
      }
      const body = css.slice(index + 1, end - 1)
      if (selector.startsWith("@layer")) rules(body, file, collected)
      else if (!selector.startsWith("@")) {
        collected.push({ file, selector, declarations: declarations(body), order: collected.length })
      }
      index = end
      start = end
    } else if (sign === "}" || sign === ";") {
      // `;` na najwyższym poziomie kończy dyrektywę (`@tailwind utilities;`). Bez tego
      // selektorem najbliższej reguły staje się cała dyrektywa razem z nią — a wtedy
      // `@layer base` wygląda jak `@tailwind` i CAŁA paleta powłoki wypada z pomiaru.
      index += 1
      start = index
    } else {
      index += 1
    }
  }
  return collected
}

/**
 * Czy selektor trafia w `<html>` o danym zbiorze klas.
 *
 * Bierzemy WYŁĄCZNIE selektory złożone na jednym elemencie (`:root`, `.dark`,
 * `.skin-domino.dark`). Wszystko z potomkiem albo z typem elementu (`.dark .desk`,
 * `html, body`) odpada — i tak nie deklaruje kolorów, a udawanie, że umiemy je
 * dopasować, byłoby cichym źródłem błędu.
 */
function matches(selector, classes) {
  return selector.split(",").some((part) => {
    const one = part.trim()
    if (!/^(?::root|\.[A-Za-z0-9_-]+)+$/.test(one)) return false
    return (one.match(/\.[A-Za-z0-9_-]+/g) ?? []).every((name) => classes.includes(name.slice(1)))
  })
}

/** Swoistość liczona tak, jak liczy ją przeglądarka: klasy i pseudoklasy do jednego worka. */
const weight = (selector) =>
  Math.max(
    ...selector.split(",").map((part) => (part.trim().match(/[.:][A-Za-z0-9_-]+/g) ?? []).length),
  )

const stylesheets = () =>
  STYLESHEETS.reduce(
    (collected, file) =>
      rules(withoutComments(readFileSync(path.join(repoRoot, file), "utf8")), file, collected),
    [],
  )

/**
 * Wartości tokenów widziane przez `<html>` o danych klasach — po kaskadzie.
 * Reguły o wyższej swoistości wygrywają; przy równej rozstrzyga kolejność.
 */
export function environment(classes) {
  const applied = stylesheets()
    .filter((rule) => matches(rule.selector, classes))
    .sort((first, second) => weight(first.selector) - weight(second.selector) || first.order - second.order)
  const values = new Map()
  for (const rule of applied) {
    for (const [name, value] of rule.declarations) values.set(name, value)
  }
  return values
}

/** Wszystkie reguły deklarujące dany token — dla trybu `--sources`. */
export function origins(token, classes) {
  return stylesheets()
    .filter((rule) => matches(rule.selector, classes) && rule.declarations.has(token))
    .sort((first, second) => weight(first.selector) - weight(second.selector) || first.order - second.order)
    .map((rule) => ({ file: rule.file, selector: rule.selector, value: rule.declarations.get(token) }))
}

/** Rozwija `var(--x)` (także z wartością zapasową) do końca łańcucha. */
function expand(value, values, seen = new Set()) {
  const at = value.indexOf("var(")
  if (at < 0) return value
  let depth = 0
  let end = at + 4
  while (end < value.length) {
    if (value[end] === "(") depth += 1
    else if (value[end] === ")") {
      if (depth === 0) break
      depth -= 1
    }
    end += 1
  }
  const inside = value.slice(at + 4, end)
  const comma = inside.indexOf(",")
  const name = (comma < 0 ? inside : inside.slice(0, comma)).trim()
  const spare = comma < 0 ? "" : inside.slice(comma + 1).trim()
  if (seen.has(name)) throw new Error(`pętla w tokenach: ${name}`)
  const found = values.has(name) ? values.get(name) : spare
  const replaced = value.slice(0, at) + expand(found, values, new Set([...seen, name])) + value.slice(end + 1)
  return expand(replaced, values, seen)
}

/* ══ 2. KOLORY ════════════════════════════════════════════════════════════ */

/** Rozbija listę argumentów po przecinkach NAJWYŻSZEGO poziomu. */
function split(text) {
  const parts = []
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1
    else if (text[index] === ")") depth -= 1
    else if (text[index] === "," && depth === 0) {
      parts.push(text.slice(start, index))
      start = index + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((part) => part.trim())
}

/** Zawartość pierwszej pary nawiasów. */
function inside(text) {
  const open = text.indexOf("(")
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1
    else if (text[index] === ")") {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, index)
    }
  }
  throw new Error(`niedomknięty nawias: ${text}`)
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const sector = ((hue % 360) + 360) / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const base = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.floor(sector) % 6]
  const offset = lightness - chroma / 2
  return base.map((channel) => (channel + offset) * 255)
}

const toLinear = (value) => {
  const unit = value / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

const fromLinear = (value) => {
  const clamped = Math.min(1, Math.max(0, value))
  return 255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055)
}

/**
 * sRGB → OKLab i z powrotem (macierze Björna Ottossona). Potrzebne, bo połowa
 * ról Biurka nie jest tokenem, tylko `color-mix(in oklab, …)` w konfiguracji
 * Tailwinda — `desk-muted-2`, `desk-warn-soft`, `desk-accent-soft` i pozostałe
 * miękkie tła powstają dopiero tam.
 */
function toOklab([red, green, blue]) {
  const r = toLinear(red)
  const g = toLinear(green)
  const b = toLinear(blue)
  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ]
}

function fromOklab([lightness, greenRed, blueYellow]) {
  const long = (lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3
  const medium = (lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3
  const short = (lightness - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3
  return [
    fromLinear(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    fromLinear(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    fromLinear(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  ]
}

/** Wyrażenie koloru → sRGB 0–255. Obsługuje to, czego naprawdę używa konfiguracja. */
export function color(expression, values) {
  const text = expand(expression, values).trim()
  if (text.startsWith("#")) {
    const hex = text.slice(1)
    const wide = hex.length === 3 ? [...hex].map((sign) => sign + sign) : hex.match(/../g)
    return wide.slice(0, 3).map((pair) => Number.parseInt(pair, 16))
  }
  if (text.startsWith("hsl")) {
    const [hue, saturation, lightness] = split(inside(text).replace(/\//g, " ").replace(/\s+/g, " "))
      .flatMap((part) => part.split(" "))
      .filter(Boolean)
      .map(Number.parseFloat)
    return hslToRgb(hue, saturation / 100, lightness / 100)
  }
  if (text.startsWith("color-mix")) {
    const [space, first, second] = split(inside(text))
    if (space.trim() !== "in oklab") throw new Error(`nieobsługiwana przestrzeń mieszania: ${space}`)
    const share = (part) => {
      const found = part.match(/(-?[\d.]+)%\s*$/)
      return found ? Number.parseFloat(found[1]) / 100 : null
    }
    const bare = (part) => part.replace(/(-?[\d.]+)%\s*$/, "").trim()
    const firstShare = share(first) ?? (share(second) === null ? 0.5 : 1 - share(second))
    const one = toOklab(color(bare(first), values))
    const other = toOklab(color(bare(second), values))
    return fromOklab(one.map((channel, index) => channel * firstShare + other[index] * (1 - firstShare)))
  }
  throw new Error(`nieznane wyrażenie koloru: ${text}`)
}

/** Względna luminancja wg WCAG. */
const luminance = ([red, green, blue]) =>
  0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)

/** Stosunek kontrastu wg WCAG — jedna implementacja na repozytorium. */
export function contrast(one, other) {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((first, second) => second - first)
  return (lighter + 0.05) / (darker + 0.05)
}

/* ══ 3. ROLE Z KONFIGURACJI TAILWINDA ═════════════════════════════════════ */

/**
 * Wyrażenia kolorów ról `desk-*` czytane WPROST z `tailwind.config.ts`, a nie
 * przepisane tutaj. Przepisana kopia rozjechałaby się z konfiguracją po pierwszej
 * zmianie i to ona byłaby ostatnią rzeczą, o której ktoś by pomyślał.
 *
 * Odfiltrowane są wpisy `desk-*` spoza palety (miary, promienie, cienie) — po
 * KSZTAŁCIE wartości, bo tylko kolor zaczyna się od `hsl(`, `color-mix(` albo `#`.
 */
export function deskColors() {
  const source = readFileSync(path.join(repoRoot, TAILWIND_CONFIG), "utf8")
  const found = new Map()
  for (const [, key, value] of source.matchAll(/"(desk-[a-z0-9-]+)":\s*"([^"]+)"/g)) {
    if (/^(hsl\(|color-mix\(|#)/.test(value)) found.set(key, value)
  }
  return found
}

/**
 * Klasy skórek, jakie NAPRAWDĘ stoją w arkuszu powłoki.
 *
 * Istnieje po to, żeby nowa skórka nie mogła wejść do repozytorium bez pomiaru:
 * `SKINS` wyżej jest listą pisaną ręcznie, więc bez tej konfrontacji dopisanie
 * `.skin-nowa` do `globals.css` zostawiłoby ją niezmierzoną i nikt by się nie
 * dowiedział — a każda skórka ma własną paletę i to jest cały sens tego pomiaru.
 */
export function skinClasses() {
  const css = readFileSync(path.join(repoRoot, STYLESHEETS[0]), "utf8")
  return [...new Set([...css.matchAll(/\.(skin-[a-z0-9-]+)/g)].map(([, name]) => name))].sort()
}

/* ══ 4. POMIAR ════════════════════════════════════════════════════════════ */

export function measure() {
  const roles = deskColors()
  return SKINS.flatMap((skin) => {
    const values = environment(skin.classes)
    return PAIRS.map((pair) => {
      const read = (key) => {
        const expression = roles.get(key)
        if (!expression) throw new Error(`konfiguracja Tailwinda nie zna roli ${key}`)
        return color(expression, values)
      }
      const ratio = contrast(read(pair.ink), read(pair.ground))
      return { skin: skin.name, pair, ratio, floor: FLOORS[pair.role], passes: ratio >= FLOORS[pair.role] }
    })
  })
}

/* ══ 5. RAPORT ════════════════════════════════════════════════════════════ */

const number = (value) => value.toFixed(2).replace(".", ",")

function report(argv) {
  const onlyFailures = argv.includes("--failures")
  const filter = argv.find((one) => !one.startsWith("--"))
  const results = measure().filter((one) => !filter || label(one.pair).includes(filter))

  console.log("POMIAR KONTRASTU · paleta Biurka · WCAG 2.1 AA")
  console.log(`  arkusze: ${STYLESHEETS.join(" → ")}`)
  console.log(`  role:    ${TAILWIND_CONFIG} (klucze desk-*)`)
  console.log("  progi:   tekst 4,5:1 · element interfejsu 3:1")

  for (const skin of SKINS) {
    const mine = results.filter((one) => one.skin === skin.name)
    if (!mine.length) continue
    console.log(`\n── ${skin.name} ${"─".repeat(Math.max(0, 56 - skin.name.length))}`)
    for (const one of mine) {
      if (onlyFailures && one.passes) continue
      const verdict = one.passes ? "  " : "!!"
      console.log(
        `  ${verdict} ${number(one.ratio).padStart(6)}:1  próg ${number(one.floor)}  ${label(one.pair)}`,
      )
      if (!one.passes) console.log(`        ${one.pair.why}`)
    }
  }

  // Kod wyjścia rozstrzygają WYŁĄCZNIE odstępstwa nowe. Znane są wypisane osobno,
  // bo pomiar ma pokazywać pełny obraz — ale komenda, która zawsze kończy się błędem,
  // przestaje cokolwiek znaczyć i po tygodniu nikt jej nie uruchamia.
  const below = results.filter((one) => !one.passes)
  const known = below.filter((one) => KNOWN_BELOW.includes(`${one.skin} — ${label(one.pair)}`))
  const failed = below.filter((one) => !KNOWN_BELOW.includes(`${one.skin} — ${label(one.pair)}`))
  console.log("\nPODSUMOWANIE")
  for (const skin of SKINS) {
    const mine = results.filter((one) => one.skin === skin.name)
    if (!mine.length) continue
    const bad = mine.filter((one) => !one.passes).length
    console.log(`  ${skin.name.padEnd(20)} ${bad} z ${mine.length} poniżej progu`)
  }
  // Lista może tylko MALEĆ. Wpis, który zaczął przechodzić, musi z niej zniknąć —
  // inaczej jest wygodnym miejscem na schowanie przyszłej regresji pod cudzą zgodą.
  // Reguła stała najpierw wyłącznie w e2e, czyli była egzekwowana dopiero z przeglądarką;
  // tutaj kosztuje trzy linie i działa wszędzie, gdzie da się uruchomić `node`.
  const measured = new Set(results.map((one) => `${one.skin} — ${label(one.pair)}`))
  const stale = KNOWN_BELOW.filter(
    (one) => measured.has(one) && !below.some((bad) => `${bad.skin} — ${label(bad.pair)}` === one),
  )

  console.log(`  RAZEM ${below.length} z ${results.length} par poniżej progu`)
  console.log(`         w tym ${known.length} znanych i dopuszczonych, ${failed.length} nowych`)
  if (stale.length) {
    console.log("\nZNANE ODSTĘPSTWA, KTÓRE JUŻ PRZECHODZĄ — skreśl je z KNOWN_BELOW:")
    stale.forEach((one) => console.log(`  ${one}`))
  }
  return failed.length === 0 && stale.length === 0
}

/**
 * Skąd pochodzi każdy token — odpowiedź na pytanie, o które poszedł spór.
 * Zwycięzca kaskady jest oznaczony strzałką; wszystko nad nim jest martwe.
 */
function sources() {
  const roles = deskColors()
  const tokens = [
    ...new Set(
      [...roles.values()].flatMap((expression) => [...expression.matchAll(/var\((--[\w-]+)\)/g)].map(([, name]) => name)),
    ),
  ].sort()
  for (const skin of SKINS) {
    console.log(`\n── ${skin.name} ${"─".repeat(Math.max(0, 56 - skin.name.length))}`)
    for (const token of tokens) {
      const found = origins(token, skin.classes)
      console.log(`  ${token}`)
      found.forEach((one, index) => {
        const winner = index === found.length - 1 ? "←" : " "
        console.log(`    ${winner} ${one.value.padEnd(24)} ${one.file} ${one.selector}`)
      })
      if (!found.length) console.log("      (nikt nie deklaruje)")
    }
  }
}

// Uruchomienie z wiersza poleceń — z tego samego powodu co wyżej sprawdzane nazwą
// pliku, a nie porównaniem `import.meta.url` z `process.argv[1]`.
if (process.argv[1]?.endsWith("kontrast-tokenow.mjs")) {
  if (process.argv.includes("--sources")) sources()
  else if (!report(process.argv.slice(2))) process.exit(1)
}
