// Seed modułu GEO Score Calculator: WYŁĄCZNIE domyślny wiersz konfiguracji
// (wagi/benchmarki/progi ocen/listy słów), identyczny z DEFAULT_* w
// geo_calc/app/backend/constants.py — port ma wystartować z tymi samymi
// wynikami co PoC dla tego samego tekstu.
//
// ŚWIADOMIE BEZ logiki aktywacji/grantu, w odróżnieniu od seed-ilustromat.mjs
// / seed-token-usage.mjs: tamte dwa moduły były już DZIŚ realnymi,
// działającymi kafelkami w momencie migracji na wzorzec manifestów
// (D6-rewizja) — ich seedy COFAJĄ domyślny stan "nieaktywnego kandydata"
// ustawiony przez seed-tile-manifests.mjs. GEO Score Calculator jest
// odwrotnie: to NOWY moduł, Faza 0 (fundament) — PROJECT/cortex-frontend-
// geo-score-calculator-port-projekt.md §5. Ma zostać nieaktywnym kandydatem
// (is_active=false, activated_at=null) w rejestrze `applications`, widocznym
// w formularzu "Dodaj aplikację" do RĘCZNEJ aktywacji — nie auto-aktywowanym
// przez ten seed.
//
// `show_on_hub` NIE jest już częścią tego stanu (K1b). Do K1b zapisywano tu
// „show_on_hub=false" jako pożądany stan rejestracji nowego modułu i było to
// mylące już wtedy: kolumna nie opisuje etapu wdrożenia, tylko to, czy kod ma
// własną kartę na hubie. Od K1b bierze się z manifestowego `entitlementOnly`,
// więc GEO Score Calculator — prawdziwy kafelek — rejestruje się z
// `show_on_hub=true` i jest niewidoczny wyłącznie przez `is_active=false`
// (listHubApplications() wymaga obu). Aktywacja nadal pozostaje świadomym
// krokiem operatora, zmienia się tylko to, która kolumna go wyraża.
//
// Grant dla roli admin do TEGO wiersza i tak już istnieje bez żadnej
// dodatkowej pracy tutaj: seed-system-config.mjs (wcześniej w łańcuchu
// migrate) grantuje roli admin WSZYSTKIE wiersze `applications`, niezależnie
// od stanu aktywacji ("select ${role.id}, id from system_config.applications"
// — nie "WHERE is_active"). Admin może więc realnie wołać ten moduł (kiedy
// jego API powstanie, Faza 1+) mimo że kafelek nie pokazuje się jeszcze na
// hubie.
//
// IDEMPOTENTNY — wolno uruchamiać przy każdym deployu:
//   DATABASE_URL=... pnpm --filter @cortex/db db:seed:geo-score-calculator

import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("[seed:geo-score-calculator] DATABASE_URL nie jest ustawione — przerywam.")
  process.exit(1)
}

// 1:1 z geo_calc/app/backend/constants.py — DEFAULT_WEIGHTS/DEFAULT_BENCHMARKS/
// DEFAULT_GRADES są wpisane wprost niżej (skalary), listy słów jako stałe.
const DEFAULT_ACTION_VERBS = [
  "wdrożył", "uruchomił", "zwiększył", "zmniejszył", "osiągnął",
  "zrealizował", "wprowadził", "zakończył", "rozpoczął", "podpisał",
  "ogłosił", "przedstawił", "zaprezentował", "zainwestował", "sfinansował",
  "opracował", "stworzył", "zbudował", "rozwinął", "ulepszył",
  "zmodernizował", "zoptymalizował", "przekształcił", "zautomatyzował",
  "nawiązał", "połączył", "zintegrował", "skonsolidował", "przejął",
  "wzrósł", "spadł", "przekroczył", "podwoił", "potroił",
  "zaoszczędził", "wygenerował", "wypracował",
  "wdraża", "uruchamia", "zwiększa", "realizuje", "wprowadza",
  "rozwija", "buduje", "inwestuje", "generuje", "osiąga",
]

