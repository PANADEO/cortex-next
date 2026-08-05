import path from "node:path"
import { builtinSkillsDir, resolveAppDataDir } from "@/lib/data-dir"
import type {
  CoworkConnectorConfig,
  CoworkGovernanceConfig,
  CoworkModelConfig,
  CoworkProjectConfig,
  CoworkRole,
} from "@cortex/types"
import {
  DEFAULT_COWORK_MODEL_ID,
  DEFAULT_COWORK_PROJECT_ID,
  DEFAULT_DEPARTMENT,
  emptyComposition,
  grantMatches,
} from "@cortex/types"
import { emailsMatch } from "@cortex/utils"
import { readJsonOr, writeJsonAtomic } from "./json-file"

// Governance config store for the cortex-config tile: department tree, skill
// sources, connector catalog, roles (access gates), user assignments and
// project tiles (with composition grants), persisted as one JSON document.
// Real disk instead of module state (Turbopack route isolation), single-writer
// semantics are fine for an on-prem admin panel.

function resolveDataDir(): string {
  return process.env.COWORK_DATA_DIR ?? resolveAppDataDir("cortex-cowork")
}

export const COWORK_DATA_DIR = resolveDataDir()
const CONFIG_FILE = path.join(COWORK_DATA_DIR, "governance.json")

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * First-run seed: one department, the built-in skills as a source, and the
 * legacy cortex-cowork tile composed from that department so existing chat
 * routes work with no manual setup.
 */
function seedConfig(): CoworkGovernanceConfig {
  const createdAt = nowIso()
  return {
    version: 3,
    departments: [DEFAULT_DEPARTMENT],
    skillSources: [
      {
        id: "builtin",
        name: "Wbudowane skille",
        folderPath: builtinSkillsDir(),
        department: DEFAULT_DEPARTMENT,
      },
    ],
    connectors: [],
    roles: [{ id: "analyst", name: "Analyst", description: "Domyślna rola dostępu" }],
    userAssignments: {},
    adminEmails: [],
    projects: [
      {
        id: DEFAULT_COWORK_PROJECT_ID,
        name: "Cortex Cowork",
        description: "Chat with an agent that produces downloadable artifacts in a sandbox.",
        icon: "bot",
        enabled: true,
        archetype: "task-chat",
        allowedRoleIds: ["analyst"],
        // Routed through cortex-proxy, no provider key anywhere - see
        // cortexProxyModelBaseUrl() for why apiKeyRef stays unset. No baseUrl
        // either: the endpoint is environment state, injected per turn by
        // modelConfigForRunner().
        model: {
          provider: "openai-compatible",
          modelId: DEFAULT_COWORK_MODEL_ID,
        },
        composition: {
          skills: { branches: [DEFAULT_DEPARTMENT], leaves: [] },
          connectors: { branches: [], leaves: [] },
          secrets: { branches: [], leaves: [] },
        },
        sandbox: { mode: "local", allowedPaths: [] },
        createdAt,
        updatedAt: createdAt,
      },
    ],
  }
}

// --- legacy on-disk shapes ----------------------------------------------------

// These describe what is IN THE FILE, not what the app accepts. They exist as
// their own types precisely because the union in @cortex/types no longer
// admits the values a pre-v3 document can hold: `provider: "anthropic"` was
// removed there on 05.08.2026, and `baseUrl` stopped being persisted the same
// day. A migration that typed its input as the current shape would have to
// lie with a cast to even read the fields it exists to repair.

/** Model config as v1/v2 files hold it: the removed arm, plus a frozen endpoint. */
interface LegacyModelConfig extends Omit<CoworkModelConfig, "provider"> {
  provider: CoworkModelConfig["provider"] | "anthropic"
}

interface LegacyProjectShape extends Omit<CoworkProjectConfig, "model"> {
  model: LegacyModelConfig
}

// --- v1 -> v2 migration -------------------------------------------------------

interface LegacyProjectConfig extends Omit<LegacyProjectShape, "composition"> {
  connectors?: CoworkConnectorConfig[]
}
interface LegacyConfig {
  version: 1
  skillGroups?: unknown
  roles?: Array<{ id: string; name: string; description?: string }>
  userAssignments?: Record<string, string[]>
  adminEmails?: string[]
  projects?: LegacyProjectConfig[]
}

/** Shape between the two migrations: v2's structure, pre-v3 model repair. */
type V2Config = Omit<CoworkGovernanceConfig, "version" | "projects"> & {
  version: 2
  projects: LegacyProjectShape[]
}

