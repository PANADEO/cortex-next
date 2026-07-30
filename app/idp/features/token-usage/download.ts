/**
 * Pobranie pliku zbudowanego W PRZEGLĄDARCE z danych, które klient już ma.
 * Zero dodatkowego round-tripu do serwera i zero kolejnego zapytania do
 * cortex-proxy tylko po to, żeby złożyć plik.
 */
export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Bez revoke Blob żyje do końca życia karty — przy kilku eksportach z rzędu
  // to realny wyciek pamięci, nie teoria.
  URL.revokeObjectURL(url)
}
