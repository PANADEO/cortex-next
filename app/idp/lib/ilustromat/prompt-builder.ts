// Krok 2 flow: LLM zamienia dane posta na jeden angielski prompt obrazkowy.
// Port core/prompt_builder.py — CZYSTE funkcje budujące wiadomości, zero HTTP,
// zero JSX (wzorzec lib/ai-tools/prompts.ts).
//
// Zero promptowania po stronie użytkownika: wpisuje tytuł/hasło po polsku,
// tani model tekstowy buduje konkretną scenę wizualną z twardym zakazem
// tekstu/logo/twarzy w obrazie (REQ-04).

import type { StylePreset } from "./presets"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export const SYSTEM_PROMPT = `Jesteś ekspertem od promptów do modeli generujących obrazy. Na podstawie danych
posta LinkedIn firmy doradczej (podatki, prawo, biznes) napisz JEDEN prompt po
angielsku opisujący ilustrację.

Zasady twarde:
1. Opisz KONKRETNĄ scenę lub metaforę wizualną (nie abstrakcyjne pojęcia typu "success").
2. ZAKAZ: jakikolwiek tekst, litery, cyfry, logo, znaki wodne, dymki z napisami.
3. ZAKAZ: rozpoznawalne twarze, politycy, symbole państwowe, banknoty w zbliżeniu.
4. Ton: profesjonalny, redakcyjny; bez memicznej przesady, chyba że styl = komiksowy.
5. Kolorystyka: neutralna lub z akcentami deep violet / warm orange (paleta Crido).

Zwróć WYŁĄCZNIE treść promptu — bez cudzysłowów, bez komentarza, bez etykiet.`

/** Ręcznie dopracowane pary tytuł→prompt. Seed na 3 przykłady — do rozbudowy
 *  do 5–10 po review marketingu (ryzyko trafności metafory dla tematów typu
 *  "ceny transferowe"). */
export const FEW_SHOT_EXAMPLES: readonly { title: string; prompt: string }[] = [
  {
    title: "Zmiany w cenach transferowych 2027",
    prompt:
      "Editorial illustration of two glass office towers connected by a " +
      "glowing balance beam bridge, gently tilting to find equilibrium, " +
      "soft directional light, deep violet and warm orange accents, " +
      "clean corporate composition, empty sky background, no text, no logos",
  },
  {
    title: "Nowe obowiązki raportowe ESG dla spółek",
    prompt:
      "Isometric 3D illustration of a small potted tree growing inside an " +
      "open ledger book, minimal geometric office desk scene, soft " +
      "gradients, deep violet and warm orange accents, no text, no logos",
  },
  {
    title: "Kontrola podatkowa: jak się przygotować",
    prompt:
      "Editorial illustration of a single lit desk lamp illuminating a " +
      "neat stack of folders on an otherwise dark desk, calm and " +
      "reassuring mood, deep violet shadows with a warm orange highlight, " +
      "no text, no logos, no recognizable faces",
  },
] as const

export interface ImagePromptInput {
  title: string
  subtitle: string
  idea: string
  style: StylePreset
  aspectRatio: string
}

function userPrompt({ title, subtitle, idea, style, aspectRatio }: ImagePromptInput): string {
  return [
    `Tytuł: ${title}`,
    `Podtytuł/hasło: ${subtitle || "(brak)"}`,
    `Pomysł użytkownika (opcjonalny, ma pierwszeństwo): ${idea || "(brak)"}`,
    `Styl: ${style.promptModifier}`,
    `Kadr: ${aspectRatio}, centralny motyw, spokojne tło, margines bezpieczeństwa przy krawędziach`,
  ].join("\n")
}

/** Komplet wiadomości dla modelu tekstowego: system + few-shot + realne dane. */
export function buildImagePromptMessages(input: ImagePromptInput): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }]
  for (const example of FEW_SHOT_EXAMPLES) {
    messages.push({ role: "user", content: `Tytuł: ${example.title}` })
    messages.push({ role: "assistant", content: example.prompt })
  }
  messages.push({ role: "user", content: userPrompt(input) })
  return messages
}

export type AssistField = "title" | "subtitle" | "idea"
/** "Dopracuj" (polish) i "Inna wersja" (rephrase) pracują na tekście usera,
 *  "Podpowiedz" (propose) pisze treść od zera z kontekstu innych pól. */
export type AssistMode = "polish" | "rephrase" | "propose"

export interface AssistInput {
  field: AssistField
  mode: AssistMode
  maxChars: number
  // `| undefined` jawnie: repo ma exactOptionalPropertyTypes, a te pola są
  // przekazywane wprost z rozpakowanego wyniku zod.
  text?: string | undefined
  context?: { title?: string | undefined; subtitle?: string | undefined } | undefined
  avoid?: readonly string[] | undefined
}

const ROLE = "Jesteś redaktorem treści LinkedIn dla firmy doradczej (podatki, prawo, biznes)."

