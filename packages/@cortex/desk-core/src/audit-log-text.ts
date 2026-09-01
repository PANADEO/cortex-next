import type { DeskT } from "@cortex/desk-ui/i18n/locale"
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
export function describeEntry(
  w: AuditEntry,
  translate: DeskT,
): { text: string; weight: "normal" | "important" } {
  const s = w.details ?? {}
  switch (w.type) {
    case "case.created":
      return { text: translate("journal.caseCreated"), weight: "normal" }
    case "turn.start":
      return {
        text: translate("journal.turnStart", {
          fingerprint: s.fingerprint ?? "?",
          count: Array.isArray(s.capabilities) ? s.capabilities.length : 0,
        }),
        weight: "normal",
      }
    case "turn.end":
      // Koszt policzony z wpisanych w kod stawek, a nie wzięty od dostawcy, to stan
      // do naprawienia, nie szczegół — dzienny limit pracownika opiera się na tej
      // liczbie. Cicho wygląda tak samo jak prawidłowy, więc mówi o sobie w dzienniku.
      return s.costBasis === "estimate"
        ? {
            text: translate("journal.turnEndEstimated"),
            weight: "important",
          }
        : { text: translate("journal.turnEnd"), weight: "normal" }
    case "turn.stopped":
      return { text: translate("journal.turnStopped"), weight: "normal" }
    case "turn.failed":
      return {
        text: translate("journal.turnFailed", { reason: String(s.reason ?? "") }),
        weight: "important",
      }
    case "request.opened":
      return {
        text: translate("journal.requestOpened", { name: capabilityName(s.capability) }),
        weight: "important",
      }
    case "request.granted":
      return {
        text: translate("journal.requestGranted", {
          name: capabilityName(s.capability),
          who: firstName(s.toWhom),
        }),
        weight: "important",
      }
    case "request.denied":
      return {
        text: translate("journal.requestDenied", {
          name: capabilityName(s.capability),
          who: firstName(s.toWhom),
        }),
        weight: "important",
      }
    case "request.other":
      return {
        text: translate("journal.requestOther", { description: String(s.description ?? "") }),
        weight: "important",
      }
    case "capability.revoked":
      return {
        text: translate("journal.capabilityRevoked", {
          name: capabilityName(s.capability),
          who: firstName(s.toWhom),
        }),
        weight: "important",
      }
    case "capability.missing":
      return {
        text: translate("journal.capabilityMissing", { description: String(s.description ?? "") }),
        weight: "important",
      }
    case "access.denied":
      return { text: translate("journal.accessDenied"), weight: "important" }
    case "files.upload":
      return {
        text: translate("journal.fileUpload", { name: String(s.name ?? "") }),
        weight: "normal",
      }
    case "files.trash":
      return {
        text: translate("journal.fileTrash", { path: String(s.path ?? "") }),
        weight: "normal",
      }
    case "files.restore":
      return { text: translate("journal.fileRestore"), weight: "normal" }
    case "files.move":
      return {
        text: translate("journal.fileMove", { from: String(s.from ?? "") }),
        weight: "normal",
      }
    case "files.copy":
      return {
        text: translate("journal.fileCopy", { from: String(s.from ?? "") }),
        weight: "normal",
      }
    case "files.folder":
      return {
        text: translate("journal.fileFolder", { path: String(s.path ?? "") }),
        weight: "normal",
      }
    case "mcp.server.added":
      return {
        text: translate("journal.mcpServerAdded", { name: String(s.name ?? "") }),
        weight: "important",
      }
    case "mcp.server.inspected":
      return {
        text: translate("journal.mcpServerInspected", { server: String(s.server ?? "") }),
        weight: "normal",
      }
    case "mcp.tool.approved":
      return {
        text: translate("journal.mcpToolApproved", {
          tool: String(s.tool ?? ""),
          server: String(s.server ?? ""),
        }),
        weight: "important",
      }
    case "mcp.tool.withdrawn":
      return {
        text: translate("journal.mcpToolWithdrawn", {
          tool: String(s.tool ?? ""),
          server: String(s.server ?? ""),
        }),
        weight: "important",
      }
    case "mcp.tool.suspended":
      // to jedyny wpis, który zapisuje sama aplikacja bez udziału człowieka
      return {
        text: translate("journal.mcpToolSuspended", {
          tool: String(s.tool ?? ""),
          reason: String(s.reason ?? ""),
        }),
        weight: "important",
      }
    case "cost.reset":
      return {
        text: translate("journal.costReset", {
          usd: String(s.usd ?? 0),
          count: Number(s.cases ?? 0),
        }),
        weight: "normal",
      }
    default:
      return { text: translate("journal.unknown", { type: w.type }), weight: "normal" }
  }
}
