// Stałe trybu batch/pakiet (D4) — dzielone między walidację Zod na serwerze
// (app/idp/app/api/content-guru/jobs/route.ts) i UI (licznik kombinacji +
// blokada submitu na ekranie generowania, design doc §4.1), wzorem
// TEXT_MAX_CHARS w app/idp/lib/geo-score-calculator/limits.ts — jedna stała,
// zamiast dwóch liczb, które mogłyby się rozjechać.

/** Legacy nie miał żadnego capu (25 tematów × 10 szablonów = 250 wywołań LLM
 *  z jednego kliknięcia było możliwe) — 30 to twardy próg zaakceptowany przez
 *  Alexa 03.08.2026 (design doc §9 p.3, ZAMKNIĘTE), wzorem `MAX_VARIANTS` w
 *  Ilustromacie. Egzekwowany server-side w Zod (`jobs/route.ts`) — NIE tylko
 *  jako podpowiedź UI możliwa do obejścia bezpośrednim wywołaniem API. */
export const MAX_COMBINATIONS = 30

/** Ile pozycji (temat × szablon) jest w toku RÓWNOCZEŚNIE dla jednego joba
 *  (D4) — stała w kodzie, NIE env var (design doc explicite: "konfigurowalna
 *  stała, nie env var"). 4-6 to rekomendowany zakres design docu; 5 jest
 *  środkiem — dość dużo, żeby 30-elementowy pakiet skończył się w rozsądnym
 *  czasie, dość mało, żeby nie zalać cortex-proxy 30 jednoczesnymi żądaniami. */
export const JOB_CONCURRENCY = 5