const INSTRUCTION: Partial<Record<`${AssistField}:${AssistMode}`, string>> = {
  "title:polish":
    "Popraw poniższy TYTUŁ posta: ma brzmieć chwytliwie i profesjonalnie. " +
    "NIE zmieniaj sensu ani tematu — popraw wyłącznie sformułowanie i nie " +
    "wydłużaj bez potrzeby.",
  "title:rephrase":
    "Napisz INNĄ wersję poniższego TYTUŁU posta: ten sam sens i ten sam temat, " +
    "ale wyraźnie inne sformułowanie i inne ujęcie. To ma być realna " +
    "alternatywa do wyboru, nie kosmetyczna korekta.",
  "subtitle:polish":
    "Popraw poniższy PODTYTUŁ/HASŁO posta: ma brzmieć chwytliwie i " +
    "profesjonalnie. NIE zmieniaj sensu — popraw wyłącznie sformułowanie.",
  "subtitle:rephrase":
    "Napisz INNĄ wersję poniższego PODTYTUŁU/HASŁA posta: ten sam sens, " +
    "wyraźnie inne sformułowanie i inne ujęcie.",
  "subtitle:propose":
    "Na podstawie tytułu posta napisz PODTYTUŁ/HASŁO: jedno krótkie zdanie, " +
    "które rozwija albo zaostrza tytuł. Nie powtarzaj tytułu innymi słowami.",
  // Opis trafia potem do buildImagePromptMessages jako "pomysł użytkownika",
  // więc musi zostać po polsku i trzymać te same zakazy co SYSTEM_PROMPT —
  // inaczej model obrazkowy dostanie polecenie wpisania napisu w kadr.
  "idea:propose":
    "Na podstawie tytułu i podtytułu posta zaproponuj JEDEN pomysł na " +
    "ilustrację: konkretną scenę lub metaforę wizualną, opisaną w jednym " +
    "zdaniu. Bez abstrakcji w rodzaju sukces czy rozwój. W opisie nie może " +
    "wystąpić żaden tekst, napis, logo ani rozpoznawalna twarz.",
}

const OUTPUT_LABEL: Record<AssistField, string> = {
  title: "tytuł",
  subtitle: "podtytuł",
  idea: "opis pomysłu na ilustrację",
}

/** Model przy tym samym wejściu wraca do tej samej metafory nawet przy wysokiej
 *  temperaturze, więc "kolejne kliknięcie = nowa propozycja" nie bierze się z
 *  samego losu — odrzucone wersje muszą trafić do promptu wprost. */
export const AVOID_LIMIT = 5

export const ASSIST_TEMPERATURE: Record<AssistMode, number> = {
  polish: 0.5,
  rephrase: 0.85,
  propose: 0.9,
}

export function isSupportedAssist(field: AssistField, mode: AssistMode): boolean {
  return INSTRUCTION[`${field}:${mode}`] !== undefined
}

function assistSystemPrompt({ field, mode, maxChars }: AssistInput): string {
  return [
    ROLE,
    INSTRUCTION[`${field}:${mode}`],
    `Zwróć WYŁĄCZNIE ${OUTPUT_LABEL[field]} po polsku — bez cudzysłowów, bez ` +
      `komentarza, bez etykiet, maksymalnie ${maxChars} znaków.`,
  ].join("\n\n")
}

function assistUserPrompt({ field, mode, text, context, avoid }: AssistInput): string {
  const parts: string[] =
    mode === "propose"
      ? [
          `Tytuł: ${context?.title?.trim() ?? ""}`,
          ...(field === "idea"
            ? [`Podtytuł/hasło: ${context?.subtitle?.trim() || "(brak)"}`]
            : []),
        ]
      : [text?.trim() ?? ""]

  const rejected = (avoid ?? []).filter((item) => item.trim()).slice(-AVOID_LIMIT)
  if (rejected.length > 0) {
    parts.push(
      "\nTe wersje już pokazano użytkownikowi i ich nie wybrał — zaproponuj coś " +
        `istotnie innego, nie parafrazuj ich:\n${rejected.map((item) => `- ${item}`).join("\n")}`,
    )
  }
  return parts.join("\n")
}

/** Asysta tekstowa formularza — wołana wyłącznie na jawne kliknięcie, nigdy
 *  automatycznie w tle, żeby nie podmieniać cicho tego, co user napisał. */
export function buildAssistMessages(input: AssistInput): ChatMessage[] {
  return [
    { role: "system", content: assistSystemPrompt(input) },
    { role: "user", content: assistUserPrompt(input) },
  ]
}

/** Model bywa rozmowny mimo instrukcji — obcinamy cudzysłowy i limit znaków
 *  po stronie serwera, nie ufając samej treści promptu. */
export function normalizeAssistedText(content: string, maxChars: number): string {
  return content.trim().replace(/^["']+|["']+$/g, "").trim().slice(0, maxChars)
}
