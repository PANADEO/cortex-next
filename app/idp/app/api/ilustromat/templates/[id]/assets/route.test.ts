// Bramka renderu weryfikacyjnego NA REALNEJ ŚCIEŻCE ŻĄDANIA. Sam test funkcji
// weryfikującej (font-verification.test.ts) nie wykryje, że nikt jej nie woła
// z route'a — a to była właśnie treść znaleziska: mechanizm z projektu (LUKA 3)
// istniał na papierze, w kodzie nie.
//
// Plik testowy z uszkodzonym fontem jest zbudowany tak, żeby PRZESZEDŁ fontkit
// (poprawny nagłówek, name, cmap) i wywrócił się dopiero na renderze — inaczej
// odrzuciłaby go istniejąca walidacja i test przechodziłby z innego powodu.

import { resolveFontLibraryEntry } from "@/lib/ilustromat/font-library"
import { clearFontFileSupportMemo, supportsFontFiles } from "@/lib/ilustromat/font-verification"
import plIlustromat from "@/locales/pl/ilustromat.json"
import type * as CortexService from "@cortex/service"
import { readFileSync } from "node:fs"
import sharp from "sharp"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "menedzer@firma.pl"

const rbacStore = vi.hoisted(() => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["ilustromat"]),
  loadGrantedScopes: vi.fn(async () => ["ilustromat:manage-templates"]),
}))
vi.mock("@cortex/service/rbac-store", () => rbacStore)

const service = vi.hoisted(() => ({
  getFrameTemplate: vi.fn(async () => ({ id: "crido-violet", name: "Crido" })),
  saveTemplateAsset: vi.fn(async () => undefined),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")

// Handler bierze NextRequest, ale czyta wyłącznie to, co ma zwykły Request —
// ten sam zabieg co w guard-coverage.test.ts, żeby wołać go realnym Requestem.
type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>
const POST = (await import("./route")).POST as unknown as Handler

const entry = resolveFontLibraryEntry(null)
let healthyFont: Buffer
let unrenderableFont: Buffer
let logoPng: Buffer

/** Zeruje zawartość tablicy fontu, zostawiając nienaruszony katalog tablic:
 *  plik dalej parsuje się i deklaruje pokrycie znaków, ale nie ma z czego
 *  narysować glifów. To model bajtów uszkodzonych "w spoczynku" — dokładnie
 *  ten przypadek, który przechodził przez existsSync() i renderował się
 *  po cichu krojem zastępczym. */
function zeroFontTable(font: Buffer, tag: string): Buffer {
  const out = Buffer.from(font)
  const tableCount = out.readUInt16BE(4)
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16
    if (out.toString("latin1", record, record + 4) === tag) {
      const offset = out.readUInt32BE(record + 8)
      out.fill(0, offset, offset + out.readUInt32BE(record + 12))
      return out
    }
  }
  throw new Error(`brak tablicy ${tag} w pliku testowym`)
}

beforeAll(async () => {
  healthyFont = readFileSync(entry.regularPath)
  unrenderableFont = zeroFontTable(healthyFont, "glyf")
  logoPng = await sharp({
    create: { width: 64, height: 64, channels: 4, background: "#FF8C42" },
  })
    .png()
    .toBuffer()
})

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
  clearFontFileSupportMemo()
})

function upload(kind: string, bytes: Buffer, filename: string): Request {
  const form = new FormData()
  form.set("kind", kind)
  form.set("file", new File([new Uint8Array(bytes)], filename))
  return new Request("http://localhost/api/ilustromat/templates/crido-violet/assets", {
    method: "POST",
    body: form,
    headers: { "x-auth-request-email": EMAIL },
  })
}

const context = { params: Promise.resolve({ id: "crido-violet" }) }

describe("POST /api/ilustromat/templates/[id]/assets — bramka renderu weryfikacyjnego", () => {
  it("odrzuca font uszkodzony, który PRZESZEDŁ walidację fontkitem", async () => {
    const response = await POST(upload("font-regular", unrenderableFont, "uszkodzony.ttf"), context)

    expect(response.status).toBe(400)
    // `toEqual` na PEŁNYM ciele, nie `toMatchObject`: brak `message` ma być
    // dowiedziony. Zdanie diagnostyczne (metryki, nazwa rodziny) jest wpisane
    // w kodzie po polsku i szło prosto na ekran — teraz idzie do logu, a na
    // zewnątrz wychodzi KLUCZ, z którego klient złoży napis w swoim języku.
    await expect(response.json()).resolves.toEqual({
      error: "font-render-failed",
      messageKey: "errors.fontRenderFailed",
    })
    expect(service.saveTemplateAsset).not.toHaveBeenCalled()
  })

  it("odrzuca śmieć zamiast fontu już na fontkicie", async () => {
    const response = await POST(
      upload("font-regular", Buffer.alloc(400, 0x41), "smiec.ttf"),
      context,
    )

    expect(response.status).toBe(400)
    // `detail` to komunikat fontkita — po angielsku i zależny od wersji
    // biblioteki, więc asercja pilnuje jego OBECNOŚCI, nie treści.
    await expect(response.json()).resolves.toEqual({
      error: "invalid-asset",
      messageKey: "errors.fontUnparsable",
      messageParams: { detail: expect.any(String) },
    })
    expect(service.saveTemplateAsset).not.toHaveBeenCalled()
  })

  it("nie rusza ścieżki logo — bramka dotyczy wyłącznie fontów", async () => {
    const response = await POST(upload("logo", logoPng, "logo.png"), context)

    expect(response.status).toBe(200)
    expect(service.saveTemplateAsset).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "logo" }),
    )
  })

  it("zapisuje poprawny font tylko wtedy, gdy środowisko stosuje pliki fontów", async () => {
    // Na macOS arm64 sharp ignoruje `fontfile` (zmierzone), więc zapis jest tu
    // odrzucany — świadomie, bo szablon renderowałby się fontem zastępczym.
    // W obrazie Alpine z fontconfig ten sam plik przechodzi i ląduje w bazie.
    const applies = await supportsFontFiles()
    clearFontFileSupportMemo()

    const response = await POST(
      upload("font-regular", healthyFont, "NotoSans-Regular.ttf"),
      context,
    )

    if (applies) {
      expect(response.status).toBe(200)
      expect(service.saveTemplateAsset).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "font-regular", fontFamily: entry.family }),
      )
    } else {
      expect(response.status).toBe(400)
      // Środowisko bez fontconfig: wina leży po stronie obrazu, nie pliku —
      // stąd inny klucz niż przy uszkodzonym pliku.
      await expect(response.json()).resolves.toEqual({
        error: "font-not-applied",
        messageKey: "errors.fontEnvironmentIgnoresFiles",
      })
      expect(service.saveTemplateAsset).not.toHaveBeenCalled()
    }
  })
})

/**
 * Dwa klucze, których powyższe scenariusze nie dotykają: brak polskich znaków
 * wymagałby fontu-fixture'a bez diakrytyków, a „render użył innego kroju"
 * odpala się tylko w obrazie Z fontconfigiem. Literówka w którymkolwiek z nich
 * byłaby NIEWIDOCZNA w runtime — klient spadłby na ogólny zapas „Nie udało się
 * wgrać pliku" i konkret, dla którego te odpowiedzi w ogóle niosą klucz,
 * cicho by zniknął.
 */
describe("klucze komunikatów istnieją w pliku źródłowym", () => {
  it.each(["missingPolishGlyphs", "fontNotApplied"])("errors.%s", (key) => {
    expect(typeof (plIlustromat.errors as Record<string, string>)[key]).toBe("string")
  })
})
