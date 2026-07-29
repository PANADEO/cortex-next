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

const ENHANCE_SYSTEM_PROMPT: Record<"title" | "subtitle", (maxChars: number) => string> = {
  title: (maxChars) =>
    "Jesteś redaktorem treści LinkedIn dla firmy doradczej (podatki, prawo, " +
    "biznes). Popraw poniższy TYTUŁ posta: spraw, żeby brzmiał chwytliwie i " +
    "profesjonalnie, zachowaj sens i język polski, nie wydłużaj bez potrzeby. " +
    "Zwróć WYŁĄCZNIE poprawiony tytuł — bez cudzysłowów, bez komentarza, " +
    `maksymalnie ${maxChars} znaków.`,
  subtitle: (maxChars) =>
    "Jesteś redaktorem treści LinkedIn dla firmy doradczej (podatki, prawo, " +
    "biznes). Popraw poniższy PODTYTUŁ/HASŁO posta: spraw, żeby brzmiał " +
    "chwytliwie i profesjonalnie, zachowaj sens i język polski, nie wydłużaj " +
    "bez potrzeby. Zwróć WYŁĄCZNIE poprawiony podtytuł — bez cudzysłowów, " +
    `bez komentarza, maksymalnie ${maxChars} znaków.`,
}

/** "Popraw (AI)" — wołane wyłącznie na jawne kliknięcie, nigdy automatycznie
 *  w tle, żeby nie podmieniać cicho tego, co user napisał. */
export function buildEnhanceMessages(options: {
  text: string
  field: "title" | "subtitle"
  maxChars: number
}): ChatMessage[] {
  return [
    { role: "system", content: ENHANCE_SYSTEM_PROMPT[options.field](options.maxChars) },
    { role: "user", content: options.text.trim() },
  ]
}

/** Model bywa rozmowny mimo instrukcji — obcinamy cudzysłowy i limit znaków
 *  po stronie serwera, nie ufając samej treści promptu. */
export function normalizeEnhancedText(content: string, maxChars: number): string {
  return content.trim().replace(/^["']+|["']+$/g, "").trim().slice(0, maxChars)
}
