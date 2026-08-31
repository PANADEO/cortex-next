// Punkt montowania. Treść mieszka w `@cortex/desk-app`, bo ten sam kod obsługuje
// dwa wejścia: tę aplikację i kafelek `desk` w powłoce cortex-next. Kopia zamiast
// re-eksportu znaczyłaby dwie ścieżki, które rozjeżdżają się przy pierwszej poprawce.
export { default } from "@cortex/desk-app/strony/sprawy"
