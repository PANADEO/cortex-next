// Punkt montowania kafelka `desk`. Treść mieszka w `@cortex/desk-app` — ten sam kod
// obsługuje aplikację `apps/desk` (szybki dev i bramka BDD) i ten kafelek.
//
// Trasa testowa (`test-reset-uprawnien`) świadomie NIE jest tu montowana: zeruje
// uprawnienia i dzienny koszt, a to narzędzie bramki, nie funkcja produktu.
export { POST } from "@cortex/desk-app/api/sprawa-tura"
