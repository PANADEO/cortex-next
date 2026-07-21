---
name: visual-generate
description: Generuje obraz (PNG) w zadanym stylu wizualnym narzędziem cli__generate_image (Gemini). Użyj, gdy user prosi o grafikę, ilustrację, wizual do posta, okładkę albo obrazek w konkretnym stylu.
---

# Generowanie wizuali

Tworzysz obrazy narzędziem `cli__generate_image` i zapisujesz je jako artefakty sesji.

## Narzędzie

`cli__generate_image` przyjmuje listę argumentów:

```
["<prompt po angielsku>", "--style", "<styl>", "--out", "<workspace>/artifacts/<nazwa>.png"]
```

- Prompt obrazu pisz PO ANGIELSKU (wyraźnie lepsze wyniki), nawet gdy rozmowa jest po polsku.
- `--out` MUSI wskazywać katalog `artifacts/` bieżącego workspace (pełna ścieżka) - tylko stamtąd user może pobrać plik.
- Nazwa pliku: krótki slug bez spacji, np. `cortex-launch-hero.png`.
- Sukces = narzędzie wypisuje ścieżkę pliku; błąd trafia na stderr.

## Style

| Styl | Kiedy |
| --- | --- |
| `mckinsey` | publikacje biznesowe, raporty zarządowe, strategia |
| `corporate` | prezentacje firmowe, www, materiały sprzedażowe |
| `infographic` | procesy, dane, osie czasu |
| `isometric` | systemy, architektura, tech w formie "miniaturowego świata" |
| `tech` | AI, software, innowacje (ciemne tło, neon) |
| `minimal` | jeden koncept, dużo światła, elegancja |
| `whiteboard` | warsztaty, notatki procesowe, "zdjęcie z sali" |
| `sketch` | ideacja, szkic koncepcyjny |
| `watercolor` | treści emocjonalne, eleganckie |
| `cartoon` | treści dla dzieci, lekkie |
| `retro` | nostalgia, plakat, mid-century |

Zamiast nazwy stylu można podać własny opis stylu (free-form, po angielsku).

## Kroki

1. Ustal temat i przeznaczenie obrazu. Jeśli user nie podał stylu - dobierz najlepiej pasujący z tabeli i napisz jednym zdaniem, który wybrałeś i czemu (nie blokuj się pytaniem).
2. Napisz prompt: konkretny podmiot + kompozycja + nastrój; bez tekstu na obrazie albo max 3-5 słów (modele słabo renderują dłuższy tekst).
3. Wywołaj narzędzie. Jeśli wynik opisowo nie pasuje do prośby, popraw prompt i wygeneruj raz jeszcze (max 3 próby).
4. Na czacie podaj nazwę pliku i użyty styl.
