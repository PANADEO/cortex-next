/** Słownik zdarzeń jest NASZ. Żaden typ biblioteki agentowej nie przekracza tej granicy. */
export type DeskEvent =
  | { type: "lifecycle"; status: "start" | "end" | "stopped" | "failed"; reason?: string }
  | { type: "prompt"; text: string; attachments?: string[] }
  | { type: "attachment"; names: string[] }
  | { type: "assistant"; text: string }
  | {
      type: "tool_start"
      id?: string
      name: string
      label: string
      args: Record<string, unknown>
      source?: string
    }
  | {
      type: "tool_end"
      id?: string
      name: string
      ok: boolean
      summary: string
      ms: number
    }
  | {
      type: "blocked"
      description: string
      capabilityId?: string
      name?: string
      department?: string
    }
  // `basis` mówi, czy to pieniądze, czy zgadywanie. Dzienny limit pracownika jest
  // jedyną twardą granicą wydatków w tym produkcie, więc różnica między liczbą od
  // dostawcy a liczbą wyliczoną z wpisanych w kod stawek nie może być niewidoczna.
  | { type: "cost"; usd: number; basis: "provider" | "estimate" }

export type Capability = { id: string; name: string; department: string; description: string }
export type Role = "member" | "management"

export type User = {
  id: string
  firstName: string
  lastName: string
  department: string
  role: Role
  quickTasks: { title: string; hint: string; text: string }[]
}

/** Wynik materializacji polityki — to, co fizycznie trafia do instancji. */
export type Policy = {
  user: string
  role: Role
  granted: Capability[]
  blocked: Capability[]
  dailyLimitUsd: number
  fingerprint: string
}

export type CaseStatus = "new" | "working" | "done" | "stopped" | "failed"

export type Case = {
  id: string
  owner: string
  title: string
  status: CaseStatus
  createdAt: string
  updatedAt: string
  costUsd: number
  reason: string | null
}

export type AuditEntry = { seq: number; at: string; event: DeskEvent }

export type FileMeta = {
  path: string
  name: string
  folder: boolean
  size: number
  modifiedAt: string
}
