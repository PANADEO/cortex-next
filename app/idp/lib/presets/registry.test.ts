// @vitest-environment jsdom
import { HUB_LAYOUTS } from "@/components/shell/hub/registry"
import { describe, expect, it } from "vitest"
import tailwind from "../../../../tailwind.config"
import { migrateLegacySkin, usePresetStore } from "./preset-store"
import {
  DEFAULT_PRESET,
  INSTANCE_DEFAULT_ID,
  PRESETS,
  isPresetId,
  presetChoiceToStored,
  presetChoices,
  resolvePresetId,
  storedToPresetChoice,
} from "./registry"

/** Atrapa `t` — ten test sprawdza KSZTAŁT listy wyboru, nie tłumaczenia. */
const identity = (key: string) => key

/** Wartość, która nie może stać się prawdziwym presetem — nie jest nazwą
 *  żadnego skinu ani z tej gałęzi, ani z `main`. */
const NIE_PRESET = "__zaden-preset__"

describe("rejestr presetów", () => {
  // `hubLayout` jest typowane na `HubLayoutId`, więc kompilator łapie literówkę
  // — ale nie łapie sytuacji, w której layout wypada z rejestru, a preset
  // zostaje: `keyof typeof HUB_LAYOUTS` zmienia się wtedy razem z rejestrem i
  // psuje się dopiero `PRESETS`. Ten test mówi to samo o środowisku runtime.
  it("każdy preset wskazuje layout obecny w rejestrze huba", () => {
    for (const preset of Object.values(PRESETS)) {
      expect(Object.keys(HUB_LAYOUTS)).toContain(preset.hubLayout)
    }
  })

  // Ten sam kształt asercji co wyżej, dla czwartej osi wariantu. Kompilator
  // wymusza obecność pola przez `Record<PresetId, Preset>`, ale nie łapie
  // literówki w WARTOŚCI, jeśli ktoś rozszerzy unię `ShellVariant` i zapomni
  // dołożyć gałąź w tabeli CVA — wtedy `cva` cicho zwróci samą bazę.
  it("każdy preset ma wariant powłoki z zamkniętej listy", () => {
    for (const preset of Object.values(PRESETS)) {
      expect(["plain", "ruled"]).toContain(preset.variants.shell)
    }
  })

  /**
   * §5d: pominięcie klasy skinu na safeliście Tailwinda NIE objawia się brakiem
   * skinu. Purge warstwy `base` wycina bare `.skin-x`, ale zostawia
   * `.skin-x.dark`, bo token `dark` występuje w źródłach — więc nowy preset
   * działa w trybie ciemnym i po cichu spada na tokeny bazowe w jasnym. Objaw
   * nie wskazuje na przyczynę i diagnozuje się go od zera. Stąd ten test:
   * dopisanie presetu ze skinem spoza safelisty ma być czerwone od razu.
   */
  it("każda klasa skinu jest na safeliście Tailwinda", () => {
    const safelist = tailwind.safelist ?? []
    for (const preset of Object.values(PRESETS)) {
      if (!preset.skin) continue
      expect(safelist).toContain(preset.skin)
    }
  })

  it("domyślny preset istnieje w rejestrze", () => {
    expect(PRESETS[DEFAULT_PRESET]).toBeDefined()
  })
})

describe("kolejność źródeł presetu", () => {
  it("wybór użytkownika wygrywa z presetem instancji", () => {
    expect(resolvePresetId({ instance: "domino", user: "customs" })).toBe("customs")
  })

  it("preset instancji wchodzi, gdy user nic nie wybrał", () => {
    expect(resolvePresetId({ instance: "domino", user: null })).toBe("domino")
  })

  it("bez żadnego źródła zostaje wartość domyślna", () => {
    expect(resolvePresetId({})).toBe(DEFAULT_PRESET)
  })

  // E5 poda tu wartości Z BAZY, więc „nieznany identyfikator” to nie przypadek
  // teoretyczny, tylko preset skasowany z rejestru po tym, jak ktoś go wybrał.
  //
  // Wartownik jest celowo NIEMOŻLIWY do awansowania na preset. Kuszące
  // „kanagawa” byłoby błędem: Kanagawa Dragon to realny skin na `main`
  // (`bfc4973`), więc gdyby kiedyś trafił do rejestru, ten test po cichu
  // zacząłby asertować tezę odwrotną do swojej nazwy.
  it("nieznany identyfikator jest ignorowany, a nie propagowany", () => {
    expect(resolvePresetId({ user: NIE_PRESET })).toBe(DEFAULT_PRESET)
    expect(resolvePresetId({ instance: NIE_PRESET, user: "domino" })).toBe("domino")
  })

  // Dokładnie ten wynik daje `"toString" in PRESETS` — prawda przez prototyp.
  // `PRESETS["toString"]` byłoby wtedy funkcją w miejscu typowanym na `Preset`.
  it("nazwa z prototypu Object nie jest presetem", () => {
    expect(resolvePresetId({ user: "toString" })).toBe(DEFAULT_PRESET)
    expect(resolvePresetId({ user: "constructor" })).toBe(DEFAULT_PRESET)
  })
})

