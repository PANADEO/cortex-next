// Ustawienia instancji na PRAWDZIWYM Postgresie. Trzy własności, których test
// jednostkowy nie dosięga, bo wszystkie trzy są własnościami SCHEMATU:
//
//  1. brak wiersza (świeża instancja) czyta się jako `null`, nie jako błąd,
//  2. zapis jest idempotentnym upsertem — druga zmiana nadpisuje pierwszą,
//     zamiast łamać klucz główny,
//  3. singleton pilnuje BAZA: drugi wiersz nie ma jak powstać.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/instance-settings.integration.test.ts

import { closeDb, getDb, instanceSettings } from "@cortex/db"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { getInstanceAppearance, setInstanceAppearance } from "./system-config"

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabase)("wygląd instancji — prawdziwy Postgres", () => {
  beforeEach(async () => {
    await getDb().delete(instanceSettings)
  })

  afterAll(async () => {
    await getDb().delete(instanceSettings)
    await closeDb()
  })

  it("świeża instancja nie ma ustawienia i to nie jest błąd", async () => {
    await expect(getInstanceAppearance()).resolves.toEqual({ preset: null })
  })

  it("zapis i odczyt to ta sama wartość", async () => {
    await expect(setInstanceAppearance({ preset: "domino" })).resolves.toEqual({ preset: "domino" })
    await expect(getInstanceAppearance()).resolves.toEqual({ preset: "domino" })
  })

  it("kolejny zapis nadpisuje, a nie dokłada wiersza", async () => {
    await setInstanceAppearance({ preset: "domino" })
    await setInstanceAppearance({ preset: "customs" })

    await expect(getInstanceAppearance()).resolves.toEqual({ preset: "customs" })
    expect(await getDb().select().from(instanceSettings)).toHaveLength(1)
  })

  // Odpowiednik pozycji „Bez narzucania" w panelu. Ma wracać do stanu
  // nieodróżnialnego od świeżej instancji, a nie zapisywać nazwę presetu
  // domyślnego — inaczej ustawienie raz dotknięte nigdy już nie oddaje
  // rozstrzygnięcia użytkownikowi.
  it("można zdjąć narzucony wygląd", async () => {
    await setInstanceAppearance({ preset: "domino" })
    await expect(setInstanceAppearance({ preset: null })).resolves.toEqual({ preset: null })
    await expect(getInstanceAppearance()).resolves.toEqual({ preset: null })
  })

  it("odrzuca wartość spoza kształtu identyfikatora, zanim dojdzie do bazy", async () => {
    await expect(setInstanceAppearance({ preset: "Domino Skin!" })).rejects.toThrow()
    await expect(getInstanceAppearance()).resolves.toEqual({ preset: null })
  })

  // CHECK w bazie, nie w kodzie: gdyby singleton pilnował tylko serwis, wiersz
  // wstawiony seedem, migracją albo z psql zrobiłby z „ustawienia instancji"
  // wartość wybieraną arbitralnie przez `limit 1`.
  //
  // OBIE GAŁĘZIE, bo pilnują ich dwa różne ograniczenia i każde może zniknąć
  // osobno: `id = false` odbija CHECK, `id = true` odbija klucz główny. Test
  // sprawdzający tylko pierwszą przeszedłby na tabeli, która straciła PK.
  it("drugi wiersz jest niemożliwy — ani z id=false (CHECK), ani z id=true (PK)", async () => {
    await setInstanceAppearance({ preset: "domino" })

    await expect(
      getDb().insert(instanceSettings).values({ id: false, appearancePreset: "customs" }),
    ).rejects.toThrow()

    await expect(
      getDb().insert(instanceSettings).values({ id: true, appearancePreset: "customs" }),
    ).rejects.toThrow()

    expect(await getDb().select().from(instanceSettings)).toEqual([
      expect.objectContaining({ id: true, appearancePreset: "domino" }),
    ])
  })
})
