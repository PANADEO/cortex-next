// Konwersja wgranych plików (File[]) na data URI base64 do wysyłki w JSON
// body POST /api/visual-guru/generate — przeglądarkowy FileReader, więc ten
// moduł importowany jest wyłącznie z komponentów klienckich.

export interface ReadFileResult {
  dataUrl: string
  fileName: string
}

function readFileAsDataUrl(file: File): Promise<ReadFileResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ dataUrl: String(reader.result), fileName: file.name })
    reader.onerror = () => reject(reader.error ?? new Error("Nie udało się odczytać pliku"))
    reader.readAsDataURL(file)
  })
}

export function readFilesAsDataUrls(files: File[]): Promise<ReadFileResult[]> {
  return Promise.all(files.map(readFileAsDataUrl))
}
