// Dwie zmienne deploy-configu mówiące o modułach, czytane PRZEZ SEED:
// `ENABLED_MODULES` (co ta instancja ma PRAWO mieć) i `BOOTSTRAP_MODULES` (co
// włączyć od razu przy pierwszym uruchomieniu). Jeden plik, bo odpowiadają na
// różne pytania, ale druga MUSI przechodzić przez pierwszą — patrz
// bootstrapActivationPlan() niżej.
//
// DLACZEGO TO JEST DRUGA IMPLEMENTACJA isModuleEnabled(). Pierwsza żyje w
// packages/@cortex/service/src/module-licensing.ts i jest tą, którą wykonuje
// aplikacja. Seedy są czystym .mjs, uruchamianym jednym `node` w obrazie
// `runner`, gdzie NIE MA toolchainu TS ani zbudowanego @cortex/service —
// dokładnie ten sam powód, dla którego skrypty obok nie importują niczego z
// app/. Rozważone i odrzucone: (a) przepisanie seeda na TS — wciąga krok
// kompilacji do ścieżki deployu, czyli do miejsca, które ma być najprostsze w
// całym systemie; (b) import artefaktu buildu — usługa `migrate` startuje z
// obrazu runner, w którym tego artefaktu nie ma.
//
// Kopia jest więc świadoma i ma strażnika: module-licensing.parity.test.mjs
// wykonuje obie implementacje na tej samej tablicy wejść i wymaga zgodności
// co do znaku. Sam komentarz nie wystarczy, bo rozjazd byłby CICHY i groźny
// w obie strony: gdyby TS stał się fail-closed, a ta kopia została
// fail-open, bootstrap aktywowałby moduły spoza licencji; odwrotnie —
// zablokowałby rdzeń na instancji bez ENABLED_MODULES.

/** `"a, b,,c"` -> `["a", "b", "c"]`. Brak wartości, pusty string i same
 *  przecinki dają pustą tablicę — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako `""`. */
export function parseModuleList(value) {
  return (value ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
}

/** Fail-open przy braku konfiguracji (bez ograniczeń), fail-closed przy
 *  ustawionej liście — semantyka 1:1 z `isModuleEnabled()` w
 *  @cortex/service. Czytane przy każdym wywołaniu, nie na starcie modułu,
 *  z tego samego powodu co tam. */
export function isModuleEnabled(code) {
  const enabled = parseModuleList(process.env.ENABLED_MODULES)
  return enabled.length === 0 || enabled.includes(code)
}

/**
 * PRZECIĘCIE `BOOTSTRAP_MODULES` z licencją instancji, nigdy suma.
 *
 * `ENABLED_MODULES` odpowiada na "co ta instancja ma PRAWO mieć",
 * `BOOTSTRAP_MODULES` na "co włączyć od razu, żeby nie klikać 26 razy przy
 * stawianiu środowiska". Bez tego przecięcia zmienna wygody byłaby obejściem
 * licencji na jeden wpis w `.env` — czyli odtworzeniem dziury zamkniętej
 * commitem `00f9a7c` (przed nim POST aktywował moduł, który ta sama instancja
 * poprawnie ukrywała w picker'ze).
 *
 * Kod odrzucony wraca w `refused`, a nie jako wyjątek: seed ma go POMINĄĆ z
 * czytelnym logiem. Rzucenie zatrzymałoby łańcuch `migrate` (seedy są spięte
 * przez `&&`), więc jedna literówka w konfiguracji deployu zostawiałaby
 * instancję bez administratora — ta sama klasa skutku, przed którą broni
 * scripts-parse.test.ts.
 */
export function bootstrapActivationPlan() {
  // Odsianie duplikatów (`idp,idp`) TUTAJ, nie w parseModuleList(): tamta
  // funkcja jest lustrem odpowiednika z @cortex/service i ma zostać z nim
  // znak w znak. Powód odsiania jest czysto komunikacyjny — drugi przebieg
  // tego samego kodu trafia w guard `activated_at is null` i seed meldowałby
  // "decyzję administratora o wyłączeniu modułu", której nikt nie podjął.
  const requested = [...new Set(parseModuleList(process.env.BOOTSTRAP_MODULES))]

  return {
    activate: requested.filter((code) => isModuleEnabled(code)),
    refused: requested.filter((code) => !isModuleEnabled(code)),
  }
}
