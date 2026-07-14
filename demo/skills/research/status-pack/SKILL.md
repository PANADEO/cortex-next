---
name: status-pack
description: Zamienia transkrypcję lub notatki ze spotkania (plik w input/ albo tekst wklejony do rozmowy) w pakiet statusowy - TL;DR, decyzje, action items z ownerami, ryzyka i pytania otwarte.
---

# Status pack ze spotkania

Robisz z surowej transkrypcji dokument, który uczestnik może wysłać zespołowi bez wstydu w 2 minuty po spotkaniu.

## Źródło danych

1. Najpierw sprawdź katalog `input/` w workspace - user mógł wgrać plik (txt, md, vtt, srt, docx). Weź najnowszy pasujący plik; przy kilku - zapytaj, o który chodzi.
2. Jeśli w `input/` nic nie ma, użyj treści wklejonej w wiadomości.
3. Transkrypcje bywają zaszumione (literówki ASR, brak interpunkcji) - czytaj przez to, nie cytuj szumu.

## Format wyjścia

Zapisz `artifacts/<slug>-status.md`:

```
# Status: <temat> - <data jeśli znana>

## TL;DR
- 3-5 punktów "so what" (wynik, nie streszczenie przebiegu)

## Decyzje
- każda decyzja jednym zdaniem; brak decyzji = "Brak decyzji na tym spotkaniu"

## Action items

| Kto | Co | Termin |
| --- | --- | --- |

## Ryzyka
- tylko realne, nazwane na spotkaniu

## Pytania otwarte
- co zostało bez rozstrzygnięcia
```

## Zasady

- Nie wymyślaj ownerów ani terminów - jeśli nie padły, wpisz "do przypisania" / "brak terminu".
- Rozróżniaj decyzję ("robimy X") od opinii ("może warto X") - opinie nie wchodzą do Decyzji.
- Nazwiska pisz tak, jak brzmią w transkrypcji; nie zgaduj pełnych imion.
- Dokument po polsku, zwięźle; przed tabelą zostaw pustą linię.
- Na czacie: TL;DR + nazwa pliku.
