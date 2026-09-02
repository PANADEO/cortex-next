---
name: desk-catalogue
description: Taksonomia rozszerzeń Biurka (apps/desk, packages/@cortex/desk-*) — czynność / zdolność / procedura / pamięć. Użyj przy dodawaniu narzędzia agenta, nowej zdolności, procedury firmowej albo przy nazywaniu czegokolwiek w tym obszarze. NIE dla kafelków powłoki (→ code-tile) ani dla tras BFF (→ code-api). Decyzja: docs/adr/ADR-0001-taksonomia-rozszerzen.md.
---

# desk-catalogue

## Najpierw: cztery nazwy i ani jednej więcej

```
                        KTO POCIĄGA ZA SPUST
             model            przełożony         pracownik
              │                    │                 │
   ┌──────────▼──────────┐         │                 │
   │     CZYNNOŚĆ        │         │                 │
   │  para zdarzeń       │         │                 │
   │  wiersz w dowodzie  │         │                 │
   └──────────┬──────────┘         │                 │
              │ przechodzi przez   │ nadaje          │
   ┌──────────▼──────────┐◄────────┘                 │
   │     ZDOLNOŚĆ        │  brak → wiersz            │
   │  prawo, nie rzecz   │  „Na to nie masz zgody"   │
   └─────────────────────┘                           │
                                                     │
   ┌─────────────────────┐         ┌─────────────────▼───┐
   │     PROCEDURA       │◄────────┤      PAMIĘĆ         │
   │ model sięga po nią  │ wydaje  │ wchodzi zawsze      │
   │ wiersz „Wg czego"   │         │ BEZ śladu w dowodzie│
   │ FIRMOWA             │         │ PRYWATNA            │
   └─────────────────────┘         └─────────────────────┘
```

| Ekran | Kod | Jednym zdaniem |
|---|---|---|
| **czynność** | `tool` | kod, który robi coś ze światem albo wnosi treść; woła go model i ZAWSZE zostawia parę zdarzeń |
| **zdolność** | `capability` | prawo do klasy czynności, z działem-właścicielem zgody |
| **procedura** | `procedure` | tekst człowieka z firmy „jak się u nas to robi"; wydaje przełożony |
| **pamięć** | `memory` | zdania o tej jednej osobie, jej własność, bez śladu w dowodzie |

`source` (skąd czynność pochodzi) to **pole na czynności**, nie piąte pojęcie.

## Słowa ZAKAZANE i czym je zastąpić

| Nie pisz | Bo | Pisz |
|---|---|---|
| „umiejętność" na cokolwiek poza `capability` | **zajęte** — `capabilities.search`, `otherRequest.lead`, `supervision.gapsLead` już tak mówią o zdolnościach | „procedura" albo „czynność" |
| „skill" jako pojęcie | angielski cień „umiejętności" | wyłącznie jako nazwa formatu pliku: `SKILL.md` |
| „narzędzie" o czymś podpisanym | po podpisie to czynność Biurka | „narzędzie" TYLKO o tym, co serwer MCP wystawia **przed** podpisem |
| „konektor", „wtyczka", „plugin", „agent", „przepis", „instrukcja", „workspace" | odrzucone w ADR-0001 z uzasadnieniem | patrz tabela wyżej |

„Przepis" jest szczególnie zły: w księgowości znaczy przepis prawa.

## Testy rozstrzygające — cytuj je, nie odtwarzaj z pamięci

**① czynność czy zdolność?**
Da się wyłączyć jednej osobie **bez wdrożenia** → zdolność. Wyłączenie wymaga nowej wersji
aplikacji → czynność. Relacja N:1 — wiele czynności przez jedną zdolność.

**② kiedy NOWA zdolność?** Muszą przejść **oba**:
- *test wiersza* — czy pracownik ma to zobaczyć jako osobną pozycję na „Co potrafię"?
- *test rozłączności* — czy istnieje sytuacja, w której ktoś ma mieć A, a nie mieć B?

Zapis `.md` zamiast `.txt` → oba NIE → zmienia się opis istniejącej zdolności.
Czytanie PDF → oba TAK → `document.read`. Wykres → oba TAK → `chart.draw`.

**③ czynność czy procedura?**
Zmiana **musi** wymagać wdrożenia, bo to kod → czynność. **Nie wolno**, żeby wymagała,
bo wie to księgowa a nie programista → procedura.

**④ procedura czy pamięć?**
Gdyby ta osoba jutro odeszła z firmy — rzecz zostaje? procedura. Odchodzi z nią? pamięć.

**⑤ procedura czy prompt systemowy?**
Zmiana tego zdania psuje obietnicę produktu? → doktryna, zostaje kodem. Nie? → procedura.

