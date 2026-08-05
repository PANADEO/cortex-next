// Presety stylu/formatu, limity znaków, zakresy geometrii — port core/presets.py.
// Czyste dane, zero zależności. Dotyczy TREŚCI generacji (styl, format, limity),
// nie brandu — brand żyje jako dane w schemacie `ilustromat` (FrameTemplate).

export interface StylePreset {
  key: string
  label: string
  promptModifier: string
}

export const STYLES: readonly StylePreset[] = [
  {
    key: "photorealistic",
    label: "Fotorealistyczny",
    promptModifier:
      "professional editorial photography, natural light, shallow depth of " +
      "field, muted corporate tones — think Financial Times or Harvard " +
      "Business Review article hero photography",
  },
  {
    key: "flat",
    label: "Ilustracja",
    promptModifier:
      "modern flat vector illustration, clean geometric shapes, generous " +
      "negative space, Swiss design influence — think premium fintech " +
      "editorial illustration",
  },
  {
    key: "isometric",
    label: "Izometryczny",
    promptModifier:
      "isometric 3D illustration, soft gradients, organized structural " +
      "composition, minimal scene — think Big Four annual report cover art",
  },
  {
    key: "comic",
    label: "Komiksowy",
    promptModifier:
      "comic book style illustration, bold outlines, dynamic but restrained " +
      "composition (no speech bubbles, no text) — think a modern explainer " +
      "editorial comic, not a superhero comic",
  },
  {
    key: "abstract",
    label: "Abstrakcyjny",
    promptModifier:
      "abstract representation of data flows, networks and connections, " +
      "glassmorphism, layered depth, deep violet and warm orange accents " +
      "— think premium tech conference keynote visuals",
  },
] as const

export const STYLE_BY_KEY = new Map(STYLES.map((style) => [style.key, style]))
export const DEFAULT_STYLE = STYLES[0]!

export interface FormatPreset {
  key: string
  label: string
  width: number
  height: number
  /** Etykieta proporcji dla prompt buildera (LLM), nie surowy stosunek pikseli. */
  aspectRatio: string
}

// Priorytet v1: 4:5 ma wyraźnie lepszy CTR na mobile niż kwadrat (dominujący
// format przeglądania LinkedIn), 1.91:1 to natywny format linka/cover.
export const SQUARE_FORMAT: FormatPreset = {
  key: "square",
  label: "Kwadrat 1200×1200 (feed)",
  width: 1200,
  height: 1200,
  aspectRatio: "1:1",
}
export const PORTRAIT_FORMAT: FormatPreset = {
  key: "portrait",
  label: "Pionowy 1080×1350 (4:5)",
  width: 1080,
  height: 1350,
  aspectRatio: "4:5",
}
export const LINK_FORMAT: FormatPreset = {
  key: "link",
  label: "Poziomy 1200×627 (link/cover, 1.91:1)",
  width: 1200,
  height: 627,
  aspectRatio: "1.91:1",
}

export const FORMATS: readonly FormatPreset[] = [SQUARE_FORMAT, PORTRAIT_FORMAT, LINK_FORMAT]
export const FORMAT_BY_KEY = new Map(FORMATS.map((format) => [format.key, format]))
export const DEFAULT_FORMAT = SQUARE_FORMAT

export const TITLE_MAX_CHARS = 140
export const SUBTITLE_MAX_CHARS = 200
/** Pomysł na ilustrację nie trafia na kafelek (idzie do prompt buildera jako
 *  wskazówka), więc limit jest tylko kagańcem dla "Podpowiedz" — samo pole
 *  przyjmuje dowolną długość, tak jak dotąd. */
export const IDEA_MAX_CHARS = 300

export const MIN_VARIANTS = 2
export const MAX_VARIANTS = 4
export const DEFAULT_VARIANTS = 2

// Twarde ograniczenia geometrii szablonu — te same wartości pilnuje check
// constraint w schemacie `ilustromat`, żeby nie dało się połamać layoutu
// zapisem z pominięciem UI.
export const CORNER_RADIUS_RANGE = [0, 48] as const
export const MIN_IMAGE_AREA_RATIO_RANGE = [0.35, 0.6] as const
export const DEFAULT_CORNER_RADIUS = 28
export const DEFAULT_MIN_IMAGE_AREA_RATIO = 0.45

/** Znaki, których poprawne wyrenderowanie jest twardym wymaganiem produktu
 *  (spec §1 — "nigdy nie ma krzywych polskich znaków"). */
export const REQUIRED_POLISH_CHARS = "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ"
