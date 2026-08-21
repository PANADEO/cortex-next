// Minimalny, bezzależnościowy writer archiwum ZIP (metoda STORE — bez
// kompresji). Repo NIE ma dziś żadnej biblioteki ZIP (sprawdzone przy
// implementacji: brak JSZip w package.json, zero użyć CompressionStream w
// repo) — CLAUDE.md "Reuse utilities; avoid new dependencies unless already
// present in repo" wyklucza dociąganie jednej wyłącznie po to. Warianty to
// już skompresowane PNG, więc STORE (bez dodatkowej kompresji ponad to, co
// PNG już ma) nie traci nic praktycznego względem DEFLATE.
//
// `buildZipBytes()` jest czystą funkcją (Uint8Array in/out, zero DOM) — łatwa
// do jednostkowego przetestowania offline. `createZipBlob()`/`downloadZip()`
// to cienkie, przeglądarkowe opakowania na wierzchu.

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const CRC_TABLE = buildCrcTable()

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// DOS date/time — stała wartość generacji, momentu tworzenia ZIP-a nie warto
// tu odwzorowywać dokładniej niż to wymaga formatu.
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f)
  const dosYear = Math.max(0, date.getFullYear() - 1980)
  const dosDate =
    ((dosYear & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f)
  return { time, date: dosDate }
}

/** Buduje poprawny (STORE, bez kompresji) archiwum ZIP z zestawu plików —
 *  local file header + central directory + end of central directory, wg
 *  specyfikacji PKZIP APPNOTE. Czyste bajty, zero zależności od przeglądarki. */
export function buildZipBytes(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const { time, date } = dosDateTime(new Date())

  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true) // version needed to extract
    localView.setUint16(6, 0, true) // general purpose flag
    localView.setUint16(8, 0, true) // compression method: STORE
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, size, true) // compressed size
    localView.setUint32(22, size, true) // uncompressed size
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true) // extra field length
    local.set(nameBytes, 30)
    localParts.push(local, entry.data)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true) // version made by
    centralView.setUint16(6, 20, true) // version needed to extract
    centralView.setUint16(8, 0, true) // general purpose flag
    centralView.setUint16(10, 0, true) // compression method
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, size, true)
    centralView.setUint32(24, size, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true) // extra field length
    centralView.setUint16(32, 0, true) // comment length
    centralView.setUint16(34, 0, true) // disk number start
    centralView.setUint16(36, 0, true) // internal attrs
    centralView.setUint32(38, 0, true) // external attrs
    centralView.setUint32(42, offset, true) // offset of local header
    central.set(nameBytes, 46)
    centralParts.push(central)

    offset += local.length + entry.data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const centralOffset = offset

  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(4, 0, true) // disk number
  eocdView.setUint16(6, 0, true) // disk with central dir start
  eocdView.setUint16(8, entries.length, true)
  eocdView.setUint16(10, entries.length, true)
  eocdView.setUint32(12, centralSize, true)
  eocdView.setUint32(16, centralOffset, true)
  eocdView.setUint16(20, 0, true) // comment length

  const total = offset + centralSize + eocd.length
  const output = new Uint8Array(total)
  let cursor = 0
  for (const part of [...localParts, ...centralParts, eocd]) {
    output.set(part, cursor)
    cursor += part.length
  }
  return output
}

export function createZipBlob(entries: ZipEntry[]): Blob {
  // BlobPart's TS 5.7+ definition wants an ArrayBufferView<ArrayBuffer>
  // specifically (excludes the wider ArrayBufferLike a bare `Uint8Array`
  // return type infers) — .buffer here is always a plain, freshly allocated
  // ArrayBuffer (every typed array above is constructed via `new
  // Uint8Array(length)`, never backed by a SharedArrayBuffer).
  const bytes = buildZipBytes(entries)
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" })
}

/** base64 (bez prefiksu "data:...;base64,") -> bajty, do budowy wpisów ZIP z
 *  data URI zwróconych przez API. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  return base64ToBytes(dataUrl.slice(dataUrl.indexOf(",") + 1))
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/** Rozszerzenie pliku pobrania na podstawie DEKLAROWANEGO typu MIME w data
 *  URI, nie na sztywno ".png" — realna weryfikacja (Faza 1) pokazała, że
 *  model obrazkowy zwraca JPEG, nie PNG. Visual Guru nie re-koduje wyniku
 *  (D6: surowy wynik AI), więc pobrany plik musi mieć rozszerzenie zgodne z
 *  faktyczną zawartością. */
export function extensionFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+);base64,/.exec(dataUrl)
  const mimeType = match?.[1]
  return (mimeType && EXTENSION_BY_MIME_TYPE[mimeType]) || "png"
}

/** Trigger pobrania w przeglądarce — obiektowy URL, kliknięcie w ukryty <a>,
 *  natychmiastowe zwolnienie. */
export function downloadZip(fileName: string, entries: ZipEntry[]): void {
  const blob = createZipBlob(entries)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
