#!/usr/bin/env node
// Seeds the cortex-config governance store with the G1 demo setup:
//
//   departments  badania, marketing, dotacje (next to the seeded "wspolne")
//   sources      demo/skills/research -> badania, demo/skills/marketing -> marketing,
//                demo/skills/dotacje -> dotacje
//   connectors   web-search (Perplexity CLI, dept badania)
//                generate-image (Gemini CLI, dept marketing)
//                extract-doc + make-docx (document CLI tools, dept dotacje, no creds)
//   projects     research-desk (Research Desk), marketing-studio (Marketing Studio),
//                dotacje-desk (Dotacje B+R)
//   credentials  badania/perplexity-api-key, marketing/gemini-api-key
//                (values from env or csec; skipped with a warning when absent)
//
// Idempotent: entries are upserted by id, existing credential values are kept
// unless a fresh value was resolved. Run from the repo root:
//
//   node scripts/seed-demo.mjs
//
// The dev server picks the config up on the next request (the store reads
// governance.json per request) - no restart needed.

import { execFileSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = process.env.COWORK_DATA_DIR ?? path.join(repoRoot, "app", "idp", ".data", "cortex-cowork")
const governancePath = path.join(dataDir, "governance.json")
const credentialsPath = path.join(dataDir, "credentials.json")

const nowIso = new Date().toISOString()

// --- helpers -------------------------------------------------------------------

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  return JSON.parse(readFileSync(file, "utf8"))
}

function writeJsonAtomic(file, value, mode) {
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8")
  if (mode) chmodSync(tmp, mode)
  renameSync(tmp, file)
}

function upsertById(list, entry) {
  const index = list.findIndex((item) => item.id === entry.id)
  if (index === -1) list.push(entry)
  else list[index] = { ...list[index], ...entry }
}

function resolveSecret(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name]
  }
  for (const name of names) {
    try {
      const value = execFileSync("csec", ["get", name], { encoding: "utf8" }).trim()
      if (value) return value
    } catch {
      // csec absent or key not found - keep trying
    }
  }
  return undefined
}

// --- governance ----------------------------------------------------------------

// Matches seedConfig() in app/idp/lib/cortex-governance/store.ts (fresh install).
function freshConfig() {
  return {
    version: 2,
    departments: ["wspolne"],
    skillSources: [
      {
        id: "builtin",
        name: "Wbudowane skille",
        folderPath: path.join(repoRoot, "app", "idp", "features", "cortex-cowork", "skills"),
        department: "wspolne",
      },
    ],
    connectors: [],
    roles: [{ id: "analyst", name: "Analyst", description: "Domyślna rola dostępu" }],
    userAssignments: {},
    adminEmails: [],
    projects: [],
  }
}

const config = readJson(governancePath, null) ?? freshConfig()
if (config.version !== 2) {
  console.error(
    `governance.json is version ${config.version}, expected 2 - open the app once so the store migrates, then re-run.`,
  )
  process.exit(1)
}

for (const department of ["badania", "marketing", "dotacje"]) {
  if (!config.departments.includes(department)) config.departments.push(department)
}
config.departments.sort()

upsertById(config.skillSources, {
  id: "demo-research",
  name: "Demo - Research",
  folderPath: path.join(repoRoot, "demo", "skills", "research"),
  department: "badania",
})
upsertById(config.skillSources, {
  id: "demo-marketing",
  name: "Demo - Marketing",
  folderPath: path.join(repoRoot, "demo", "skills", "marketing"),
  department: "marketing",
})
upsertById(config.skillSources, {
  id: "demo-dotacje",
  name: "Demo - Dotacje B+R",
  folderPath: path.join(repoRoot, "demo", "skills", "dotacje"),
  department: "dotacje",
})

