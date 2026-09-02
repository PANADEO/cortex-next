// Nagłówki działów pojawiają się WTEDY, GDY JEST CO GRUPOWAĆ — obie gałęzie.
//
// DLACZEGO TU, A NIE W E2E. Scenariusz „Katalog grupuje się działami, gdy jest co
// grupować" pilnował obu przypadków przez kontrast dwóch person: pracownica miała
// zdolności wyłącznie „dla wszystkich", przełożony z czterech działów. Decyzja
// właściciela produktu z 02.09.2026 (arkusze i obliczenia wchodzą do roli startowej)
// skasowała ten kontrast — w zasiewie nie ma już nikogo z jednym działem, więc „gdy"
// z tytułu testu przestało być sprawdzane, i to bez ani jednej czerwonej linii.
//
// Przypadek negatywny nie zniknął dlatego, że przestał być ważny, tylko dlatego, że
// przestał być OSIĄGALNY Z DANYCH POKAZU. Reguła jest czystą funkcją, więc da się ją
// zbudować wprost — i tu jest jedyne miejsce, gdzie nie zależy od tego, kogo akurat
// ma zasiew.

import { describe, expect, it } from "vitest"
import { shouldGroup } from "./capability-list"

const inDepartment = (...departments: string[]) => departments.map((d) => ({ department: d }))

describe("kiedy katalog dzieli się na działy", () => {
  it("jeden dział — nagłówek byłby szumem", () => {
    expect(shouldGroup(inDepartment("everyone", "everyone", "everyone"))).toBe(false)
  })

  it("dwa działy — nagłówek zaczyna nieść informację", () => {
    expect(shouldGroup(inDepartment("everyone", "finance"))).toBe(true)
  })

  it("pusty katalog nie jest błędem i nie grupuje", () => {
    // Osoba, której odebrano wszystko, ma zobaczyć pustą listę, a nie wywrócony ekran.
    expect(shouldGroup([])).toBe(false)
  })

  it("jedna zdolność też nie grupuje", () => {
    expect(shouldGroup(inDepartment("finance"))).toBe(false)
  })
})
