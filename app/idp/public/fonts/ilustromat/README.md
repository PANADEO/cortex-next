# Fonty

`NotoSans-Regular.ttf` / `NotoSans-Bold.ttf` to **placeholder**, nie font
brandowy Crido. Wybrany celowo, nie przypadkowo: Noto Sans jest licencjonowany
na SIL Open Font License 1.1 (wolno bundlować w aplikacji), ma pełne wsparcie
polskich znaków diakrytycznych (ą, ć, ę, ł, ń, ó, ś, ź, ż) i jest już używany
w innym kafelku Cortex (`fakturomat/app/fonts/`), więc pochodzenie i licencja
są znane.

## Jak podmienić na font brandowy Crido

Gdy marketing Crido podeśle plik fontu (spec §9, pkt 1 — status na 14.07:
"podeślą później"), wrzuć go tutaj jako:

- `brand-regular.ttf`
- `brand-bold.ttf`

`core/composer.py` (`_FONT_PATHS`) sprawdza te ścieżki jako pierwsze i
automatycznie się na nie przełącza — zero zmian w kodzie. Upewnij się, że
licencja pozwala na użycie w aplikacji webowej (nie tylko desktopowej).