upsertById(config.connectors, {
  id: "web-search",
  department: "badania",
  type: "cli",
  name: "web search",
  description:
    "Wyszukiwanie w internecie z cytowanymi źródłami (Perplexity). Argumenty: zapytanie oraz opcjonalnie --model sonar-pro, --recency day|week|month|year, --domains lista, --academic.",
  enabled: true,
  target: path.join(repoRoot, "demo", "bin", "web-search.py"),
  credentialRefs: { PERPLEXITY_API_KEY: "badania/perplexity-api-key" },
})
upsertById(config.connectors, {
  id: "generate-image",
  department: "marketing",
  type: "cli",
  name: "generate image",
  description:
    "Generowanie obrazu PNG (Gemini). Argumenty: prompt po angielsku, --style nazwa-stylu-lub-opis, --out pełna-ścieżka-do-artifacts.",
  enabled: true,
  target: path.join(repoRoot, "demo", "bin", "generate-image.py"),
  credentialRefs: { GEMINI_API_KEY: "marketing/gemini-api-key" },
})
upsertById(config.connectors, {
  id: "extract-doc",
  department: "dotacje",
  type: "cli",
  name: "extract doc",
  description:
    "Tekst z plików PDF/DOCX/TXT w sandboxie sesji. Argumenty: ścieżka pliku oraz opcjonalnie --grep wzorzec (trafienia z kontekstem, ignoruje polskie znaki), --context N, --max-hits N, --pages A-B (PDF), --out ścieżka (pełny tekst do pliku).",
  enabled: true,
  target: path.join(repoRoot, "demo", "bin", "extract-doc.py"),
})
upsertById(config.connectors, {
  id: "make-docx",
  department: "dotacje",
  type: "cli",
  name: "make docx",
  description:
    "Renderuje dokument Word (.docx) ze spec JSON (bloki: heading/subheading/paragraph/bullets/field/warning/rule). Pola typu field mają limit znaków walidowany przed zapisem. Argumenty: ścieżka spec.json, --out ścieżka-artefaktu.docx.",
  enabled: true,
  target: path.join(repoRoot, "demo", "bin", "make-docx.py"),
})

if (!config.roles.some((role) => role.id === "analyst")) {
  config.roles.push({ id: "analyst", name: "Analyst", description: "Domyślna rola dostępu" })
}

function demoProject(overrides) {
  return {
    enabled: true,
    archetype: "task-chat",
    allowedRoleIds: ["analyst"],
    // Routed through cortex-proxy (OpenRouter) instead of a direct
    // ANTHROPIC_API_KEY - same model, centralized cost/usage tracking.
    // baseUrl triggers modelConfigForRunner()'s X-User-ID header injection
    // (see chat-engine.ts); apiKeyRef stays unset, cortex-proxy doesn't
    // validate the client's key. modelId uses OpenRouter's dot-notation
    // slug, not Anthropic's native hyphenated one.
    model: {
      provider: "openai-compatible",
      baseUrl: process.env.CORTEX_PROXY_URL ?? "http://cortex-proxy/v1",
      modelId: "anthropic/claude-opus-4.8",
    },
    sandbox: { mode: "local", allowedPaths: [] },
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  }
}

// Hierarchical AGENTS.md layers (organization + departments). Kept only when
// the admin has not written their own yet.
if (!config.agentsInstructions) {
  config.agentsInstructions = {
    global:
      "Odpowiadasz po polsku, zwięźle i konkretnie. Każdy wynik pracy zapisujesz jako plik w artifacts/ - nie wklejasz długich treści do czatu. Nie ujawniasz danych z innych działów.",
    departments: {
      badania:
        "Każde twierdzenie z sieci ma numerowany przypis do źródła. Rozróżniaj fakty od opinii; brak danych nazywaj wprost.",
      marketing:
        "Trzymaj spójny, profesjonalny brand voice. Prompty obrazów piszesz po angielsku; tekst na grafice max 3-5 słów.",
    },
  }
}
// New department layers are added even when the admin already saved their own
// AGENTS.md - but an existing entry for the department is never overwritten.
if (!config.agentsInstructions.departments) config.agentsInstructions.departments = {}
if (!config.agentsInstructions.departments.dotacje) {
  config.agentsInstructions.departments.dotacje =
    "Dokumenty dotacyjne piszesz formalnym językiem wniosków (FENG/SMART/NCBiR). Kwot, stawek i nazw raportów nie wymyślasz - zostawiasz placeholdery [WPISZ ...]. Limity znaków pól traktujesz jako twarde."
}

