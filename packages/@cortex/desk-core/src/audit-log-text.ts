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
 */
export function describeEntry(w: AuditEntry): { text: string; weight: "normal" | "important" } {
  const s = w.details ?? {}
  switch (w.type) {
    case "case.created":
      return { text: "założyła nową sprawę", weight: "normal" }
    case "turn.start":
      return {
        text: `zleciła pracę · zakres uprawnień ${s.fingerprint ?? "?"} (${Array.isArray(s.capabilities) ? s.capabilities.length : "?"} zdolności)`,
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
      return { text: "zatrzymała pracę agenta", weight: "normal" }
    case "turn.failed":
      return { text: `praca nie powiodła się: ${s.reason ?? "bez powodu"}`, weight: "important" }
    case "request.opened":
      return { text: `poprosiła o zdolność „${capabilityName(s.capability)}”`, weight: "important" }
    case "request.granted":
      return {
        text: `przyznał zdolność „${capabilityName(s.capability)}” osobie ${firstName(s.toWhom)}`,
        weight: "important",
      }
    case "request.denied":
      return {
        text: `odmówił zdolności „${capabilityName(s.capability)}” osobie ${firstName(s.toWhom)}`,
        weight: "important",
      }
    case "request.other":
      return {
        text: `poprosiła o coś spoza katalogu: „${s.description ?? ""}”`,
        weight: "important",
      }
    case "capability.revoked":
      return {
        text: `cofnął zdolność „${capabilityName(s.capability)}” osobie ${firstName(s.toWhom)}`,
        weight: "important",
      }
    case "capability.missing":
      return { text: `napotkała brak zdolności: ${s.description ?? ""}`, weight: "important" }
    case "access.denied":
      return { text: "próba sięgnięcia po cudze — odrzucona", weight: "important" }
    case "files.upload":
      return { text: `wgrała plik ${s.name ?? ""}`, weight: "normal" }
    case "files.trash":
      return { text: `usunęła plik ${s.path ?? ""}`, weight: "normal" }
    case "files.restore":
      return { text: "przywróciła plik z kosza", weight: "normal" }
    case "files.move":
      return { text: `przeniosła plik ${s.z ?? ""}`, weight: "normal" }
    case "files.copy":
      return { text: `skopiowała plik ${s.z ?? ""}`, weight: "normal" }
    case "files.folder":
      return { text: `utworzyła folder ${s.path ?? ""}`, weight: "normal" }
    case "mcp.server.added":
      return { text: `dodała serwer narzędzi ${s.name ?? ""}`, weight: "important" }
    case "mcp.server.inspected":
      return { text: `przejrzała, co wystawia serwer ${s.server ?? ""}`, weight: "normal" }
    case "mcp.tool.approved":
      return {
        text: `przyjęła narzędzie ${s.tool ?? ""} z serwera ${s.server ?? ""}`,
        weight: "important",
      }
    case "mcp.tool.withdrawn":
      return {
        text: `wycofała narzędzie ${s.tool ?? ""} z serwera ${s.server ?? ""}`,
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
