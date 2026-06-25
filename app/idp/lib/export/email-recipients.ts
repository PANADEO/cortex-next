const STORAGE_KEY = "cortex.idp.export.emailRecipients"
const MAX_RECIPIENTS = 10
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null
  return window.localStorage
}

export function normalizeExportEmailRecipient(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return EMAIL_PATTERN.test(normalized) ? normalized : null
}

function storageKeyForUser(userEmail?: string | null): string {
  const normalizedUserEmail = normalizeExportEmailRecipient(userEmail ?? "")
  return normalizedUserEmail ? `${STORAGE_KEY}:${normalizedUserEmail}` : STORAGE_KEY
}

export function addExportEmailRecipient(recipients: readonly string[], email: string): string[] {
  const normalized = normalizeExportEmailRecipient(email)
  if (!normalized) return recipients.slice(0, MAX_RECIPIENTS)

  return [normalized, ...recipients.filter((item) => item.toLowerCase() !== normalized)].slice(
    0,
    MAX_RECIPIENTS,
  )
}

export function loadExportEmailRecipients(userEmail?: string | null): string[] {
  const storage = getStorage()
  if (!storage) return []

  try {
    const parsed = JSON.parse(storage.getItem(storageKeyForUser(userEmail)) ?? "[]") as unknown
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

export function saveExportEmailRecipients(
  recipients: readonly string[],
  userEmail?: string | null,
): void {
  const storage = getStorage()
  if (!storage) return

  storage.setItem(storageKeyForUser(userEmail), JSON.stringify(recipients.slice(0, MAX_RECIPIENTS)))
}

export function rememberExportEmailRecipient(
  email: string,
  userEmail?: string | null,
): string[] {
  const recipients = addExportEmailRecipient(loadExportEmailRecipients(userEmail), email)
  saveExportEmailRecipients(recipients, userEmail)
  return recipients
}