const existingProjects = new Map(config.projects.map((project) => [project.id, project]))
upsertById(
  config.projects,
  demoProject({
    id: "research-desk",
    name: "Research Desk",
    description: "Research z sieci z cytowanymi źródłami i pakiety statusowe ze spotkań.",
    icon: "search",
    department: "badania",
    systemPrompt:
      "Jesteś agentem research działu badań. Fakty z sieci pozyskujesz narzędziem web search i zawsze podajesz numerowane źródła.",
    briefs: [
      {
        id: "brief-status-pack",
        title: "Status pack z transkrypcji",
        hint: "dodaj plik z transkrypcją spotkania (spinacz albo przeciągnij)",
        prompt:
          "Zrób status pack z wgranej transkrypcji spotkania: TL;DR, decyzje, action items z ownerami, ryzyka i pytania otwarte.",
      },
      {
        id: "brief-research",
        title: "Research z cytowanymi źródłami",
        hint: "wpisz temat lub firmę w miejsce [TEMAT]",
        prompt:
          "Zrób research na temat: [TEMAT]. Raport z sekcjami Streszczenie / Ustalenia / Źródła, każde twierdzenie z numerowanym przypisem.",
      },
      {
        id: "brief-xlsx",
        title: "Raport Excel z danych",
        hint: "wklej dane albo dodaj plik CSV",
        prompt:
          "Zbuduj raport Excel (.xlsx) z danych, które podam: nagłówki, dopasowane szerokości kolumn i wiersz sum dla kolumn liczbowych.",
      },
    ],
    composition: {
      skills: { branches: ["badania", "wspolne"], leaves: [] },
      connectors: { branches: [], leaves: ["web-search"] },
      secrets: { branches: ["badania"], leaves: [] },
    },
    createdAt: existingProjects.get("research-desk")?.createdAt ?? nowIso,
  }),
)
upsertById(
  config.projects,
  demoProject({
    id: "marketing-studio",
    name: "Marketing Studio",
    description: "Wizuale i karuzele social media w spójnych stylach, generowane w sandboxie.",
    icon: "palette",
    department: "marketing",
    systemPrompt:
      "Jesteś agentem kreatywnym działu marketingu. Wizuale generujesz narzędziem generate image i zapisujesz je w artifacts/.",
    briefs: [
      {
        id: "brief-visual",
        title: "Wizual do posta",
        hint: "opisz temat; styl dobiorę albo podaj własny",
        prompt:
          "Wygeneruj jeden obraz do posta na LinkedIn na temat: [TEMAT]. Zaproponuj styl z katalogu (mckinsey / tech / minimal) i uzasadnij jednym zdaniem.",
      },
      {
        id: "brief-carousel",
        title: "Karuzela 5 slajdów",
        hint: "podaj temat i grupę docelową",
        prompt:
          "Zbuduj karuzelę 5 slajdów na LinkedIn na temat: [TEMAT]. Najpierw plan (hook -> treść -> CTA), potem spójna seria obrazów w jednym stylu.",
      },
      {
        id: "brief-okladka",
        title: "Okładka raportu",
        hint: "podaj tytuł raportu",
        prompt:
          "Wygeneruj okładkę raportu biznesowego w stylu mckinsey. Tytuł raportu: [TYTUŁ]. Bez tekstu na obrazie poza maks. 3 słowami.",
      },
    ],
    composition: {
      skills: { branches: ["marketing", "wspolne"], leaves: [] },
      connectors: { branches: [], leaves: ["generate-image"] },
      secrets: { branches: ["marketing"], leaves: [] },
    },
    createdAt: existingProjects.get("marketing-studio")?.createdAt ?? nowIso,
  }),
)
upsertById(
  config.projects,
  demoProject({
    id: "dotacje-desk",
    name: "Dotacje B+R",
    description: "Uzasadnienia kosztów personelu i dokumenty do wniosków o dofinansowanie (FENG / Ścieżka SMART / NCBiR).",
    icon: "file-text",
    department: "dotacje",
    systemPrompt:
      "Jesteś agentem działu dotacji. Pracujesz na dokumentach wgranych do sesji (input/): czytasz je narzędziem extract doc, gotowe dokumenty Word budujesz narzędziem make docx i zapisujesz w artifacts/.",
    briefs: [
      {
        id: "brief-personel",
        title: "Uzasadnienia kosztów personelu",
        hint: "dodaj 3 pliki: instrukcję WoD (PDF), opis prac B+R (docx/pdf) i listę stanowisk",
        prompt:
          "Wygeneruj uzasadnienia kosztów personelu B+R z wgranych plików: instrukcji WoD, opisu prac i listy stanowisk. Dla każdego stanowiska pola Uzasadnienie kosztu i Metoda szacowania w limicie znaków z instrukcji, wynik jako plik Word.",
      },
      {
        id: "brief-limity",
        title: "Sprawdź limity znaków",
        hint: "dodaj instrukcję WoD (PDF)",
        prompt:
          "Znajdź w instrukcji WoD wymogi dla pól Uzasadnienie kosztu i Metoda szacowania w kosztach personelu: treść instrukcji obu pól oraz limity znaków.",
      },
      {
        id: "brief-etaty",
        title: "Audyt etatów na liście stanowisk",
        hint: "dodaj listę stanowisk albo wklej ją do czatu",
        prompt:
          "Sprawdź listę stanowisk: suma etatów per osoba (flaguj > 100%), powtórzone nazwy stanowisk w jednym zadaniu, braki danych. Zwróć tabelę z wnioskami.",
      },
    ],
    composition: {
      skills: { branches: ["dotacje", "wspolne"], leaves: [] },
      connectors: { branches: [], leaves: ["extract-doc", "make-docx"] },
      secrets: { branches: [], leaves: [] },
    },
    createdAt: existingProjects.get("dotacje-desk")?.createdAt ?? nowIso,
  }),
)

