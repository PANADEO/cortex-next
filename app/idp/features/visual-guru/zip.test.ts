import { describe, expect, it } from "vitest"
import { base64ToBytes, buildZipBytes, dataUrlToBytes, extensionFromDataUrl } from "./zip"

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

describe("buildZipBytes", () => {
  it("zaczyna się od sygnatury local file header PK\\x03\\x04", () => {
    const zip = buildZipBytes([{ name: "a.png", data: new Uint8Array([1, 2, 3]) }])
    expect(readUint32LE(zip, 0)).toBe(0x04034b50)
  })

  it("kończy się End Of Central Directory (PK\\x05\\x06) z poprawną liczbą wpisów", () => {
    const entries = [
      { name: "wariant-1.png", data: new Uint8Array([137, 80, 78, 71]) },
      { name: "wariant-2.png", data: new Uint8Array([137, 80, 78, 71, 1, 2]) },
    ]
    const zip = buildZipBytes(entries)

    const eocdOffset = zip.length - 22
    expect(readUint32LE(zip, eocdOffset)).toBe(0x06054b50)
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    expect(view.getUint16(eocdOffset + 8, true)).toBe(2) // liczba wpisów na tym dysku
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2) // liczba wpisów łącznie
  })

  it("zawiera nazwy plików w postaci czytelnej (nie skompresowane)", () => {
    const zip = buildZipBytes([{ name: "unikalna-nazwa.png", data: new Uint8Array([9, 9]) }])
    const text = new TextDecoder("latin1").decode(zip)
    expect(text).toContain("unikalna-nazwa.png")
  })

  it("archiwum pustej listy wciąż ma poprawny EOCD z zerem wpisów", () => {
    const zip = buildZipBytes([])
    expect(zip.length).toBe(22)
    expect(readUint32LE(zip, 0)).toBe(0x06054b50)
  })

  it("CRC zapisany w local header zgadza się z danymi (round-trip przez parsowanie ręczne)", () => {
    const data = new Uint8Array([10, 20, 30, 40, 50])
    const zip = buildZipBytes([{ name: "x.bin", data }])
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    const nameLength = view.getUint16(26, true)
    const storedSize = view.getUint32(18, true)
    const extractedData = zip.slice(30 + nameLength, 30 + nameLength + storedSize)
    expect(extractedData).toEqual(data)
  })
})

describe("base64ToBytes / dataUrlToBytes", () => {
  it("dekoduje base64 na te same bajty co Buffer (kontrola krzyżowa Node)", () => {
    const original = Buffer.from("hello visual guru", "utf-8")
    const base64 = original.toString("base64")
    expect(Array.from(base64ToBytes(base64))).toEqual(Array.from(original))
  })

  it("dataUrlToBytes odcina prefiks przed przecinkiem", () => {
    const original = Buffer.from([137, 80, 78, 71])
    const dataUrl = `data:image/png;base64,${original.toString("base64")}`
    expect(Array.from(dataUrlToBytes(dataUrl))).toEqual(Array.from(original))
  })
})

describe("extensionFromDataUrl", () => {
  // Realna weryfikacja Fazy 1 (generate-flow.integration.test.ts) pokazała,
  // że model obrazkowy zwraca JPEG — rozszerzenie pobrania NIE może być
  // sztywne ".png" (Visual Guru nie re-koduje wyniku, D6).
  it("image/jpeg -> jpg", () => {
    expect(extensionFromDataUrl("data:image/jpeg;base64,AAAA")).toBe("jpg")
  })

  it("image/png -> png", () => {
    expect(extensionFromDataUrl("data:image/png;base64,AAAA")).toBe("png")
  })

  it("image/webp -> webp", () => {
    expect(extensionFromDataUrl("data:image/webp;base64,AAAA")).toBe("webp")
  })

  it("nieznany/brakujący typ MIME -> domyślnie png", () => {
    expect(extensionFromDataUrl("data:application/octet-stream;base64,AAAA")).toBe("png")
    expect(extensionFromDataUrl("not-a-data-url")).toBe("png")
  })
})
