---
name: code-ui
description: Konwencje UI w cortex-frontend — tylko @cortex/ui + @cortex/styles, zero customowego CSS/inline hex/emoji. Użyj przy pisaniu dowolnego komponentu React/JSX.
---

# code-ui

## Reguły (twarde, bez wyjątków)

1. Komponenty wyłącznie z `@cortex/ui` (shadcn/ui + Radix). Nowy prymityw UI → dodaj do `@cortex/ui`, nie twórz lokalnego odpowiednika w module.
2. Kolory/spacing wyłącznie przez tokeny `@cortex/styles` (CSS variables) — zero inline hex (`#4A90E2` itd.), zero magicznych wartości Tailwind poza tokenami.
3. Zero emoji w UI copy, komentarzach, komunikatach błędów — produkt dla regulowanych klientów enterprise, ma wyglądać intencjonalnie.
4. UI copy po polsku, identyfikatory kodu po angielsku (zmienne, funkcje, nazwy plików).
5. Logo (`app/idp/public/cortex-logo.png`) i kolor marki `cortex` (`#4A90E2` w `tailwind.config.ts`) — nie wymyślać alternatyw.

## Nagłówki stron

`st.subheader`-style hierarchia nieaktualna tu (to reguła ze świata Streamlit) — w Next.js: jeden spójny wzorzec nagłówka strony na kafelek, patrz istniejące `*Form` w `ai-tool-workspace.tsx` jako referencja układu (label + opis + pola + wynik).

## Dark mode

Jeden asset, jeden mechanizm: `<Image className="dark:invert dark:hue-rotate-180" />` dla logo. Nie dodawać osobnych assetów per motyw bez wyraźnej potrzeby.
