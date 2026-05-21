const STORAGE_KEY = "cortex.idp.export.emailRecipients"
const MAX_RECIPIENTS = 10
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}

export function normalizeExportEmailRecipient(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return EMAIL_PATTERN.test(normalized) ? normalized : null
}

export function addExportEmailRecipient(recipients: readonly string[], email: string): string[] {
  const normalized = normalizeExportEmailRecipient(email)
  if (!normalized) return recipients.slice(0, MAX_RECIPIENTS)

  return [normalized, ...recipients.filter((item) => item.toLowerCase() !== normalized)].slice(
    0,
    MAX_RECIPIENTS,
  )
}

export function loadExportEmailRecipients(): string[] {
  const storage = getStorage()
  if (!storage) return []

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]") as unknown
    if (!Array.isArray(parsed)) return []

    const recipients: string[] = []
    for (const item of parsed) {
      if (typeof item !== "string") continue
      const normalized = normalizeExportEmailRecipient(item)
      if (!normalized || recipients.includes(normalized)) continue
      recipients.push(normalized)
      if (recipients.length >= MAX_RECIPIENTS) break
    }
    return recipients
  } catch {
    return []
  }
}

export function saveExportEmailRecipients(recipients: readonly string[]): void {
  const storage = getStorage()
  if (!storage) return

  storage.setItem(STORAGE_KEY, JSON.stringify(recipients.slice(0, MAX_RECIPIENTS)))
}

export function rememberExportEmailRecipient(email: string): string[] {
  const recipients = addExportEmailRecipient(loadExportEmailRecipients(), email)
  saveExportEmailRecipients(recipients)
  return recipients
}