**⑥ czy to w ogóle nowe pojęcie?**
Usunięcie z taksonomii niczego nie psuje, bo to pole na czynności → **jest polem**.

## Dodanie CZYNNOŚCI — sześć kroków, wszystkie mechaniczne

```
1. seed/capabilities.json      {id, department} + id do właściwych "roles"
                               ← TYLKO gdy oba testy z ② dają „tak"
2. i18n/pl.json + en.json      capability.<id>.name / .description
                               tools.<nazwa>.running / .ok
                               tools.groups.<klucz>   ← Z FORMAMI LICZBY MNOGIEJ
                               tools.evidence.<fraza>
3. src/tools/<nazwa>.ts        JEDEN plik: kontrakt + karta + wykonanie
4. src/tools/registry.ts       jedna linia importu
5. apps/desk/e2e/NN-*.spec.ts  jeden „Obszar N · <intencja po polsku>"
6. npm run gate:desk           bramka powie, czego brakuje
```

## Pułapki, które już nas kosztowały

**Dowód powstaje WYŁĄCZNIE ze zdarzeń.** Czego nie ma w `tool_start`/`tool_end`, tego dla
sprawy nie było. `run_computation` montował pliki z biurka i liczył na nich, ale do zdarzenia
szedł sam opis — więc sprawa policzona w piaskownicy w całości twierdziła w panelu, że
„dokument powstał bez odczytania choćby jednego pliku z biurka". Nieprawda w jedynym miejscu,
które nie ma prawa się mylić.

**`kind` i „co weszło" to DWIE OSIE.** `kind` mówi, czym czynność jest; `inputs` mówi, co do
sprawy weszło. Zmieszanie ich było przyczyną błędu wyżej. Obliczenie nie jest odczytaniem —
człowiek ma widzieć, że plik wszedł jako dane, a nie jako lektura.

**Źródło czyta się z POLA `DeskEvent.tool_start.source`, nigdy z nazwy.** Parsowanie prefiksu
`mcp_<serwer>_<narzędzie>` nie rozróżni serwera `vat-registry` od `vat` i zostaje wyłącznie
jako ścieżka dla zdarzeń sprzed wprowadzenia tego pola.

**Każde obcięcie musi być widoczne.** `read_file` ucina po 60 tys. znaków, stdout piaskownicy
po 64 KB, `document-parser` po `MAX_PAGES=20`. Wynik obcięty nieodróżnialny od kompletnego to
ta sama klasa błędu trzy razy.

**Czytanie dokumentów to NIE rozszerzenie `read_file`.** `services/document-parser` to potok
vision-LLM (`pypdfium2` → model przez cortex-proxy). Treść PDF-a odczytana tą drogą **jest
tekstem modelu** — osobna czynność, osobna karta, osobna fraza dowodu („rozpoznano").

**Polski cudzysłów zamykający `”` w napisie TypeScript.** `"tekst „coś"”` — prosty `"`
zamykający cytat **kończy napis**. Ten błąd wraca; używaj `”` (U+201D).

## Procedury — czego NIE robimy

- **Nie ma procedur per użytkownik.** Warstwa prywatna istnieje i nazywa się Pamięć.
  Chce własnej → „Zaproponuj procedurę" do przełożonego. Rzecz krótka → wprost do Pamięci.
- **Plik zasiewa, baza rządzi.** `seed/procedures/**` wsypuje się tylko gdy tabela pusta —
  ten sam kształt co `seedCatalogue()`. Nowe wydanie dostawcy to **propozycja**, nie nadpisanie.
- **Procedura to wyłącznie tekst.** `scripts/`, `allowed-tools`, `hooks`, `context: fork` →
  import **odrzucony z komunikatem**, nie zignorowany po cichu. Skrypt w procedurze to
  narzędzie bez bramki narzędziowej.
- **Procedura wchodzi przez czynność `open_procedure`**, nie przez ciche wstrzyknięcie —
  bo bez zdarzenia nie ma dowodu. Wskazówka z trybu `paths` idzie do odpowiedzi dla modelu,
  **nigdy do `summary`**.

## Nie ma trzeciej roli

Powierzchnia admina to wdrożenie (`seed/**`, env, compose), nie ekran. Adres serwera MCP
podaje dziś przełożony i tak zostaje.

## Zobacz też

- `docs/adr/ADR-0001-taksonomia-rozszerzen.md` — decyzja z wariantami odrzuconymi
- `code-i18n` — klucze słownika i formy liczby mnogiej
- `code-seed` — łańcuch seedów i reguła „zasiew tylko gdy pusto"
- `code-e2e` — kształt scenariusza „Obszar N · intencja"
