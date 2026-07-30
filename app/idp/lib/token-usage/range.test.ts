import { describe, expect, it } from "vitest"
import { MAX_RANGE_DAYS, parseDateRange } from "./range"

describe("parseDateRange — akceptacja", () => {
  it("przepuszcza poprawny zakres i zwraca daty BEZ żadnej konwersji", () => {
    const result = parseDateRange("2026-07-01", "2026-07-30")

    expect(result).toEqual({ ok: true, range: { start: "2026-07-01", end: "2026-07-30" } })
  })

  it("dopuszcza jeden dzień (start === end)", () => {
    const result = parseDateRange("2026-07-15", "2026-07-15")

    expect(result.ok).toBe(true)
  })

  it("dopuszcza dokładnie graniczną długość zakresu", () => {
    // 2026-01-01 + 91 dni = 2026-04-02, czyli 92 dni licząc obustronnie.
    const result = parseDateRange("2026-01-01", "2026-04-02")

    expect(result.ok).toBe(true)
  })

  it("liczy zakres obustronnie domknięcie, tak jak inkluzywny end w proxy", () => {
    const result = parseDateRange("2026-01-01", "2026-04-03")

    expect(result).toMatchObject({ ok: false, code: "range-too-long" })
    if (!result.ok) expect(result.message).toContain("93")
  })
})

describe("parseDateRange — odrzucenia", () => {
  it("odrzuca brakujące parametry", () => {
    expect(parseDateRange(null, "2026-07-30")).toMatchObject({ ok: false, code: "invalid-format" })
    expect(parseDateRange("2026-07-01", undefined)).toMatchObject({
      ok: false,
      code: "invalid-format",
    })
  })

  it.each(["01-07-2026", "2026/07/01", "2026-7-1", "wczoraj", "2026-07-01T00:00:00Z", ""])(
    "odrzuca format %s",
    (value) => {
      expect(parseDateRange(value, "2026-07-30")).toMatchObject({
        ok: false,
        code: "invalid-format",
      })
    },
  )

  // new Date("2026-02-30") cicho daje 2 marca — bez kontroli round-tripu
  // "31 lutego" przeszedłby dalej i rozjechał się z tym, co policzy proxy.
  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31"])(
    "odrzuca nieistniejącą datę %s",
    (value) => {
      expect(parseDateRange(value, "2026-12-01")).toMatchObject({ ok: false, code: "invalid-date" })
    },
  )

  it("odrzuca odwrócony zakres", () => {
    expect(parseDateRange("2026-07-30", "2026-07-01")).toMatchObject({
      ok: false,
      code: "reversed-range",
    })
  })

  // To jest ochrona CUDZEGO serwisu produkcyjnego przed naszym UI: nic po
  // stronie cortex-proxy nie broni przed start=2020-01-01.
  it("odrzuca zakres dłuższy niż limit", () => {
    const result = parseDateRange("2020-01-01", "2026-07-30")

    expect(result).toMatchObject({ ok: false, code: "range-too-long" })
    if (!result.ok) expect(result.message).toContain(String(MAX_RANGE_DAYS))
  })

  it("limit obowiązuje niezależnie od strefy czasowej procesu", () => {
    const originalTz = process.env.TZ
    try {
      process.env.TZ = "Pacific/Kiritimati"
      expect(parseDateRange("2026-01-01", "2026-04-02").ok).toBe(true)
      process.env.TZ = "Pacific/Midway"
      expect(parseDateRange("2026-01-01", "2026-04-02").ok).toBe(true)
    } finally {
      process.env.TZ = originalTz
    }
  })
})
