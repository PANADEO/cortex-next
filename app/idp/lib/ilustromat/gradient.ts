// Port sample_gradient_image() z core/imgutils.py — gradient + akcent, offline,
// bez sieci i bez kosztu AI.
//
// Różnica względem PoC: generator jest DETERMINISTYCZNY (ziarno zamiast
// random). W Streamlicie ten sam efekt osiągało @st.cache_data — bez tego suwak
// koloru w kreatorze powodował migotanie losowym gradientem przy każdym
// przeliczeniu. W Next.js nie ma czego cache'ować między żądaniami, więc
// determinizm bierze się z ziarna: to samo ziarno = ten sam obraz.
//
// Zakres użycia: live preview kreatora szablonów i fixture testowy (composer,
// E2E bez kluczy API). NIE jest to produkcyjny backend generacji — przełącznik
// IMAGE_BACKEND=placeholder z PoC świadomie nie jest portowany.

import sharp from "sharp"
import { toHexColor, type Rgb } from "./color"

/** mulberry32 — mały, szybki PRNG o stabilnym wyniku dla danego ziarna. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export interface GradientOptions {
  width: number
  height: number
  seed?: number | string
}

/** Deterministyczny gradient pionowy + okrągły akcent, jako PNG. */
export async function sampleGradientImage(options: GradientOptions): Promise<Buffer> {
  const { width, height } = options
  const seed = typeof options.seed === "string" ? hashSeed(options.seed) : (options.seed ?? 1)
  const random = seededRandom(seed)

  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

  const top: Rgb = { r: between(60, 140), g: between(60, 140), b: between(60, 140) }
  const bottom: Rgb = { r: between(140, 220), g: between(140, 220), b: between(140, 220) }

  const radius = Math.floor(Math.min(width, height) / 6)
  const cx = between(Math.floor(width / 4), Math.floor((3 * width) / 4))
  const cy = between(Math.floor(height / 4), Math.floor((3 * height) / 4))
  const accent: Rgb = {
    r: Math.min(255, bottom.r + 40),
    g: Math.min(255, bottom.g + 40),
    b: Math.min(255, bottom.b + 40),
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${toHexColor(top)}"/>` +
    `<stop offset="100%" stop-color="${toHexColor(bottom)}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#g)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${toHexColor(accent)}"/>` +
    `</svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}
