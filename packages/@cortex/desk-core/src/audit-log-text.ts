import { capabilityCatalogue } from "./capability-gate"
import { USERS } from "./identity"

type AuditEntry = { at: string; who: string; type: string; details: Record<string, unknown> }

const capabilityName = (id: unknown) =>
  capabilityCatalogue.find((z) => z.id === id)?.name ?? String(id ?? "")

/** W dzienniku dla audytora mają stać imiona, nie identyfikatory z bazy. */
const firstName = (id: unknown) => {
  const u = USERS.find((x) => x.id === id)
  return u ? `${u.firstName} ${u.lastName}` : String(id ?? "")
}

/**
 * Dziennik czyta audytor, nie programista — więc surowy JSON nigdy nie trafia na ekran.
 * Nieznany typ opisujemy uczciwie jako nieznany, zamiast udawać, że rozumiemy.
 *
 * CZAS TERAŹNIEJSZY, i to nie jest kwestia stylu. Zdania stały wcześniej w czasie
 * przeszłym, czyli w polszczyźnie MIAŁY RODZAJ — i były pisane pod Annę, więc Robertowi
 * dziennik pokazywał „Robert przyjęła narzędzie". Część wpisów miała przy tym rodzaj
 * męski (`przyznał`, `cofnął`), więc dla każdej osoby połowa zdań była błędna.
 * Rodzaju nie ma skąd wziąć: `User` go nie niesie i nie powinien. Czas teraźniejszy
 * rodzaju nie ma wcale, a w dzienniku z godziną obok czyta się naturalnie.
 */
export function describeEntry(w: AuditEntry): { text: string; weight: "normal" | "important" } {
  const s = w.details ?? {}
  switch (w.type) {
    case "case.created":
      return { text: "zakłada nową sprawę", weight: "normal" }
    case "turn.start":
      return {
        text: `zleca pracę · zakres uprawnień ${s.fingerprint ?? "?"} (${Array.isArray(s.capabilities) ? s.capabilities.length : "?"} zdolności)`,
        weight: "normal",
      }
    case "turn.end":
      // Koszt policzony z wpisanych w kod stawek, a nie wzięty od dostawcy, to stan
      // do naprawienia, nie szczegół — dzienny limit pracownika opiera się na tej
      // liczbie. Cicho wygląda tak samo jak prawidłowy, więc mówi o sobie w dzienniku.
      return s.costBasis === "estimate"
        ? {
            text: "praca zakończona — koszt oszacowany, dostawca go nie podał",
            weight: "important",
          }
        : { text: "praca zakończona", weight: "normal" }
    case "turn.stopped":
      return { text: "zatrzymuje pracę agenta", weight: "normal" }
    case "turn.failed":
      return { text: `praca nie powiodła się: ${s.reason ?? "bez powodu"}`, weight: "important" }
    case "request.opened":
      return { text: `prosi o zdolność „${capabilityName(s.capability)}”`, weight: "important" }
    case "request.granted":
      return {
        text: `przyznaje zdolność „${capabilityName(s.capability)}” osobie ${firstName(s.toWhom)}`,
        weight: "important",
      }
    case "request.denied":
      return {
        text: `odmawia zdolności „${capabilityName(s.capability)}” osobie ${firstName(s.toWhom)}`,
        weight: "important",
      }
    case "request.other":
      return {
        text: `prosi o coś spoza katalogu: „${s.description ?? ""}”`,
        weight: "important",
      }
    case "capability.revoked":
      return {
        text: `cofa zdolność „${capabilityName(s.capability)}” osobie ${firstName(s.toWhom)}`,
        weight: "important",
      }
    case "capability.missing":
      return { text: `napotyka brak zdolności: ${s.description ?? ""}`, weight: "important" }
    case "access.denied":
      return { text: "próba sięgnięcia po cudze — odrzucona", weight: "important" }
    case "files.upload":
      return { text: `wgrywa plik ${s.name ?? ""}`, weight: "normal" }
    case "files.trash":
      return { text: `usuwa plik ${s.path ?? ""}`, weight: "normal" }
    case "files.restore":
      return { text: "przywraca plik z kosza", weight: "normal" }
    case "files.move":
      return { text: `przenosi plik ${s.from ?? ""}`, weight: "normal" }
    case "files.copy":
      return { text: `kopiuje plik ${s.from ?? ""}`, weight: "normal" }
    case "files.folder":
      return { text: `tworzy folder ${s.path ?? ""}`, weight: "normal" }
    case "mcp.server.added":
      return { text: `dodaje serwer narzędzi ${s.name ?? ""}`, weight: "important" }
    case "mcp.server.inspected":
      return { text: `przegląda, co wystawia serwer ${s.server ?? ""}`, weight: "normal" }
    case "mcp.tool.approved":
      return {
        text: `przyjmuje narzędzie ${s.tool ?? ""} z serwera ${s.server ?? ""}`,
        weight: "important",
      }
    case "mcp.tool.withdrawn":
      return {
        text: `wycofuje narzędzie ${s.tool ?? ""} z serwera ${s.server ?? ""}`,
        weight: "important",
      }
    case "mcp.tool.suspended":
      // to jedyny wpis, który zapisuje sama aplikacja bez udziału człowieka
      return {
        text: `— narzędzie ${s.tool ?? ""} wstrzymane: ${s.reason ?? ""}`,
        weight: "important",
      }
    case "cost.reset":
      return {
        text: `— wyzerowano dzisiejszy koszt (${s.usd ?? 0} USD na ${s.cases ?? 0} sprawach)`,
        weight: "normal",
      }
    default:
      return { text: `zdarzenie „${w.type}” (nieopisane)`, weight: "normal" }
  }
}
