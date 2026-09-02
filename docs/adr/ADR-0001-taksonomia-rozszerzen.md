# ADR-0001 — Taksonomia rozszerzeń Biurka

Status: **Proponowany** (02.09.2026) · Zastępuje: brak · Dotyczy: `packages/@cortex/desk-*`, `apps/desk`

> Pierwszy ADR w tym repozytorium. Ustala też konwencję dla następnych: `docs/adr/ADR-000N-slug.md`,
> nagłówek `# ADR-000N — Tytuł`, linia `Status:` z datą. Konwencja przeniesiona z `cortex2`.

## Kontekst

W Biurku dochodzą naraz rzeczy, które nie mają dziś wspólnego miejsca ani wspólnej nazwy:
czytanie PDF/DOCX/XLSX (usługa `services/document-parser` stoi w compose i nie jest wołana
przez Biurko ani razu), procedury firmowe pisane przez człowieka, wykresy, serwery MCP
(już są) i zdolności (już są). W obiegu krąży sześć słów na te rzeczy — narzędzie, zdolność,
umiejętność, skill, konektor, serwer MCP — i część z nich znaczy na ekranie co innego
niż w rozmowie.

Ryzyko nie jest teoretyczne. W zbadanym krajobrazie OSS każdy system, który dopuścił
kolizję nazw, płaci za nią bezterminowo. Open WebUI ma pięć różnych rzeczy zwanych „Tool"
i własne zdanie w dokumentacji: *„the names don't always map obviously to what they do"*.
LobeHub ma dwa różne obiekty, dwie tabele i dwa sklepy pod słowem „Skill".

