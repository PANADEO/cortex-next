// ROLA STARTOWA MA UNIEŚĆ CAŁE ZADANIE, nie mieć długą listę pozycji.
//
// DLACZEGO POWSTAŁ. Zestaw zdolności roli `member` siedział w zasiewie od początku i nikt
// go nigdy nie przyłożył do zadania, które ta osoba ma realnie wykonać. Konsylium UI/UX
// zauważyło skutek: „policz sprzedaż za sierpień i zapisz zestawienie" — czyli scenariusz,
// na którym stoi połowa produktu — u szeregowej pracownicy kończył się KŁÓDKĄ, bo brakowało
// `sheet.write` i `code.run`. Najczęstszym ekranem pani Basi była prośba o zgodę, a nie
// wynik pracy, i nic w repozytorium tego nie mówiło.
//
// Test pilnuje ŁAŃCUCHA, nie liczby. Zdolność wypadająca ze środka zrywa zadanie tak samo
// jak wypadająca z końca, a lista długości ośmiu nie mówi o tym nic.
//
// CZEGO NIE PILNUJE: czy zestaw jest właściwy dla KAŻDEGO klienta. Domyślne uprawnienia
// bywają decyzją wdrożeniowa i mogą się różnić — wtedy ten test trzeba świadomie zmienić,
// i o to chodzi, żeby zmiana była świadoma.

import { describe, expect, it } from "vitest"
import capabilities from "../seed/capabilities.json"

const ROLES = capabilities.roles as Record<string, string[]>

/**
 * Zadania biurowe rozpisane na zdolności, których naprawdę wymagają — po jednej na krok,
 * w kolejności, w jakiej agent je wykonuje. Nazwa zadania jest zdaniem człowieka,
 * bo to ono ma się udać, a nie zdolność sama w sobie.
 */
const JOBS = [
  {
    what: "policz sprzedaż za sierpień z faktur i zapisz zestawienie w moich plikach",
    // ZABLOKOWANE, ze wskazaniem CO to zdejmie. To jest zadanie, dla którego to biurko
    // powstało, i właściciel produktu wprost zdecydował, że rola startowa ma je unieść.
    // Nie unosi, bo `code.run` wróciło do przełożonego: dopóki `DESK_SANDBOX_SOCKET`
    // nie wskazuje demona, obliczenia biegną ścieżką zapasową z OTWARTĄ SIECIĄ, a
    // `sandbox.ts` mówi wprost, że w środowisku klienta ta zdolność nie powinna być
    // przyznawana domyślnie. `ensurePerson` zakłada konto każdemu spod bramy logowania,
    // więc znaczyłoby to dowolny kod z internetem dla każdego nowego adresu.
    //
    // Wpis ma ZNIKNĄĆ w dniu podłączenia demona — pilnuje tego test niżej, więc nie da
    // się o nim zapomnieć ani zostawić go jako wygodnej wymówki.
    blocked: "code.run czeka na demona piaskownicy z zamkniętą siecią (cortex-sandbox)",
    steps: [
      ["files.list", "znaleźć faktury na biurku"],
      ["files.read", "przeczytać je"],
      ["code.run", "policzyć sumy"],
      ["sheet.write", "zapisać zestawienie jako arkusz"],
      ["files.keep", "odłożyć wynik do „Moich plików”"],
    ],
  },
  {
    what: "przeczytaj tę fakturę w PDF i napisz z niej notatkę",
    steps: [
      ["document.read", "rozpoznać PDF"],
      ["document.write", "napisać notatkę"],
      ["document.verify", "sprawdzić ją po zapisie"],
      ["files.keep", "odłożyć do „Moich plików”"],
    ],
  },
  {
    what: "zajrzyj do firmowego wzoru pisma na wspólnej półce",
    steps: [["shared.read", "wejść na wspólną półkę"]],
  },
]