describe("pozycja „domyślny instancji” w przełączniku", () => {
  // Sedno: droga POWROTU do „nic nie wybrałem” musi istnieć w kontrakcie,
  // inaczej pierwszy wybór w E4 jest nieodwracalny i preset instancji z E5
  // nie dosięgnie już nikogo, kto raz kliknął.
  it("wybór pozycji „dziedzicz” zapisuje brak wyboru, nie preset", () => {
    expect(presetChoiceToStored(INSTANCE_DEFAULT_ID)).toBeNull()
    expect(storedToPresetChoice(null)).toBe(INSTANCE_DEFAULT_ID)
  })

  it("dla presetu obie strony mapowania są tożsamościowe", () => {
    for (const preset of Object.values(PRESETS)) {
      expect(presetChoiceToStored(preset.id)).toBe(preset.id)
      expect(storedToPresetChoice(preset.id)).toBe(preset.id)
    }
  })

  // Gdyby wartownik zderzył się z identyfikatorem presetu, „dziedzicz”
  // zapisywałoby ten preset — czyli dokładnie to, czemu ma zapobiegać.
  it("wartownik nie jest identyfikatorem presetu", () => {
    expect(isPresetId(INSTANCE_DEFAULT_ID)).toBe(false)
    expect(resolvePresetId({ user: INSTANCE_DEFAULT_ID })).toBe(DEFAULT_PRESET)
  })

  it("lista dla przełącznika to „dziedzicz” plus każdy preset", () => {
    expect(presetChoices(identity).map((choice) => choice.id)).toEqual([
      INSTANCE_DEFAULT_ID,
      ...Object.keys(PRESETS),
    ])
  })

  /**
   * Pełna pętla przez STORE, nie przez same mappery — bo dokładnie tak wpięty
   * jest przełącznik w `shell-header.tsx` i `topbar.tsx`:
   * `setPreset(presetChoiceToStored(id))` przy kliknięciu,
   * `storedToPresetChoice(store.preset)` przy renderze. Mappery przetestowane
   * osobno przechodzą także wtedy, gdy store nie umie przyjąć `null` — a to
   * była właśnie luka z E3, przez którą pierwsze kliknięcie byłoby drzwiami
   * w jedną stronę. Pętla obejmuje pozycję „dziedzicz” PO wybraniu presetu,
   * więc bada powrót, a nie stan początkowy.
   */
  it("każdy wybór z przełącznika wraca ze store'a jako ten sam wybór", () => {
    for (const choice of [...presetChoices(identity), ...presetChoices(identity)]) {
      usePresetStore.getState().setPreset(presetChoiceToStored(choice.id))
      expect(storedToPresetChoice(usePresetStore.getState().preset)).toBe(choice.id)
    }
  })

  it("powrót na „dziedzicz” czyści wybór do `null`, a nie do presetu domyślnego", () => {
    usePresetStore.getState().setPreset("domino")
    expect(usePresetStore.getState().preset).toBe("domino")

    usePresetStore.getState().setPreset(presetChoiceToStored(INSTANCE_DEFAULT_ID))

    // `null`, nie `"neutral"`: gdyby czyszczenie zapisywało preset domyślny,
    // wartość instancji z E5 przegrywałaby z „wyborem” użytkownika, którego
    // nigdy nie dokonał.
    expect(usePresetStore.getState().preset).toBeNull()
    expect(resolvePresetId({ instance: "domino", user: usePresetStore.getState().preset })).toBe(
      "domino",
    )
  })
})

describe("migracja wyboru ze skin-store", () => {
  // Kształt wprost ze `skin-store.ts` sprzed E3: `{ skin: SkinId }` pod
  // kluczem `cortex.skin`, wersja 0.
  it("Customs zostaje Customs — bez tego wdrożenie E3 przemalowuje aplikację", () => {
    expect(migrateLegacySkin({ skin: "customs" })).toEqual({ preset: "customs" })
  })

  it("skin domyślny staje się presetem Neutral", () => {
    expect(migrateLegacySkin({ skin: "default" })).toEqual({ preset: "neutral" })
  })

  it("nieznany albo uszkodzony wpis daje brak wyboru, nie wyjątek", () => {
    expect(migrateLegacySkin({ skin: NIE_PRESET })).toEqual({ preset: null })
    expect(migrateLegacySkin({ skin: 7 })).toEqual({ preset: null })
    expect(migrateLegacySkin({})).toEqual({ preset: null })
    expect(migrateLegacySkin(null)).toEqual({ preset: null })
    expect(migrateLegacySkin("customs")).toEqual({ preset: null })
  })
})
