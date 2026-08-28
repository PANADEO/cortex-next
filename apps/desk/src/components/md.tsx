'use client'
import React from 'react'

/** Mały renderer markdown — nagłówki, listy, tabele, pogrubienia, kod. Bez zależności. */
export function Md({ tekst }: { tekst: string }) {
  const bloki: React.ReactNode[] = []
  const linie = tekst.replace(/\r/g, '').split('\n')
  let i = 0
  const inline = (s: string, k: string) => {
    const czesci = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
    return czesci.map((c, j) =>
      c.startsWith('**') ? <strong key={`${k}b${j}`}>{c.slice(2, -2)}</strong>
      : c.startsWith('`') ? <code key={`${k}c${j}`}>{c.slice(1, -1)}</code>
      : <React.Fragment key={`${k}t${j}`}>{c}</React.Fragment>)
  }
  while (i < linie.length) {
    const l = linie[i]
    if (!l.trim()) { i++; continue }
    const h = l.match(/^(#{1,3})\s+(.*)/)
    if (h) { const T = (['h1','h2','h3'] as const)[h[1].length - 1]
      bloki.push(React.createElement(T, { key: i }, inline(h[2], `h${i}`))); i++; continue }
    if (/^\|.*\|/.test(l) && /^\|[\s:|-]+\|$/.test(linie[i + 1] ?? '')) {
      const kom = (w: string) => w.split('|').slice(1, -1).map((c) => c.trim())
      const glowa = kom(l); i += 2
      const wiersze: string[][] = []
      while (i < linie.length && /^\|.*\|/.test(linie[i])) { wiersze.push(kom(linie[i])); i++ }
      bloki.push(
        <table key={`t${i}`}><thead><tr>{glowa.map((c, j) => <th key={j}>{inline(c, `th${j}`)}</th>)}</tr></thead>
          <tbody>{wiersze.map((w, j) => <tr key={j}>{w.map((c, k) => <td key={k}>{inline(c, `td${j}${k}`)}</td>)}</tr>)}</tbody></table>)
      continue
    }
    if (/^[-*]\s+/.test(l)) {
      const el: string[] = []
      while (i < linie.length && /^[-*]\s+/.test(linie[i])) { el.push(linie[i].replace(/^[-*]\s+/, '')); i++ }
      bloki.push(<ul key={`u${i}`}>{el.map((e, j) => <li key={j}>{inline(e, `li${j}`)}</li>)}</ul>); continue
    }
    if (/^\d+[.)]\s+/.test(l)) {
      const el: string[] = []
      while (i < linie.length && /^\d+[.)]\s+/.test(linie[i])) { el.push(linie[i].replace(/^\d+[.)]\s+/, '')); i++ }
      bloki.push(<ol key={`o${i}`}>{el.map((e, j) => <li key={j}>{inline(e, `oi${j}`)}</li>)}</ol>); continue
    }
    const ak: string[] = []
    while (i < linie.length && linie[i].trim() && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|\|)/.test(linie[i])) { ak.push(linie[i]); i++ }
    bloki.push(<p key={`p${i}`}>{inline(ak.join(' '), `p${i}`)}</p>)
  }
  return <div className="prose-desk">{bloki}</div>
}
