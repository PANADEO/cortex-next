// Strażnik kopii bramki licencyjnej: module-licensing.mjs (wykonuje ją SEED)
// musi rozstrzygać dokładnie tak samo jak
// packages/@cortex/service/src/module-licensing.ts (wykonuje ją APLIKACJA).
//
// Powód istnienia kopii — brak toolchainu TS w obrazie, z którego startuje
// usługa `migrate` — jest opisany w nagłówku module-licensing.mjs. Ten plik
// jest jedynym mechanizmem, który nie pozwoli tym dwóm zdaniom się rozjechać;
// rozjazd byłby cichy i groźny w obie strony (bootstrap aktywujący moduł
// spoza licencji albo rdzeń zablokowany na instancji bez ENABLED_MODULES).
//
// Plik jest `.mjs`, a nie `.ts`, bo tsconfig ma `allowJs: false` — test w TS
// nie mógłby zaimportować testowanego skryptu. Vitest transpiluje
// zaimportowany stąd `.ts` normalnie, więc obie strony da się wykonać obok
// siebie. Ta sama asymetria co w scripts-parse.test.ts, tylko rozwiązana
// importem zamiast `node --check`.
//
// Wejścia są tablicą, a nie osobnymi testami per przypadek, żeby dodanie
// nowego kształtu zmiennej (np. ze spacjami, pusty, same przecinki) było
// jedną linijką i automatycznie objęło OBIE implementacje.

import { afterEach, describe, expect, it } from "vitest"
import { isModuleEnabled as fromService } from "../../service/src/module-licensing"
import { bootstrapActivationPlan, isModuleEnabled as fromSeed } from "./module-licensing.mjs"

/** Kształty `ENABLED_MODULES`, na których obie strony mają się zgadzać.
 *  `undefined` = zmienna w ogóle nieustawiona (inna ścieżka niż `""`). */
const ENABLED_MODULES_CASES = [
  undefined,
  "",
  "   ",
  ",,,",
  "idp",
  "idp,intrastat",
  " idp , intrastat ,, ",
  "system-config",
  "IDP",
]

/** Kody sondujące — w tym jeden spoza rejestru i jeden różniący się
 *  wielkością liter, bo obie implementacje porównują dosłownie. */
const PROBE_CODES = ["idp", "intrastat", "system-config", "idp-basic", "IDP", "nie-ma-takiego"]

const originalEnabled = process.env.ENABLED_MODULES
const originalBootstrap = process.env.BOOTSTRAP_MODULES

function setEnv(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

afterEach(() => {
  setEnv("ENABLED_MODULES", originalEnabled)
  setEnv("BOOTSTRAP_MODULES", originalBootstrap)
})

describe("bramka licencyjna seeda == bramka licencyjna aplikacji", () => {
  it.each(ENABLED_MODULES_CASES)("ENABLED_MODULES=%o", (value) => {
    setEnv("ENABLED_MODULES", value)

    for (const code of PROBE_CODES) {
      expect(
        fromSeed(code),
        `ENABLED_MODULES=${JSON.stringify(value)}, kod ${code}: seed i aplikacja rozstrzygają inaczej`,
      ).toBe(fromService(code))
    }
  })

  // Bez tej asercji cały blok wyżej mógłby przechodzić dlatego, że obie
  // implementacje zawsze zwracają to samo — np. obie `true`. Tu jest dowód, że
  // bramka w ogóle ROZRÓŻNIA kody, więc zgodność wyżej jest zgodnością o czymś.
  it("bramka realnie rozróżnia — nie jest stałą", () => {
    setEnv("ENABLED_MODULES", "idp")

    expect(fromSeed("idp")).toBe(true)
    expect(fromSeed("intrastat")).toBe(false)
    expect(fromService("idp")).toBe(true)
    expect(fromService("intrastat")).toBe(false)
  })
})

describe("bootstrapActivationPlan — przecięcie z licencją, nigdy suma", () => {
  it("bez BOOTSTRAP_MODULES nie aktywuje niczego", () => {
    setEnv("ENABLED_MODULES", undefined)
    setEnv("BOOTSTRAP_MODULES", undefined)

    expect(bootstrapActivationPlan()).toEqual({ activate: [], refused: [] })
  })

  it("bez ENABLED_MODULES (instancja bez licencji) przepuszcza całą listę", () => {
    setEnv("ENABLED_MODULES", undefined)
    setEnv("BOOTSTRAP_MODULES", "idp, intrastat")

    expect(bootstrapActivationPlan()).toEqual({ activate: ["idp", "intrastat"], refused: [] })
  })

  // TO jest asercja, dla której ten opis powstał: zmienna wygody NIE MOŻE
  // poszerzać licencji. `intrastat` jest na liście bootstrapowej i poza
  // ENABLED_MODULES — ma trafić do `refused`, nigdy do `activate`.
  it("kod spoza ENABLED_MODULES jest odmówiony, nie aktywowany", () => {
    setEnv("ENABLED_MODULES", "idp")
    setEnv("BOOTSTRAP_MODULES", "idp,intrastat")

    expect(bootstrapActivationPlan()).toEqual({ activate: ["idp"], refused: ["intrastat"] })
  })

  it("duplikat w liście liczy się raz", () => {
    // Nie dla wydajności: drugi przebieg tego samego kodu trafiłby w guard
    // `activated_at is null` (kod jest już aktywowany przez pierwszy) i seed
    // wypisałby ostrzeżenie o "decyzji administratora", której nie było.
    setEnv("ENABLED_MODULES", undefined)
    setEnv("BOOTSTRAP_MODULES", "idp, idp ,intrastat,idp")

    expect(bootstrapActivationPlan()).toEqual({ activate: ["idp", "intrastat"], refused: [] })
  })

  it("odmowa nie rzuca — łańcuch migrate ma dojść do bloku administratora", () => {
    setEnv("ENABLED_MODULES", "idp")
    setEnv("BOOTSTRAP_MODULES", "literowka-w-kodzie")

    expect(() => bootstrapActivationPlan()).not.toThrow()
    expect(bootstrapActivationPlan().activate).toEqual([])
  })
})
