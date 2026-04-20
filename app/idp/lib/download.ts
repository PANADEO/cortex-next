export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on next tick — Safari may still be resolving the download when the sync revoke fires.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
