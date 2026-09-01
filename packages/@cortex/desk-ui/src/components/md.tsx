"use client"
import React from "react"

/** Mały renderer markdown — nagłówki, listy, tabele, pogrubienia, kod. Bez zależności. */
export function Md({ tekst }: { tekst: string }) {
  const bloki: React.ReactNode[] = []
  const linie = tekst.replace(/\r/g, "").split("\n")
  // Czytanie po indeksie zamiast `linie[n]`: pętle niżej wielokrotnie zaglądają przed koniec
  // tablicy i za niego, a „za końcem" znaczy tu dokładnie tyle samo, co pusta linia.
  const w = (n: number) => linie[n] ?? ""
  let i = 0
  const inline = (s: string, k: string) => {
    const czesci = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
    return czesci.map((c, j) =>
      c.startsWith("**") ? (
        <strong key={`${k}b${j}`}>{c.slice(2, -2)}</strong>
      ) : c.startsWith("`") ? (
        <code key={`${k}c${j}`}>{c.slice(1, -1)}</code>
      ) : (
        <React.Fragment key={`${k}t${j}`}>{c}</React.Fragment>
      ),
    )
  }
  while (i < linie.length) {
    const l = w(i)
    if (!l.trim()) {
      i++
      continue
    }
    const h = l.match(/^(#{1,3})\s+(.*)/)
    if (h) {
      const T = (["h1", "h2", "h3"] as const)[(h[1] ?? "#").length - 1] ?? "h3"
      bloki.push(React.createElement(T, { key: i }, inline(h[2] ?? "", `h${i}`)))
      i++
      continue
    }
    if (/^\|.*\|/.test(l) && /^\|[\s:|-]+\|$/.test(w(i + 1))) {
      const kom = (wiersz: string) =>
        wiersz
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim())
      const glowa = kom(l)
      i += 2
      const wiersze: string[][] = []
      while (i < linie.length && /^\|.*\|/.test(w(i))) {
        wiersze.push(kom(w(i)))
        i++
      }
      // tabela w wąskim panelu wyniku musi przewijać się w poziomie, a nie łamać liczb
      bloki.push(
        <div key={`t${i}`} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {glowa.map((c, j) => (
                  <th key={j}>{inline(c, `th${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wiersze.map((wr, j) => (
                <tr key={j}>
                  {wr.map((c, k) => (
                    <td key={k}>{inline(c, `td${j}${k}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^[-*]\s+/.test(l)) {
      const el: string[] = []
      while (i < linie.length && /^[-*]\s+/.test(w(i))) {
        el.push(w(i).replace(/^[-*]\s+/, ""))
        i++
      }
      bloki.push(
        <ul key={`u${i}`}>
          {el.map((e, j) => (
            <li key={j}>{inline(e, `li${j}`)}</li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\d+[.)]\s+/.test(l)) {
      const el: string[] = []
      while (i < linie.length && /^\d+[.)]\s+/.test(w(i))) {
        el.push(w(i).replace(/^\d+[.)]\s+/, ""))
        i++
      }
      bloki.push(
        <ol key={`o${i}`}>
          {el.map((e, j) => (
            <li key={j}>{inline(e, `oi${j}`)}</li>
          ))}
        </ol>,
      )
      continue
    }
    const ak: string[] = []
    while (i < linie.length && w(i).trim() && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|\|)/.test(w(i))) {
      ak.push(w(i))
      i++
    }
    bloki.push(<p key={`p${i}`}>{inline(ak.join(" "), `p${i}`)}</p>)
  }
  return <div className="prose-desk">{bloki}</div>
}