describe("rola startowa unosi zadanie, nie tylko listę", () => {
  it("w ogóle widzi role z zasiewu", () => {
    // Bez tego cały plik mógłby być zielony dlatego, że nic nie sprawdził.
    expect(Object.keys(ROLES)).toContain("member")
    expect(ROLES["member"]?.length ?? 0).toBeGreaterThan(5)
  })

  it.each(JOBS.map((job) => [job.what, job] as const))(
    "pracownica („member”) potrafi: %s",
    (_what, job) => {
      const has = new Set(ROLES["member"] ?? [])
      const missing = job.steps
        .filter(([capability]) => !has.has(capability as string))
        .map(([capability, why]) => `${capability} — bez tego nie da się ${why}`)
      const blocked = (job as { blocked?: string }).blocked
      if (blocked) {
        // Luka NAZWANA jest czymś innym niż luka przemilczana — ale tylko dopóki
        // naprawdę istnieje. Wpis, który przestał blokować, ma zniknąć.
        expect(
          missing.length,
          `„${blocked}” już nie blokuje — skreśl pole blocked z tego zadania`,
        ).toBeGreaterThan(0)
        expect(blocked.length).toBeGreaterThan(20)
        return
      }
      expect(missing).toEqual([])
    },
  )

  /**
   * ZLECENIE STARTOWE, KTÓREGO ROLA NIE UNIESIE, JEST OBIETNICĄ BEZ POKRYCIA.
   *
   * Te zdania stoją na pustym ekranie jako gotowe do kliknięcia — czyli jako pierwsza
   * rzecz, jaką pani Basia w tym produkcie robi. Zlecenie prowadzące prosto do kłódki
   * jest gorsze niż jego brak: uczy w pierwszej minucie, że narzędzie mówi „nie".
   *
   * Rzecz wyszła przy weryfikacji decyzji o arkuszach: rola dostała `sheet.write`
   * i `code.run`, a zlecenia startowe zostały dokumentowe — pół decyzji, i to takie
   * pół, którego nikt by nie zauważył, bo nic nie pęka.
   */
  //
  // WYMIENIAMY TO, BEZ CZEGO ZADANIA NIE DA SIĘ WYKONAĆ — nie to, co je poprawia.
  // Rozróżnienie jest istotne: liczenie w piaskownicy daje wynik pewniejszy niż rachunek
  // modelu w głowie, ale zestawienie z dziesięciu faktur powstanie i bez niej. Wpisanie
  // `code.run` jako wymogu zamieniłoby ten strażnik w zapis MOICH przekonań o tym, jak
  // zadanie powinno przebiegać, a on ma pilnować jednej rzeczy: czy zlecenie z pustego
  // ekranu prowadzi do kłódki.
  //
  // SPRAWDZONE NA ŻYWYM MODELU, nie wydedukowane. Zarzut brzmiał: zlecenia mówią „policz",
  // `CAPABILITY_HINTS` mapuje „policz" na `code.run`, więc trzy z pięciu prowadzą do kłódki.
  // Scenariusz `16-zespol.spec.ts` („pani Basia dowozi bez proszenia o zgodę", `@model`)
  // przepuszcza to zlecenie przez prawdziwą turę: kłódki nie ma, arkusz powstaje. Zdjęcie
  // roli `sheet.write` zapala go na czerwono, więc mierzy to, co trzeba. `HINTS` NAZYWA
  // zdolność w chwili zgłoszenia braku — nie wymaga jej.
  const NEEDS: Record<string, string[]> = {
    expensesDocument: ["files.read", "document.write", "files.keep"],
    expensesSheet: ["files.read", "sheet.write", "files.keep"],
    analysis: ["files.read", "document.write"],
    documentGaps: ["files.read", "document.read"],
    meetingNotes: ["document.write"],
    titleImage: ["image.generate"],
  }

  it.each(Object.keys(ROLES).map((role) => [role, role] as const))(
    "każde zlecenie startowe roli „%s” da się wykonać jej uprawnieniami",
    (_n, role) => {
      const has = new Set(ROLES[role] ?? [])
      const offered = (capabilities.quickTasks as Record<string, string[]>)[role] ?? []
      expect(offered.length, `rola ${role} nie ma ani jednego zlecenia startowego`).toBeGreaterThan(
        0,
      )
      const broken = offered.flatMap((task) => {
        const needed = NEEDS[task]
        if (!needed) return [`${task} — brak wpisu w NEEDS; dopisz, czego wymaga`]
        return needed
          .filter((capability) => !has.has(capability))
          .map((capability) => `${task} prowadzi do kłódki: brakuje ${capability}`)
      })
      expect(broken).toEqual([])
    },
  )

  it("przełożony potrafi wszystko, co pracownica", () => {
    // Rola wyższa, która czegoś NIE umie, to najbardziej mylący możliwy stan: przełożony
    // nadaje uprawnienie, którego sam nie ma, i nie rozumie, czemu u niego nie działa.
    const member = new Set(ROLES["member"] ?? [])
    const management = new Set(ROLES["management"] ?? [])
    expect([...member].filter((one) => !management.has(one))).toEqual([])
  })

  it("generowanie obrazów zostaje przy przełożonym", () => {
    // Świadome ODSTĘPSTWO od reszty tego pliku, wpisane tu, żeby zmiana była decyzją,
    // a nie przypadkiem: obraz nie jest ani liczeniem, ani arkuszem, kosztuje osobno przy
    // każdym wywołaniu i nie należy do zadań, dla których to biurko powstało.
    expect(ROLES["member"]).not.toContain("image.generate")
    expect(ROLES["management"]).toContain("image.generate")
  })
})