/**
 * v1 stored skills as flat groups + role->group entitlement and connectors
 * inline per project. v2 is a departmental catalog + project composition.
 * Migration: everything lands in the default department, each project grants
 * that department's skills and keeps its (now catalog-promoted) connectors.
 */
function migrateV1(legacy: LegacyConfig): V2Config {
  const connectors: CoworkConnectorConfig[] = []
  const projects: LegacyProjectShape[] = (legacy.projects ?? []).map((project) => {
    const inline = project.connectors ?? []
    for (const connector of inline) {
      if (!connectors.some((existing) => existing.id === connector.id)) {
        connectors.push({ ...connector, department: DEFAULT_DEPARTMENT })
      }
    }
    const { connectors: _legacyConnectors, ...rest } = project
    void _legacyConnectors
    return {
      ...rest,
      composition: {
        skills: { branches: [DEFAULT_DEPARTMENT], leaves: [] },
        connectors: { branches: [], leaves: inline.map((connector) => connector.id) },
        secrets: { branches: [], leaves: [] },
      },
    }
  })

  return {
    version: 2,
    departments: [DEFAULT_DEPARTMENT],
    skillSources: [
      {
        id: "builtin",
        name: "Wbudowane skille",
        folderPath: builtinSkillsDir(),
        department: DEFAULT_DEPARTMENT,
      },
    ],
    connectors,
    roles: (legacy.roles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      ...(role.description ? { description: role.description } : {}),
    })),
    userAssignments: legacy.userAssignments ?? {},
    adminEmails: legacy.adminEmails ?? [],
    projects,
  }
}

// --- v2 -> v3 migration -------------------------------------------------------

/**
 * v3 = "model config zawiera wyłącznie to, co należy do PROJEKTU". Czyli:
 * żadnego `provider: "anthropic"` i żadnego zapisanego `baseUrl`.
 *
 * Skąd te dwie naprawy:
 *
 * 1. Do 05.08.2026 domyślny projekt siedział na `provider: "anthropic"` BEZ
 *    `baseUrl` i BEZ `apiKeyRef`, licząc na to, że Flue znajdzie sobie klucz
 *    w `ANTHROPIC_API_KEY` w env. Ta zmienna została usunięta (decyzja Alexa:
 *    wszystko idzie przez cortex-proxy), więc taka konfiguracja NIE MA już
 *    skąd wziąć klucza — a to nie kończy się czytelnym błędem, tylko cichym
 *    zjazdem do deterministycznego routera słów kluczowych w `streamChatTurn`
 *    (kafelek dalej odpowiada, tylko udawanym agentem).
 *
 * 2. `baseUrl` był zamrożonym adresem JEDNEGO środowiska w dokumencie, który
 *    to środowisko przeżywa (write-once: nic go nigdy nie odświeżało). Teraz
 *    wstrzykuje go per turę `modelConfigForRunner()` z `CORTEX_PROXY_URL`,
 *    więc pole w pliku jest już tylko myląca resztka — zdejmujemy je.
 *
 * Naprawa DANYCH, nie tylko domyślki w kodzie: istniejące pliki nie są
 * mergowane z seedem (patrz `readGovernanceConfig` niżej), więc bez tego
 * każdy wcześniej zaseedowany deploy po prostu by się popsuł.
 *
 * Naprawa `anthropic` obejmuje TAKŻE projekty z `apiKeyRef` — inaczej niż w
 * pierwszej wersji tej migracji, która je omijała, bo natywne Anthropic z
 * kluczem z credential store było wtedy jeszcze wspieraną ścieżką. Po decyzji
 * Alexa nie jest: taki projekt poleciałby dziś do cortex-proxy z natywnym
 * `modelId` i skończył w tym samym cichym fallbacku, a `CoworkModelProvider`
 * nie ma już arm, w którym dałoby się go zostawić bez okłamania typu castem.
 * Różnica została w tym, CO przeżywa: przy pustym `apiKeyRef` nie zostawiamy
 * po nim pola (byłby to śmieć wyglądający jak świadoma konfiguracja z
 * kluczem), a świadomie ustawiony ref zostaje — to ścieżka w credential
 * store, nie adres środowiska, i cortex-proxy potrafi go użyć jako bearera.
 */
