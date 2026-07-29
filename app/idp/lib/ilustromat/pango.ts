// JEDNO miejsce, w którym powstaje opis fontu dla Pango — używane i przez
// produkcyjny render (composer.ts), i przez bramkę weryfikacyjną
// (font-verification.ts). To nie jest kosmetyka: bramka ma sens tylko wtedy,
// gdy mierzy DOKŁADNIE ten opis, którym potem pojedzie render. Dwie kopie tej
// samej konkatenacji znaczyłyby, że bramka może przepuścić font, który
// w produkcji złoży się innym krojem — czyli dokładnie to, przed czym broni.
//
// Dlaczego przecinek. `pango_font_description_from_string` przyjmuje format
// "[FAMILY-LIST] [STYLE-OPTIONS] [SIZE]", gdzie FAMILY-LIST to lista rodzin
// oddzielonych przecinkami, OPCJONALNIE ZAKOŃCZONA PRZECINKIEM, a STYLE-OPTIONS
// to słowa opisujące styl/wagę/szerokość. Bez przecinka parser zjada z KOŃCA
// nazwy rodziny każde słowo, które rozpoznaje jako styl — a `Roman`, `Black`,
// `Book`, `Light`, `Medium`, `Condensed`, `Bold`, `Italic` to jego słowa
// kluczowe. Zmierzone w Alpine na tym samym pliku i w tym samym procesie:
//
//   "Times New Roman 64"  -> 801 px (obcięte do rodziny "Times New", cudzy krój)
//   "Times New Roman, 64" -> 720 px (plik daje 730 px — zgodne)
//   "Arial Black 64"      -> 842 px (obcięte do rodziny "Arial")
//   "Arial Black, 64"     -> 948 px (plik daje 946 px — zgodne)
//   "Georgia 64" / "Georgia, 64" -> 761 px w obu (bez słowa kluczowego bez zmian)
//
// Przecinek kończy listę rodzin jawnie, więc nazwa nie jest już parsowana
// przez tę heurystykę. Fonty marek kończą się takim słowem nagminnie
// (Gotham Book, Avenir Book, Futura Medium, Helvetica Neue Light, Trade Gothic
// Condensed, Proxima Nova Black), a bez przecinka renderowałyby się CICHO
// cudzym krojem — bez wyjątku, bez ostrzeżenia.

export interface PangoFontRequest {
  /** Nazwa rodziny dokładnie tak, jak stoi w pliku (fontkit, name ID 1). */
  family: string
  /** Waga MUSI być w opisie — sam `fontfile` jej nie narzuca (LUKA 3). */
  bold: boolean
  /** Rozmiar w punktach; przy dpi 72 równy rozmiarowi w px em. */
  size: number
}

export function pangoFontDescription({ family, bold, size }: PangoFontRequest): string {
  return `${family},${bold ? " Bold" : ""} ${size}`
}
