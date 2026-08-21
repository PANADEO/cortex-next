// Przeniesienie dzisiejszych angielskich nazw i opisów kafelków z pliku
// app/idp/locales/en/tiles.json do system_config.application_translations —
// PROJECT/cortex-frontend/ARTIFACTS/i18n/cortex-frontend-tlumaczenia-nazw-
// kafelkow-projekt.md, Krok 3.
//
// PO CO: angielskiej nazwy kafelka nie dało się zmienić z panelu, bo siedziała
// w pliku w repo. Kafelek założony przez admina pokazywał w angielskim
// interfejsie swoją polską nazwę. Po tym seedzie tłumaczenie jest daną
// instancji jak każda inna.
//
// IDEMPOTENTNY — wolno (i trzeba) uruchamiać przy każdym starcie/deployu:
//   DATABASE_URL=... node packages/@cortex/db/scripts/seed-application-translations.mjs
//
// INSERT-ONLY, dokładnie tą samą regułą co `name` w seed-tile-manifests.mjs:
// wartość początkowa pochodzi z kodu, ale WŁAŚCICIELEM w runtime jest admin
// edytujący ją w oknie "Tłumaczenia". `on conflict do nothing` — ani jednej
// kolumny w UPDATE. Dopisanie tam czegokolwiek odtworzyłoby defekt, dla
// którego naprawy powstał cały tamten projekt: zmiana zrobiona w UI wracałaby
// do wartości z kodu przy każdym deployu, cicho i bez błędu.
// Pilnuje tego seed-application-translations-insert-only.test.ts.
//
// DLACZEGO DANE SĄ WPISANE TUTAJ, a nie czytane z tiles.json:
//  1. Ten skrypt biegnie w obrazie `runner`, do którego jedzie WYŁĄCZNIE
//     packages/@cortex/db/scripts (patrz COPY w Dockerfile). Katalog
//     app/idp/locales/** tam nie istnieje — pliki tłumaczeń są wkompilowane
//     w bundel Next.js, nie leżą na dysku.
//  2. Krok 6 projektu KASUJE app/idp/locales/en/tiles.json razem z całą
//     przestrzenią `tiles`. Odczyt w runtime uczyniłby ten seed zależnym od
//     pliku, którego usunięcie jest zaplanowaną częścią tej samej roboty.
// To jest więc MIGRACJA DANYCH zapisana raz, a nie druga kopia żywego
// źródła prawdy. Nowe kafelki niosą tłumaczenia we własnym manifeście
// (`defineTile({ translations })` -> seed-tile-manifests.mjs), NIE tutaj.
//
// `shortLabel` z tiles.json jest POMINIĘTY świadomie (rozstrzygnięcie 2
// projektu): krótka nazwa nie jest daną instancji — admin nigdzie jej nie
// edytuje, jest czysto kodowym skrótem prezentacyjnym kafelków AI Tools i
// przenosi się do przestrzeni tłumaczeń `ai-tools`, nie do bazy.
//
// KOLEJNOŚĆ W ŁAŃCUCHU MIGRATE: musi biec PO seed-tile-manifests.mjs, bo
// dopasowuje się do `applications.code` — kod jeszcze niezarejestrowany nie
// dostanie tłumaczenia (SELECT nie zwróci wiersza, INSERT wstawi zero rekordów
// i nic nie padnie; następny deploy je uzupełni).

import postgres from "postgres"

/** Język, w którym powstały te napisy. Plik źródłowy był jeden — en/tiles.json;
 *  polskie nazwy są wartością bazową w `applications.name` i nie mają tu czego
 *  szukać (patrz reguła rozstrzygania w projekcie). */
const LOCALE = "en"

/**
 * Zrzut app/idp/locales/en/tiles.json z 21.08.2026 — pole `label` jako `name`,
 * `description` bez zmian. Klucz to `applications.code`; kod nieistniejący w
 * rejestrze jest po prostu pomijany.
 */
