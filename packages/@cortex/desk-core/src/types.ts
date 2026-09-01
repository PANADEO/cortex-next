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

/**
 * Zdolność niesie TOŻSAMOŚĆ i DZIAŁ-właściciela, a nie słowa. Nazwa i opis stoją
 * w słowniku pod `capability.<id>` — inaczej katalog byłby po polsku także wtedy,
 * gdy cały ekran jest po angielsku. Dział jest tu wartością (`accounting`), nie
 * napisem do czytania; napis robi z niego `capability.department.<dział>`.
 */
export type Capability = { id: string; department: string }
export type Role = "member" | "management"

export type User = {
  id: string
  firstName: string
  lastName: string
  department: string
  role: Role
  /** Identyfikatory zleceń startowych; słowa stoją w słowniku pod `quickTask.<id>`. */
  quickTasks: string[]
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

/**
 * Stan zgody na narzędzie z serwera MCP. Stoi TUTAJ, a nie osobno w katalogu i osobno
 * w ekranie przełożonego, bo raz już się rozjechał: po przemianowaniu baza zaczęła
 * zapisywać `suspended`, a ekran dalej porównywał z `wstrzymane` — czyli ostrzeżenie
 * o wstrzymanym narzędziu przestało się pokazywać, i to bez jednego błędu kompilacji,
 * bo odpowiedź z `fetch` jest nietypowana. Wspólny typ zamienia to w błąd `tsc`.
 */
export type McpToolStatus = "approved" | "suspended"

export type AuditEntry = { seq: number; at: string; event: DeskEvent }

export type FileMeta = {
  path: string
  name: string
  folder: boolean
  size: number
  modifiedAt: string
}
