import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Kod, trasa i katalog są po angielsku
// ("desk"), bo tak nazywa się tu KAŻDY moduł i tak czyta je baza, seed i
// bramka dostępu; polskie zostaje wyłącznie to, co widzi pracownik — etykieta
// i opis. „Biurko" to nazwa produktu, nie identyfikator.
//
// Własna grupa tras `(desk)`, nie `(main)`: moduł przychodzi z własną powłoką
// (lista spraw po lewej, pasek dolny na telefonie), dokładnie tak jak Cortex
// Cowork. Wstawienie go pod generyczny AppShell dałoby dwa sidebary obok
// siebie i dwa paski górne jeden pod drugim.
export const deskTile = defineTile({
  id: "desk",
  kind: "native",
  label: "Biurko",
  entitlementCode: "desk",
  route: "/desk",
  description: "Biurko pracownika — zlecasz robotę słowami, dostajesz dokument z dowodem",
  icon: "PanelsTopLeft",
  color: "teal",
  categoryFunctional: "agents",
  categoryDepartment: ["operations"],
  sortOrder: 65,
})
