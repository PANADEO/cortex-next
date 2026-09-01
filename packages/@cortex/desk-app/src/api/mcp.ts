import { katalogZdolnosci } from "@cortex/desk-core/brama-zdolnosci"
import * as dziennik from "@cortex/desk-core/dziennik"
import * as katalog from "@cortex/desk-core/mcp/katalog-serwer"
import { przejrzyjSerwer } from "@cortex/desk-core/mcp/klient"
import { ktoTo } from "@cortex/desk-core/tozsamosc"
import { NextResponse } from "next/server"

/**
 * Ekran przyjmowania narzędzi z serwerów MCP. Wyłącznie dla przełożonego —
 * to jedyne miejsce w aplikacji, w którym wykonuje się `tools/list` i w którym widać
 * tekst napisany przez obcego dostawcę.
 */
async function tylkoPrzelozony() {
  const u = await ktoTo()
  if (u.rola !== "zarzad") {
    await dziennik.zapisz(u.id, "dostep.odrzucony", { co: "katalog serwerów MCP" })
    return { u: null, odmowa: NextResponse.json({ blad: "To robi przełożony." }, { status: 403 }) }
  }
  return { u, odmowa: null }
}

export async function GET() {
  const { u, odmowa } = await tylkoPrzelozony()
  if (!u) return odmowa
  return NextResponse.json({ serwery: await katalog.pelnyKatalog(), zdolnosci: katalogZdolnosci })
}

export async function POST(req: Request) {
  const { u, odmowa } = await tylkoPrzelozony()
  if (!u) return odmowa
  const d = await req.json()

  if (d.akcja === "dodaj") {
    // Streamable HTTP i nic innego: stdio w aplikacji webowej to nie transport,
    // tylko uruchomienie obcego binarium z uprawnieniami procesu Node.
    if (!/^https?:\/\//.test(d.url ?? "")) {
      return NextResponse.json(
        { blad: "Adres musi zaczynać się od http:// albo https://." },
        { status: 400 },
      )
    }
    if (!/^[a-z0-9-]{2,32}$/.test(d.nazwa ?? "")) {
      return NextResponse.json(
        { blad: "Nazwa techniczna: małe litery, cyfry i myślnik." },
        { status: 400 },
      )
    }
    await katalog.dodajSerwer(u.id, d.nazwa, d.etykieta || d.nazwa, d.url)
    return NextResponse.json({ ok: true })
  }

  if (d.akcja === "przejrzyj") {
    const serwery = await katalog.pelnyKatalog()
    const s = serwery.find((x) => x.nazwa === d.serwer)
    if (!s) return NextResponse.json({ blad: "Nie ma takiego serwera." }, { status: 404 })
    try {
      const kandydaci = await przejrzyjSerwer(s.url, s.nazwa)
      await dziennik.zapisz(u.id, "mcp.serwer.przejrzany", {
        serwer: s.nazwa,
        narzedzi: kandydaci.length,
      })
      return NextResponse.json({
        kandydaci: kandydaci.map((k) => ({
          nazwaZdalna: k.nazwaZdalna,
          schemat: k.schemat,
          obcyOpis: k.obcyOpis,
          odrzucone: k.odrzucone,
          // Wstrzymane NIE liczy się jako przyjęte — inaczej ekran chowa formularz
          // dokładnie wtedy, gdy przełożony musi zadziałać.
          juzPrzyjete: s.narzedzia.some(
            (n) => n.nazwaZdalna === k.nazwaZdalna && n.stan === "zatwierdzone",
          ),
          // przy ponownym przyjęciu nie każemy przepisywać opisu od zera
          poprzednie: s.narzedzia.find((n) => n.nazwaZdalna === k.nazwaZdalna) ?? null,
        })),
      })
    } catch (e) {
      return NextResponse.json(
        { blad: `Nie udało się połączyć: ${String(e).slice(0, 160)}` },
        { status: 502 },
      )
    }
  }

  if (d.akcja === "zatwierdz") {
    const serwery = await katalog.pelnyKatalog()
    const s = serwery.find((x) => x.nazwa === d.serwer)
    if (!s) return NextResponse.json({ blad: "Nie ma takiego serwera." }, { status: 404 })
    if (!d.opis?.trim() || !d.krotko?.trim()) {
      return NextResponse.json(
        { blad: "Opis i krótka nazwa są wymagane — pisze je człowiek, nie serwer." },
        { status: 400 },
      )
    }
    if (!katalogZdolnosci.some((z) => z.id === d.zdolnosc)) {
      return NextResponse.json({ blad: "Nieznana zdolność." }, { status: 400 })
    }

    // Odcisk liczymy z ŻYWEGO schematu w chwili zgody, nie z tego, co przysłała przeglądarka.
    // Inaczej zatwierdzający podpisywałby coś, czego serwer już nie wystawia.
    const kandydaci = await przejrzyjSerwer(s.url, s.nazwa)
    const k = kandydaci.find((x) => x.nazwaZdalna === d.nazwaZdalna)
    if (!k)
      return NextResponse.json({ blad: "Serwer nie wystawia już tego narzędzia." }, { status: 409 })
    if (k.odrzucone) return NextResponse.json({ blad: k.odrzucone }, { status: 422 })

    await katalog.zatwierdzNarzedzie(u.id, {
      serwer: s.nazwa,
      nazwaZdalna: d.nazwaZdalna,
      opis: d.opis.trim(),
      krotko: d.krotko.trim(),
      zdolnoscId: d.zdolnosc,
      odcisk: k.odciskDla(d.opis.trim()),
    })
    return NextResponse.json({ ok: true })
  }

  if (d.akcja === "wycofaj") {
    await katalog.wycofajNarzedzie(u.id, d.serwer, d.nazwaZdalna)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ blad: "Nieznana akcja." }, { status: 400 })
}
