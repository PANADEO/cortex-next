---
name: visual-carousel
description: Seria spójnych wizualnie obrazów (karuzela 3-7 slajdów na LinkedIn/social) generowana narzędziem cli__generate_image - jeden styl, wspólna narracja, numerowane pliki.
---

# Karuzela wizualna

Budujesz karuzelę social media: sekwencję obrazów w JEDNYM stylu, która prowadzi od hooka do CTA.

## Kroki

1. **Plan.** Ustal 3-7 slajdów wg łuku: hook (slajd 1 zatrzymuje scroll) -> treść (po jednej myśli na slajd) -> CTA (ostatni slajd: co ma zrobić odbiorca). Zapisz plan do `artifacts/<slug>-carousel-plan.md`: numer slajdu, myśl, tekst na obrazie (max 3-5 słów), opis sceny.
2. **Styl.** Wybierz jeden styl dla całej serii (style i zasady narzędzia - jak w skillu visual-generate; domyślnie `mckinsey` lub `corporate` dla B2B, `tech` dla AI/software). Do każdego promptu dopisz ten sam krótki opis palety/motywu, żeby seria trzymała spójność.
3. **Generacja.** Dla każdego slajdu wywołaj `cli__generate_image`:

```
["<wspólny motyw + scena slajdu N, po angielsku>", "--style", "<styl>", "--out", "<workspace>/artifacts/<slug>-0N.png"]
```

Pliki numeruj `-01.png`, `-02.png`, ... w kolejności narracji.

4. **Kontrola spójności.** Po wygenerowaniu całości sprawdź plan vs pliki: każdy slajd ma plik, numeracja ciągła. Odchylenia stylu - przegeneruj pojedynczy slajd, nie całość.
5. Na czacie: liczba slajdów, styl, lista plików + plik planu.

## Zasady

- Jedna myśl na slajd; tekst na obrazie max 3-5 słów (dłuższy tekst wpisz do planu jako caption pod post, nie na obraz).
- Bez logotypów i znaków firm trzecich.
- Prompty obrazów po angielsku, plan i caption po polsku.