writeJsonAtomic(governancePath, config)
console.log(`governance: ${governancePath}`)
console.log(`  departments: ${config.departments.join(", ")}`)
console.log(`  sources: ${config.skillSources.map((source) => source.id).join(", ")}`)
console.log(`  connectors: ${config.connectors.map((connector) => connector.id).join(", ")}`)
console.log(`  projects: ${config.projects.map((project) => project.id).join(", ")}`)

// --- credentials ---------------------------------------------------------------

const credentials = readJson(credentialsPath, { version: 1, values: {} })
const wanted = [
  {
    path: "badania/perplexity-api-key",
    sources: ["PERPLEXITY_API_KEY", "perplexity/api_key"],
  },
  {
    path: "marketing/gemini-api-key",
    sources: ["GEMINI_API_KEY", "gemini/api_key"],
  },
]

for (const { path: credentialPath, sources } of wanted) {
  const value = resolveSecret(sources)
  if (value) {
    credentials.values[credentialPath] = value
    console.log(`credential set: ${credentialPath}`)
  } else if (credentials.values[credentialPath]) {
    console.log(`credential kept: ${credentialPath} (already present)`)
  } else {
    console.warn(
      `credential MISSING: ${credentialPath} - set env ${sources[0]} (or csec) and re-run, ` +
        "or paste it in cortex-config -> Sekrety.",
    )
  }
}

writeJsonAtomic(credentialsPath, credentials, 0o600)
console.log(`credentials: ${credentialsPath}`)
console.log("done - refresh the hub; the demo tiles resolve on next request.")