const TRANSLATIONS = [
  {
    code: "ai-daily-assistant",
    name: "AI Chatbot",
    description: "General-purpose assistant",
  },
  {
    code: "ai-summarizer",
    name: "Summarizer",
    description: "Condenses long texts into a summary",
  },
  {
    code: "content-guru",
    name: "Content Creator",
    description: "Generates marketing and editorial content",
  },
  {
    code: "cortex-config",
    name: "Cortex Config",
    description: "Platform governance — agent projects, roles and skill groups",
  },
  {
    code: "document-parser",
    name: "Document Parser",
    description: "Extracts structured content from PDF, Office and image files",
  },
  {
    code: "fakturomat",
    name: "Invoice Analyser",
    description: "Extracts data from invoices and summarises them",
  },
  {
    code: "geo-score-calculator",
    name: "GEO Score Calculator",
    description: "Scores press texts for generative-engine optimisation",
  },
  {
    code: "idp",
    name: "IDP",
    description: "Processing and data extraction from commercial documents",
  },
  {
    code: "idp-basic",
    name: "IDP Basic",
    description: "Simplified document processing in a separate pipeline",
  },
  {
    code: "ilustromat",
    name: "Ilustromat",
    description: "Generates branded graphics for LinkedIn posts from templates",
  },
  {
    code: "intrastat",
    name: "Intrastat",
    description: "Prepares ICA/ICS import spreadsheets from invoices",
  },
  {
    code: "invoice-supervisor",
    name: "Invoice Supervisor",
    description: "Tracks invoice due dates and generates AI reminders",
  },
  {
    code: "linkedin-generator",
    name: "LinkedIn Generator",
    description: "Creates LinkedIn posts",
  },
  {
    code: "meeting-guru",
    name: "Meeting Recording",
    description: "Sales-meeting assistant — recording, transcription and live AI hints",
  },
  {
    code: "okna-czasowe",
    name: "Release Windows",
    description: "Tracks film availability on Rakuten TV PL",
  },
  {
    code: "presentation-generator",
    name: "Presentation Generator",
    description: "Builds a presentation outline from a description",
  },
  {
    code: "sp-client",
    name: "Store-Pit Client Zone",
    description: "Client view — their shipments and the amount due",
  },
  {
    code: "sp-console",
    name: "Store-Pit Re-Rating",
    description: "Recalculates carrier invoices into per-client settlements",
  },
  {
    code: "system-config",
    name: "System Configuration",
    description: "Users, roles, permissions and instance applications",
  },
  {
    code: "text-analyzer",
    name: "Text Analyser",
    description: "Analyses content, tone and structure of a text",
  },
  {
    code: "text-highlighter",
    name: "Text Highlighter",
    description: "Marks key passages in a text",
  },
  {
    code: "text-transformer",
    name: "Text Transformer",
    description: "Rewrites text in a chosen style",
  },
  {
    code: "token-usage",
    name: "Token Reporting",
    description: "AI token usage by user, model and tool",
  },
  {
    code: "visual-guru",
    name: "Visual Guru",
    description: "Generates AI images from a free-form prompt and a reference image",
  },
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed:application-translations] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    let inserted = 0
    let missing = 0
    for (const entry of TRANSLATIONS) {
      const rows = await tx`
        insert into system_config.application_translations
          (application_id, locale, name, description)
        select a.id, ${LOCALE}, ${entry.name}, ${entry.description}
        from system_config.applications a
        where a.code = ${entry.code}
        -- INSERT-ONLY. Wiersz, który już istnieje, należy do admina i zostaje
        -- nietknięty — także wtedy, gdy admin wpisał w nim coś innego niż
        -- wartość z tej tablicy. Nie ma tu i nie ma prawa się pojawić
        -- do update set.
        on conflict (application_id, locale) do nothing
        returning application_id
      `
      if (rows.length > 0) inserted += 1
      else missing += 1
    }
    console.log(
      `[seed:application-translations] ${TRANSLATIONS.length} wpisów ${LOCALE}, ` +
        `dopisano ${inserted} nowych (pozostałe ${missing}: tłumaczenie już istnieje ` +
        "albo kod nie jest zarejestrowany w applications)",
    )
  })
}

try {
  await main()
  console.log("[seed:application-translations] zakończono.")
} catch (error) {
  console.error("[seed:application-translations] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
