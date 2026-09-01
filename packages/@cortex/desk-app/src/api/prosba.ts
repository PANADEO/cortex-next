import { katalogZdolnosci } from "@cortex/desk-core/brama-zdolnosci"
import { migracja, pool } from "@cortex/desk-core/db"
import * as dziennik from "@cortex/desk-core/dziennik"
import { ktoTo, UZYTKOWNICY } from "@cortex/desk-core/tozsamosc"
import { NextResponse } from "next/server"

export async function GET() {
  await migracja()
  const u = await ktoTo()
  // pracownik widzi wyłącznie swoje prośby; zarząd — wszystkie oczekujące
  const r =
    u.rola === "zarzad"
      ? await pool.query(
          `select * from desk.prosba order by (stan='oczekuje') desc, at desc limit 50`,
        )
      : await pool.query(`select * from desk.prosba where kto=$1 order by at desc limit 50`, [u.id])

  return NextResponse.json({
    prosby: r.rows.map((p) => ({
      id: Number(p.id),
      kto: p.kto,
      ktoImie: UZYTKOWNICY.find((x) => x.id === p.kto)?.imie ?? p.kto,
      zdolnosc: p.zdolnosc,
      nazwa:
        p.zdolnosc === "inne"
          ? "coś, czego nie ma w katalogu"
          : (katalogZdolnosci.find((z) => z.id === p.zdolnosc)?.nazwa ?? p.zdolnosc),
      dzial: katalogZdolnosci.find((z) => z.id === p.zdolnosc)?.dzial ?? "",
      uzasadnienie: p.uzasadnienie ?? null,
      stan: p.stan,
      at: p.at,
      rozpatrzona: p.rozpatrzona,
    })),
  })
}

export async function POST(req: Request) {
  await migracja()
  const u = await ktoTo()
  const { zdolnosc, uzasadnienie } = await req.json()

  // Prośba własnymi słowami — o coś, czego w katalogu jeszcze nie ma. Nie da się jej
  // przyznać jednym kliknięciem i nie udajemy, że się da; trafia do przełożonego
  // jako sygnał, że katalog czegoś nie obejmuje.
  if (zdolnosc === "inne") {
    const tresc = String(uzasadnienie ?? "")
      .trim()
      .slice(0, 500)
    if (!tresc) return NextResponse.json({ blad: "Napisz, czego potrzebujesz." }, { status: 400 })
    await pool.query(
      `insert into desk.prosba (kto, zdolnosc, uzasadnienie) values ($1,'inne',$2)`,
      [u.id, tresc],
    )
    await dziennik.zapisz(u.id, "prosba.inne", { opis: tresc })
    return NextResponse.json({ ok: true })
  }

  if (!katalogZdolnosci.some((z) => z.id === zdolnosc)) {
    return NextResponse.json({ blad: "Nie ma takiej zdolności." }, { status: 400 })
  }
  // druga prośba o to samo nie tworzy drugiego wiersza — dział ma widzieć jedną sprawę
  const istnieje = await pool.query(
    `select id from desk.prosba where kto=$1 and zdolnosc=$2 and stan='oczekuje'`,
    [u.id, zdolnosc],
  )
  if (!istnieje.rowCount) {
    await pool.query(`insert into desk.prosba (kto, zdolnosc) values ($1,$2)`, [u.id, zdolnosc])
  }
  await dziennik.zapisz(u.id, "prosba.o.dostep", { zdolnosc })
  return NextResponse.json({ ok: true })
}

/** Rozpatrzenie prośby. Przyznanie NAPRAWDĘ nadaje zdolność — inaczej to teatr. */
export async function PATCH(req: Request) {
  await migracja()
  const u = await ktoTo()
  if (u.rola !== "zarzad") {
    await dziennik.zapisz(u.id, "dostep.odrzucony", { co: "rozpatrywanie próśb" })
    return NextResponse.json({ blad: "Prośby rozpatruje przełożony." }, { status: 403 })
  }
  const { id, decyzja, cofnij } = await req.json()

  // Cofnięcie nadania — bez tego nie da się zresetować pokazu ani odebrać zdolności,
  // która okazała się nadana przez pomyłkę.
  if (cofnij) {
    const r = await pool.query(`select kto, zdolnosc from desk.prosba where id=$1`, [id])
    if (!r.rowCount) return NextResponse.json({ blad: "Nie ma takiej prośby." }, { status: 404 })
    const { kto, zdolnosc } = r.rows[0]
    await pool.query(`delete from desk.grant where kto=$1 and zdolnosc=$2`, [kto, zdolnosc])
    await pool.query(
      `update desk.prosba set stan='odrzucona', rozpatrzona=now(), rozpatrzyl=$2 where id=$1`,
      [id, u.id],
    )
    await dziennik.zapisz(u.id, "zdolnosc.cofnieta", { komu: kto, zdolnosc })
    return NextResponse.json({ ok: true })
  }

  if (decyzja !== "przyznana" && decyzja !== "odrzucona") {
    return NextResponse.json({ blad: "Nieznana decyzja." }, { status: 400 })
  }
  const r = await pool.query(`select kto, zdolnosc, stan from desk.prosba where id=$1`, [id])
  if (!r.rowCount) return NextResponse.json({ blad: "Nie ma takiej prośby." }, { status: 404 })
  if (r.rows[0].stan !== "oczekuje") {
    return NextResponse.json({ blad: "Ta prośba jest już rozpatrzona." }, { status: 409 })
  }
  const { kto, zdolnosc } = r.rows[0]

  await pool.query(`update desk.prosba set stan=$2, rozpatrzona=now(), rozpatrzyl=$3 where id=$1`, [
    id,
    decyzja,
    u.id,
  ])
  if (zdolnosc === "inne" && decyzja === "przyznana") {
    // nie ma czego nadać — taką prośbę można wyłącznie odnotować jako przyjętą do rozważenia
    return NextResponse.json(
      { blad: "Tej prośby nie da się przyznać jednym kliknięciem — to zgłoszenie do katalogu." },
      { status: 400 },
    )
  }
  if (decyzja === "przyznana") {
    await pool.query(
      `insert into desk.grant (kto, zdolnosc, nadal) values ($1,$2,$3)
       on conflict (kto, zdolnosc) do nothing`,
      [kto, zdolnosc, u.id],
    )
  }
  await dziennik.zapisz(u.id, `prosba.${decyzja}`, { komu: kto, zdolnosc })
  return NextResponse.json({ ok: true })
}