const DEFAULT_SUBJECTIVE_WORDS = [
  "najlepszy", "najlepsza", "najlepsze", "największy", "największa",
  "najważniejszy", "najważniejsza", "najpopularniejszy", "najnowocześniejszy",
  "wyjątkowy", "wyjątkowa", "wyjątkowe", "niesamowity", "niesamowita",
  "doskonały", "doskonała", "perfekcyjny", "idealny", "idealna",
  "rewolucyjny", "rewolucyjna", "przełomowy", "przełomowa",
  "innowacyjny", "innowacyjna", "nowoczesny", "nowoczesna",
  "niezwykły", "niezwykła", "fantastyczny", "fantastyczna",
  "cudowny", "cudowna", "wspaniały", "wspaniała",
  "absolutnie", "całkowicie", "niezwykle", "niesamowicie",
  "wyjątkowo", "nadzwyczaj", "szczególnie", "bardzo",
  "lider", "liderka", "czołowy", "czołowa", "wiodący", "wiodąca",
  "premium", "ekskluzywny", "ekskluzywna", "prestiżowy", "prestiżowa",
  "unikalny", "unikalna", "jedyny", "jedyna",
]

const DEFAULT_FALSE_POSITIVES = [
  "rozwiązania", "rozwiązanie", "rozwiązań",
  "przedmioty", "przedmiot", "przedmiotów",
  "osiągnięcia", "osiągnięcie", "osiągnięć",
  "inwestycja", "inwestycji", "inwestycje",
  "uruchomienie", "uruchomienia",
  "wdrożenie", "wdrożenia", "wdrożeń",
  "zwiększenie", "zwiększenia",
  "zmniejszenie", "zmniejszenia",
  "wprowadzenie", "wprowadzenia",
  "zakończenie", "rozpoczęcie",
  "przedstawienie", "ogłoszenie",
  "połączenie", "przekształcenie",
  "ulepszenie", "usprawnienie",
]

const DEFAULT_BULLET_PATTERNS = [
  "^[\\s]*[-•●○◦▪▸►]\\s+",
  "^[\\s]*\\d+[.\\)]\\s+",
  "^[\\s]*[a-z][.\\)]\\s+",
]

const sql = postgres(databaseUrl, { max: 1 })

async function main() {
  await sql.begin(async (tx) => {
    // `id` singleton (boolean PK default true, patrz schema) — drugi INSERT
    // z tym samym id koliduje z PK, `on conflict do nothing` czyni to
    // idempotentnym bez potrzeby osobnego SELECT-then-INSERT.
    const [row] = await tx`
      insert into geo_score_calculator.config
        (id, weight_statistics, weight_action_verbs, weight_structure, weight_objectivity,
         benchmark_stats, benchmark_verbs, benchmark_structure, benchmark_objectivity,
         grade_a_min, grade_b_min, grade_c_min, grade_d_min,
         action_verbs, subjective_words, false_positives, bullet_patterns, updated_by)
      values (
        true, 0.30, 0.25, 0.20, 0.25,
        4.0, 0.15, 3.0, 0.05,
        90, 75, 60, 40,
        ${DEFAULT_ACTION_VERBS}, ${DEFAULT_SUBJECTIVE_WORDS},
        ${DEFAULT_FALSE_POSITIVES}, ${DEFAULT_BULLET_PATTERNS},
        'system'
      )
      on conflict (id) do nothing
      returning id
    `
    console.log(
      row
        ? "[seed:geo-score-calculator] config: wstawiono domyślny wiersz"
        : "[seed:geo-score-calculator] config: już istnieje, pomijam",
    )
  })
}

try {
  await main()
  console.log("[seed:geo-score-calculator] zakończono.")
} catch (error) {
  console.error("[seed:geo-score-calculator] błąd:", error)
  process.exitCode = 1
} finally {
  await sql.end()
}
