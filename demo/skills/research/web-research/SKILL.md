---
name: web-research
description: Research internetowy z cytowanymi źródłami (narzędzie cli__web_search). Użyj, gdy user prosi o research, analizę rynku, zebranie informacji z sieci, weryfikację faktów albo raport ze źródłami.
---

# Web research z cytatami

Zbierasz informacje z sieci narzędziem `cli__web_search` i oddajesz raport z numerowanymi przypisami. Nigdy nie odpowiadasz "z głowy" tam, gdzie user prosi o research - każde istotne twierdzenie ma źródło.

## Narzędzie

`cli__web_search` przyjmuje listę argumentów:

- `["<zapytanie>"]` - proste wyszukanie (model sonar)
- `["<zapytanie>", "--model", "sonar-pro"]` - pytania złożone, wieloaspektowe
- `["<zapytanie>", "--recency", "month"]` - tylko świeże źródła (day/week/month/year)
- `["<zapytanie>", "--domains", "arxiv.org,nature.com"]` - filtr domen (prefiks `-` wyklucza)
- `["<zapytanie>", "--academic"]` - tryb akademicki

Wynik = odpowiedź + sekcja `Sources:` z numerowanymi URL-ami.

## Kroki

1. Rozbij pytanie usera na 2-4 zapytania z różnych kątów (definicja/stan rzeczy, liczby/dane, konkurencja/alternatywy, ryzyka/krytyka). Zapytania formułuj po angielsku, chyba że temat jest lokalny (polski rynek, polskie prawo).
2. Wykonaj wyszukania. Jeśli wynik jest płytki, doprecyzuj zapytanie i powtórz (max 6 wywołań łącznie).
3. Napisz raport do `artifacts/<slug>-research.md`:
   - `## Streszczenie` - 3-5 zdań "so what" dla decydenta,
   - `## Ustalenia` - sekcje tematyczne; każde twierdzenie z przypisem `[n]`,
   - `## Rozbieżności` - tylko gdy źródła się nie zgadzają (napisz, które i o co),
   - `## Źródła` - numerowana lista URL-i zebranych ze WSZYSTKICH wyszukań (przenumeruj spójnie).
4. W odpowiedzi na czacie: 2-3 zdania najważniejszych wniosków + nazwa pliku raportu.

## Zasady

- Nie wymyślaj źródeł ani URL-i - w raporcie mogą być wyłącznie linki zwrócone przez narzędzie.
- Liczby i daty zawsze z przypisem; brak danych = napisz "brak danych", nie szacuj po cichu.
- Raport po polsku, chyba że user poprosi o inny język.