function migrateV2(config: V2Config): CoworkGovernanceConfig {
  return {
    ...config,
    version: 3,
    projects: config.projects.map((project) => {
      // Brak `model` to teoretycznie niemożliwy kształt (typ v1 wymagał go),
      // ale rzucony tu TypeError wywróciłby readGovernanceConfig(), które
      // siedzi na ścieżce żądania KAŻDEJ trasy governance: instancja bez
      // ścieżki samonaprawy. Taniej przepuścić dziwny wiersz bez zmian — cast
      // nazywa ten kompromis wprost: to NIE jest poprawny projekt v3, tylko
      // wiersz, którego nie ma czym naprawić.
      if (!project.model) return project as CoworkProjectConfig

      // baseUrl i headers są rozwiązywane per turę (modelConfigForRunner) —
      // w pliku mogą siedzieć tylko jako pozostałość po starym zapisie.
      const {
        baseUrl: _frozenEndpoint,
        headers: _resolvedPerTurn,
        apiKeyRef,
        provider,
        ...model
      } = project.model
      void _frozenEndpoint
      void _resolvedPerTurn
      const keptKeyRef = apiKeyRef?.trim()
      const wasNativeAnthropic = provider === "anthropic"
      return {
        ...project,
        model: {
          ...model,
          provider: "openai-compatible" as const,
          // Natywny slug ("claude-sonnet-4-5") nie jest tym, czego oczekuje
          // OpenRouter za cortex-proxy — przy zmianie providera modelId musi
          // pójść razem z nim, inaczej naprawa jest pozorna.
          modelId: wasNativeAnthropic ? DEFAULT_COWORK_MODEL_ID : model.modelId,
          ...(keptKeyRef ? { apiKeyRef: keptKeyRef } : {}),
        },
      }
    }),
  }
}

// --- persistence --------------------------------------------------------------

export async function readGovernanceConfig(): Promise<CoworkGovernanceConfig> {
  let seeded = false
  const raw = await readJsonOr<CoworkGovernanceConfig | LegacyConfig>(CONFIG_FILE, () => {
    seeded = true
    return seedConfig()
  })
  if (seeded) {
    await writeJsonAtomic(CONFIG_FILE, raw)
    return raw as CoworkGovernanceConfig
  }
  // Łańcuchowo: v1 przechodzi przez OBIE migracje, v2 tylko przez drugą.
  const version = (raw as { version?: number }).version
  if (version === 1) {
    const migrated = migrateV2(migrateV1(raw as LegacyConfig))
    await writeJsonAtomic(CONFIG_FILE, migrated)
    return migrated
  }
  if (version === 2) {
    const migrated = migrateV2(raw as unknown as V2Config)
    await writeJsonAtomic(CONFIG_FILE, migrated)
    return migrated
  }
  return raw as CoworkGovernanceConfig
}

export async function saveGovernanceConfig(config: CoworkGovernanceConfig): Promise<void> {
  await writeJsonAtomic(CONFIG_FILE, config)
}

export async function getProject(projectId: string): Promise<CoworkProjectConfig | undefined> {
  const config = await readGovernanceConfig()
  return config.projects.find((project) => project.id === projectId)
}

export type UpsertProjectInput = Omit<CoworkProjectConfig, "createdAt" | "updatedAt">

/** Pass `preloaded` when the caller already read the config (avoids a re-read). */
export async function upsertProject(
  input: UpsertProjectInput,
  preloaded?: CoworkGovernanceConfig,
): Promise<CoworkProjectConfig> {
  const config = preloaded ?? (await readGovernanceConfig())
  const existing = config.projects.find((project) => project.id === input.id)
  const project: CoworkProjectConfig = {
    ...input,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  }
  config.projects = [
    ...config.projects.filter((candidate) => candidate.id !== project.id),
    project,
  ]
  await saveGovernanceConfig(config)
  return project
}

export async function deleteProject(
  projectId: string,
  preloaded?: CoworkGovernanceConfig,
): Promise<boolean> {
  const config = preloaded ?? (await readGovernanceConfig())
  const next = config.projects.filter((project) => project.id !== projectId)
  if (next.length === config.projects.length) return false
  config.projects = next
  await saveGovernanceConfig(config)
  return true
}

// --- access gates -------------------------------------------------------------

/**
 * The "activates on first entry" backbone: until the admin creates the first
 * user->role assignment, governance is OPEN - every user sees every enabled
 * tile. This predicate is the only definition of that rule.
 */