Jednocześnie **„umiejętność" jest w Biurku już zajęta** — to dzisiejsze słowo ekranowe dla
`capability`. Zweryfikowane w `packages/@cortex/desk-ui/src/i18n/pl.json`: `capabilities.search`
(„Szukaj wśród **umiejętności**"), `otherRequest.lead` („stanie się nową **umiejętnością**"),
`supervision.gapsLead` („do rozważenia jako nowe **umiejętności**").

## Rozważane warianty

**W1 · Bez nowego pojęcia — procedura jako długie wspomnienie w Pamięci.**
Zero nowych bytów. Odrzucone: pamięć jest z definicji prywatna i bez podpisu przełożonego,
a procedura firmowa musi mieć autora odpowiedzialnego wobec firmy, wydania i wycofanie.
Poza tym całość pamięci jedzie do modelu w każdej turze — procedury nie mogą.

**W2 · Jedno pojęcie „umiejętność" obejmujące czynności i procedury.**
Najkrótsza lista nazw. Odrzucone: skleiłoby kod z daną, a przede wszystkim odebrałoby słowo,
które dziś na ekranie znaczy `capability`. To jest dokładnie ruch, który w LobeHub dał dwa
byty pod jedną nazwą. Wprowadzenie nowej nazwy kosztuje jedno zdanie w słowniku;
przeniesienie starej kosztuje bezterminowo.

**W3 · Pięć pojęć: czynność, zdolność, procedura, pamięć, źródło.**
Odrzucone: „źródło" jest **polem na czynności** (`ToolCard.source`, `DeskEvent.tool_start.source`),
a nie rodzajem rzeczy. Wyniesienie go do pojęcia zaprosiłoby drugi model uprawnień dla MCP.

**W4 · Procedury globalne ORAZ per użytkownik, z nadpisywaniem (wzorzec LibreChat
`DEPLOYMENT_SKILLS_DIR`).** Odrzucone: dwa źródła prawdy dla jednej decyzji. LibreChat płaci
za to regułą „YAML zasiewa, chyba że jawnie ustawione — wtedy nadpisuje przy restarcie",
opisaną w ich własnej dokumentacji błędnie; operator zmienia coś w panelu, restartuje
kontener i zmiana znika. Co gorsza, przy kolizji nazw ich skill użytkownika **znika z listy
bez sygnału w UI** — jedynym śladem jest `logger.warn` raz na proces. Warstwa per-user
w Biurku już istnieje i nazywa się Pamięć.

## Decyzja

**Cztery pojęcia, każde z jednozdaniową definicją i testem rozstrzygającym:**

| Ekran | Kod | Definicja |
|---|---|---|
| **czynność** | `tool` | kod, który robi coś ze światem albo wnosi treść do sprawy; wywołuje go model i ZAWSZE zostawia parę `tool_start`/`tool_end` |
| **zdolność** | `capability` | prawo do użycia klasy czynności, z działem-właścicielem zgody — nie rzecz, tylko pozwolenie na rzecz |
| **procedura** | `procedure` | tekst człowieka z firmy, jak się u nas coś robi; wydaje przełożony pod nazwiskiem, model sięga po nią czynnością |
| **pamięć** | `memory` | krótkie zdania o tej jednej osobie, jej własność, bez śladu w dowodzie |

Plus **jeden atrybut, świadomie nie-pojęcie**: `source` — skąd czynność pochodzi.

**Testy rozstrzygające** (mają być cytowane w recenzji, nie odtwarzane z pamięci):

- **czynność czy zdolność?** Jeśli da się to wyłączyć jednej osobie **bez wdrożenia** — zdolność.
  Jeśli wyłączenie wymaga usunięcia z rejestru, czyli nowej wersji aplikacji — czynność. Relacja N:1.
- **kiedy dochodzi NOWA zdolność?** Muszą przejść **oba**: *test wiersza* (czy pracownik ma to
  zobaczyć jako osobną pozycję na „Co potrafię") i *test rozłączności* (czy istnieje sytuacja,
  w której ktoś ma mieć A, a nie mieć B).
- **czynność czy procedura?** Jeśli zmiana **musi** wymagać wdrożenia, bo to kod — czynność.
  Jeśli **nie wolno**, żeby wymagała, bo wie to księgowa a nie programista — procedura.
- **procedura czy pamięć?** Gdyby ta osoba jutro odeszła z firmy — rzecz zostaje? procedura.
  Odchodzi z nią? pamięć.
- **procedura czy prompt systemowy?** Czy zmiana tego zdania psuje obietnicę produktu?
  Tak → doktryna, zostaje kodem i klient nie ma do niej dostępu. Nie → procedura firmy.
- **czy to w ogóle nowe pojęcie?** Jeśli usunięcie z taksonomii niczego nie psuje, bo jest to
  pole na czynności — to jest polem.

### Postanowienia

1. **„Umiejętność" zostaje przy `capability`** i nie wolno jej przenieść na nic innego.
   „Skill" żyje wyłącznie jako nazwa formatu pliku `SKILL.md` — tak jak mówimy „docx".
   „Narzędzie" znaczy wyłącznie „to, co serwer MCP wystawia, **zanim** człowiek to podpisze";
   po podpisie to czynność.

2. **Procedury są tylko firmowe.** Warstwa per-użytkownik to Pamięć — wiersz w bazie,
   30 × 400 znaków, prywatna. Pracownik, który chce własnej procedury, składa propozycję
   do przełożonego (ta sama pętla co `access_request` z `capability='other'`). Rzecz krótka
   („faktury dostaję jako CSV z kolumnami…") ma trafić do Pamięci od razu, bez czekania.

   Symetria jest ścisła: o **tej osobie** podpisuje ta osoba, o **pracy firmy** podpisuje
   przełożony. Trzeciej kombinacji nie ma.

3. **Plik zasiewa, baza rządzi.** `seed/procedures/**/SKILL.md` wsypuje się do
   `desk.procedure` / `desk.procedure_edition` **wyłącznie gdy tabela jest pusta** — ten sam
   kształt, co `seedCatalogue()` w `mcp/catalogue-store.ts`, gdzie uzasadnienie brzmi:
   *zgoda ma należeć do przełożonego i mieć jego nazwisko, datę i możliwość wycofania bez
   wdrożenia nowej wersji aplikacji*. Nowe wydanie od dostawcy trafia po aktualizacji obrazu
   do „Do decyzji" jako **propozycja**, nigdy jako nadpisanie. Odcisk i schemat pochodzą
   od dostawcy; nazwa dla ludzi, zasięg, tryb i status należą do zatwierdzającego.

4. **Procedura wchodzi do tury przez CZYNNOŚĆ `open_procedure`**, nie przez ciche
   wstrzyknięcie — bo bez zdarzenia nie ma dowodu. Trzy tryby:
   - `index` (domyślny) — nazwa i jedno zdanie w prompcie, treść na żądanie, koszt zero do użycia;
   - `always` — treść w prompcie każdej tury, z limitem znaków i licznikiem na ekranie przełożonego;
   - `paths` — wskazówka doklejana do **odpowiedzi dla modelu** przy dotknięciu pasującej
     ścieżki, **nigdy do `summary`**, bo `summary` jest dowodem, a podpowiedź nie jest zdarzeniem.

   Dowód zyskuje przez to piątą listę — **„Wg czego"**: *procedura «Zestawienie VAT»,
   wydanie 3, wydał Robert Nowak 12.09.2026*. Żaden z dziewięciu zbadanych systemów tego
   nie ma, a w biurze rachunkowym to gotowy dowód należytej staranności.

5. **Procedura to wyłącznie tekst.** Import `SKILL.md` ze `scripts/`, `allowed-tools`,
   `hooks` albo `context: fork` jest **odrzucany z komunikatem**, nie ignorowany po cichu.
   Skrypt w procedurze to narzędzie bez bramki narzędziowej.

6. **Prompt systemowy rozpada się na dwoje.** Doktryna produktu (jak rozmawiasz, czego nigdy
   nie robisz, reguła dowodu) zostaje kodem i klient nie ma do niej dostępu; „jak pracujemy
   u nas" staje się procedurą `zasady-firmy` w trybie `always`.

7. **Nowa zdolność powstaje tylko wtedy, gdy przechodzi OBA testy** z listy wyżej.
   Rozstrzygnięcia dla rzeczy, które dochodzą teraz: `document.read` — tak; `chart.draw` — tak;
   zapis `.md` zamiast `.txt` — nie, to zmiana opisu istniejącej zdolności.

8. **Czytanie dokumentów jest OSOBNĄ czynnością, a nie rozszerzeniem `read_file`** — i to nie
   jest kosmetyka. `services/document-parser` to potok **vision-LLM**: render stron przez
   `pypdfium2`, potem wywołanie modelu przez cortex-proxy (`src/pipeline.py`, `config.py`
   z `vision_model` i `MAX_PAGES=20`). Treść PDF-a odczytana tą drogą **jest tekstem modelu**,
   a produkt, którego cała teza brzmi „dowód nigdy nie pochodzi z tekstu modelu", nie może
   tego schować pod tym samym zdaniem co `read_file` czytające bajty z dysku. Stąd: osobna
   karta, osobna fraza dowodu („**rozpoznano** faktura.pdf — 3 strony"), i obowiązkowe
   wyniesienie obcięcia (`MAX_PAGES`) do podsumowania.

9. **Nie ma trzeciej roli.** Powierzchnia admina to wdrożenie (`seed/**`, zmienne środowiskowe,
   compose), nie ekran. Jedyna rzecz, którą admin robiłby ponad przełożonego — podanie adresu
   serwera MCP — już dziś należy do przełożonego.

10. **Źródło czynności czyta się z POLA zdarzenia, nigdy z nazwy.** `hygiene.toolKey()` buduje
    klucz `mcp_<serwer>_<narzędzie>`, a `tool-cards.serverFromKey()` odczytuje z niego serwer
    regexem — z komentarzem w kodzie, że nie rozróżni serwera `vat-registry` od `vat`. To jest
    w zalążku wada, którą LibreChat spłaca do końca życia projektu (`agent.tools[]` jako płaska
    tablica stringów z czterema rodzajami bytów zakodowanymi separatorami). Parsowanie prefiksu
    zostaje **wyłącznie** jako ścieżka dla zdarzeń zapisanych przed wprowadzeniem pola `source`.

## Konsekwencje

**Dobre.** Dodanie czynności to jeden nowy plik plus wpis w katalogu i słowniku, pilnowane
bramką `catalogue-coverage.test.ts`, która zapala się sama. Dodanie procedury nie wymaga
programisty ani wdrożenia — czas przełożonego to kilka minut, wobec 15–30 minut na przyjęcie
jednego narzędzia MCP. Taksonomia jest **obojętna na to, gdzie czynność jest zaimplementowana**:
wbudowana, usługa w compose, serwer MCP — dla pracownika, dowodu i bramy to ta sama rzecz.

**Kosztowne.** `runtime.ts` traci definicje narzędzi i treść promptu (ok. 400 linii do
przeniesienia, zero zmian zachowania). `evidence.ts` dostaje piątą listę i nowy nagłówek
w słowniku. Tryb `always` i indeks procedur wchodzą do KAŻDEJ tury, więc procedury mają koszt
per-tura — próg trzeba **zmierzyć**, nie przepisać z cudzych zaleceń.

**Zamknięte drogi.** Procedury per użytkownik jako osobny byt. Drugi model uprawnień dla MCP.
Skrypty w procedurach. Trzecia rola. Przeniesienie słowa „umiejętność" na cokolwiek innego.

## Czego ta decyzja NIE rozstrzyga

1. Co zrobić, gdy model **nie otworzył** procedury mimo pasującego wyzwalacza. Instrukcja
   w markdownie to porada, nie gwarancja; jeśli procedura MUSI się wykonać, potrzebny jest
   deterministyczny punkt przechwytu (kandydat: kształt `promises.ts`).
2. Uprawnienie do **wspólnego katalogu dokumentów firmowych** (A6) — to warstwa plików,
   nie warstwa rozszerzeń, ale trzeba wybrać między zdolnością, ACL na katalogu a zasięgiem.
3. Czy `read_document` docelowo idzie przez serwer MCP. Taksonomia jest na to obojętna,
   bo `source` jest polem — ale wybór trzeba zrobić razem z decyzją o bramie MCP.
4. Próg kosztu dla trybu `always` i indeksu. Limit musi istnieć; liczby nie znam i nie
   przepisuję cudzej.
5. Kto w firmie wielodziałowej jest właścicielem procedury. Zdolność ma dział-właściciela
   zgody; procedura ma dziś tylko rolę `management`, więc przełożony marketingu może wydać
   procedurę księgową. Luka organizacyjna, nie techniczna.
6. Przenośność między instancjami i podpis odcisku. Specyfikacja `SKILL.md` **nie ma żadnego
   mechanizmu podpisu ani sprawdzania integralności** — łańcuch zaufania trzeba zbudować
   samemu, tak jak Biurko zbudowało go dla MCP.
7. Dwujęzyczność procedur. Interfejs ma `pl` i `en`; procedurę pisze człowiek po polsku
   i idzie ona do modelu dosłownie.
8. Czy rozdzielić `capabilities.json` — poza katalogiem zdolności leżą tam `limits`,
   `quickTasks` i `departments`, trzy byty o innym cyklu życia w jednym pliku.
