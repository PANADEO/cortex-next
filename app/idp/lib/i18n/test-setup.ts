/**
 * Inicjalizacja i18next dla testów.
 *
 * Komponenty wołające `useTranslation()` renderują się w testach BEZ
 * `AppProviders`, więc nie przechodzą przez import inicjalizujący. Bez tego
 * pliku `t("gate.checking")` zwraca surowy klucz i przewraca asercje na
 * widocznym tekście — co jest szumem, nie sygnałem: sprawdzają one treść
 * ekranu, a nie to, czy i18n wstało.
 *
 * Ładowany globalnie przez `setupFiles` w `vitest.config.ts`.
 */
import "./index"