export function isOpenMode(config: CoworkGovernanceConfig): boolean {
  return Object.keys(config.userAssignments).length === 0
}

/**
 * Nobody has been named an administrator yet (fresh instance). NOT a licence
 * to administer on its own - see bootstrap-trust.ts for what a caller
 * additionally has to hold while this is true.
 */
export function isBootstrapAdminMode(config: CoworkGovernanceConfig): boolean {
  return config.adminEmails.length === 0
}

/** Named in adminEmails. The only unconditional admin answer this file gives. */
export function isExplicitAdmin(
  config: CoworkGovernanceConfig,
  email: string | undefined,
): boolean {
  return config.adminEmails.some((admin) => emailsMatch(admin, email))
}

/** Roles a user holds, resolved from central assignments. */
export function rolesForUser(config: CoworkGovernanceConfig, email: string): CoworkRole[] {
  const roleIds = config.userAssignments[email.toLowerCase()] ?? []
  return config.roles.filter((role) => roleIds.includes(role.id))
}

// isAdmin(config, email) USED TO LIVE HERE and was removed on 30.07.2026.
// It read:
//
//   if (isBootstrapAdminMode(config)) return true
//   return isExplicitAdmin(config, email)
//
// - i.e. while adminEmails was empty it answered true for EVERY caller,
// including one with no identity at all (email === undefined). Since
// governance.json is gitignored and ships as an empty volume, that was the
// starting state of every new deployment, and requireAdmin() was its only
// caller. Live proof of what it granted an unauthenticated request is in the
// Obsidian note (audyt 6.1 + "Naprawa").
//
// It is gone rather than corrected because the correct rule cannot be
// expressed here: it depends on the caller's system_config grant, which is
// neither in this document nor readable synchronously. The decision now lives
// in the async gates - see bootstrap-trust.ts - and callers compose
// isExplicitAdmin() with isBootstrapAdminMode() instead.

/**
 * Projects a user should see as tiles: enabled, and either open mode, or the
 * user holds one of the project's allowed roles. An EXPLICIT admin sees
 * everything (to reach misconfigured tiles); bootstrap-admin does NOT bypass
 * the role filter once assignments exist.
 *
 * NO IDENTITY MEANS NO PROJECTS, IN EVERY MODE. Until 30.07.2026 a missing
 * email fell into the same branch as open mode and returned EVERY enabled
 * project - so an anonymous GET /api/cortex-cowork/projects (oauth2-proxy
 * bypassed) got the names, descriptions and briefs of all of them. The first
 * round of that fix only closed it for CLOSED mode and left open mode - the
 * state every fresh instance is in - still answering an anonymous caller with
 * everything. An unidentified caller holds no role assignment and no grant,
 * so the filter answers with an empty list regardless of mode; the callers
 * reject it outright before ever getting here (denyAnonymous).
 *
 * Open mode still skips the ROLE filter for an identified caller, which is
 * its purpose - nobody has been assigned a role yet. What it does not skip is
 * the system_config grant, and that is enforced by the gates, not here (see
 * bootstrap-trust.ts).
 */
export function visibleProjectsFor(
  config: CoworkGovernanceConfig,
  email: string | undefined,
): CoworkProjectConfig[] {
  if (!email) return []
  const openMode = isOpenMode(config)
  const explicitAdmin = isExplicitAdmin(config, email)
  return config.projects.filter((project) => {
    if (!project.enabled) return false
    if (openMode || explicitAdmin) return true
    const userRoleIds = new Set(config.userAssignments[email.toLowerCase()] ?? [])
    return project.allowedRoleIds.some((roleId) => userRoleIds.has(roleId))
  })
}

// --- composition resolution (pure; skill catalog resolves on disk elsewhere) --

/** Enabled catalog connectors a project's composition grants. */
export function grantedConnectors(
  config: CoworkGovernanceConfig,
  project: CoworkProjectConfig,
): CoworkConnectorConfig[] {
  return config.connectors.filter(
    (connector) =>
      connector.enabled &&
      grantMatches(project.composition.connectors, {
        id: connector.id,
        department: connector.department,
      }),
  )
}

/** Departments referenced anywhere (explicit list + resource assignments), sorted. */
export function allDepartments(config: CoworkGovernanceConfig): string[] {
  const set = new Set<string>(config.departments)
  for (const source of config.skillSources) set.add(source.department)
  for (const connector of config.connectors) set.add(connector.department)
  return [...set].sort()
}

export { emptyComposition }
