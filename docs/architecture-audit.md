# Cortex 2.0 - Audyt architektury

- Data: 2026-07-14 (W29)
- Zakres: warstwa platformowa Cortex 2.0 - cortex-cowork, cortex-config, governance core (`app/idp/lib/cortex-governance/`), model domenowy (`libs/@cortex/types/src/cortex-cowork.ts`), runner na Flue (`cowork-runner/`)
- Rewizja kodu: branch `feat/cortex-2.0` @ `2bf9983`
- Audytor: Codex (OpenAI gpt-5.6-sol, reasoning effort high), tryb read-only
- Metoda: automatyczny audyt architektury na 6 wymiarach (granice i sprzężenie, bezpieczeństwo, model kompozycji/grantów, robustność runtime, skalowalność, altitude abstrakcji)

> Audyt jechał na kopii kodu z commita `2bf9983` (nie z żywego brancha). Findingi to propozycje do weryfikacji, nie wyrok. Priorytet: 1 Critical + 8 High poniżej są blokerami przed użyciem produkcyjnym/klienckim.

---

## Verdict

Cortex 2.0 has a coherent prototype architecture: the composition model, domain seam, write-only credential references, and standalone runner are sound choices. It is not production-safe yet: project-role authorization stops at tile discovery, sessions are globally shared within a project, and several fail-open/fallback paths weaken the intended data-zone and sandbox boundaries.

## Strengths

- The central model cleanly separates toolkit composition from access roles. `CoworkResourceGrant`, `CoworkProjectComposition`, and pure gate functions live in a sensible shared seam in [`cortex-cowork.ts`](/Users/cez/P/cortex-frontend/libs/@cortex/types/src/cortex-cowork.ts:110).

- `departmentUnder`, `grantMatches`, and `secretPathGranted` use delimiter-aware prefix checks, so `finanse` does not accidentally match `finanse-old`. Exact leaf semantics are also correct in [`cortex-cowork.ts`](/Users/cez/P/cortex-frontend/libs/@cortex/types/src/cortex-cowork.ts:212).

- Credential references and values are separated. Browser-facing configuration contains refs, the credential API returns paths only, and `gateCredentials` creates a project-scoped view before resolution in [`credentials.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/credentials.ts:43).

- Copying only granted skills into a session is a strong capability boundary. The runner loads exclusively from the session copy when one exists, rather than consulting the global catalog in [`sandbox-store.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/sandbox-store.ts:71) and [`cowork-turn.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/workflows/cowork-turn.ts:60).

- The Docker implementation uses argument arrays, deny-by-default bind mounts, `--rm`, signal cleanup, and orphan reaping. CLI connectors similarly use a fixed executable plus argument array rather than a shell command in [`docker-sandbox.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/docker-sandbox.ts:72) and [`connectors.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/connectors.ts:41).

- The model provider is centralized and already supports Anthropic and OpenAI-compatible gateways. Keeping this as the runner’s single LLM transport seam is the right abstraction in [`model-provider.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/model-provider.ts:36).

- Model and tool output is rendered as escaped React text; generated HTML and other artifacts are served as attachments. The immediate browser-XSS posture is therefore better than many agent UIs.

## Findings

### Critical

1. **Project access and session ownership are not enforced by the cowork APIs.**

   The role gate is used only when listing visible tiles. Session GET and POST accept arbitrary project IDs without calling `visibleProjectsFor`; session metadata has no owner; listing returns every session for the project; all message, artifact, export, and delete routes trust only the session UUID. See [`sessions/route.ts`](/Users/cez/P/cortex-frontend/app/idp/app/api/cortex-cowork/sessions/route.ts:17), [`sandbox-store.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/sandbox-store.ts:34), and [`messages/route.ts`](/Users/cez/P/cortex-frontend/app/idp/app/api/cortex-cowork/sessions/[sessionId]/messages/route.ts:9).

   **Risk:** Any authenticated Cortex user can create a session for a restricted project, obtaining its skills, connectors, and project-gated credentials. They can also list and automatically adopt another user’s most recent session, read its transcript, download/export its artifacts, send messages, or delete it.

   **Direction:** Add a single server-side `requireProjectAccess(request, projectId)`/`requireSessionAccess` gate and use it on every cowork route. Persist `ownerEmail` or an explicit session ACL. Filter session lists by that ACL and reauthorize against the current project on every operation.

### High

2. **Authentication and bootstrap administration fail open.**

   Identity is trusted directly from `x-auth-request-email`; `isAdmin` returns true when `adminEmails` is empty even if the email is `undefined`; `visibleProjectsFor` explicitly permits `!email`. `requireAdmin` never first requires authenticated identity. See [`request-identity.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/request-identity.ts:9), [`store.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/store.ts:218), and [`admin-gate.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/admin-gate.ts:18).

   **Risk:** A direct-service exposure, proxy stripping regression, or first-install race gives unauthenticated callers full admin capability, including credential writes. Open mode similarly exposes all enabled projects until the first assignment exists.

   **Direction:** Return 401 whenever production identity is absent. Bootstrap through an explicit one-time token, deployment-provided initial admin, or local-only setup flow. Make open mode an explicit configuration state with a prominent warning, not an empty-map side effect.

3. **The credential boundary is not end-to-end.**

   `gateCredentials` itself works, but an unresolved model ref falls through to the provider’s ambient environment lookup. The runner inherits the entire Next.js process environment, and each CLI connector again receives `{...process.env}`. See [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:157), [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:231), [`model-provider.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/model-provider.ts:42), and [`connectors.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/connectors.ts:50).

   **Risk:** A project whose API-key ref is outside its grant can still use a global `ANTHROPIC_API_KEY`. A CLI connector receives unrelated application secrets such as admin API keys, provider keys, and all serialized project connector credentials. Environment variables are less visible than argv, but they are not a security boundary.

   **Direction:** Spawn the runner with a minimal allowlisted environment. Fail closed when a configured credential ref cannot be resolved. Give each CLI only its declared environment variables; never merge the application environment.

4. **Local mode provides no filesystem security and is the seeded/default mode.**

   The domain comments correctly acknowledge that local mode provides directory separation only, but the initial project and form default both select it. `selectSandbox` returns Flue `local()` for everything other than a valid Docker selection in [`store.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/store.ts:58), [`schemas.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-config/schemas.ts:75), and [`cowork-turn.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/workflows/cowork-turn.ts:115).

   **Risk:** Prompt injection or a malicious skill can read and modify arbitrary host files accessible to the runner account. `allowedPaths` is only prompt text in local mode.

   **Direction:** Make local mode development-only and reject it in production. Seed production projects as Docker, or require an explicit operator override with a severe warning.

5. **Governance revocation does not invalidate existing sessions.**

   Skills are copied once during session creation and loaded on every later turn. Removing a skill grant does not remove it from existing sandboxes. Project disablement, deletion, or user-role revocation is also not checked by session routes; a deleted project causes the runner to proceed without its project configuration. See [`sandbox-store.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/sandbox-store.ts:78), [`cowork-turn.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/workflows/cowork-turn.ts:66), and [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:221).

   **Risk:** Revoked capabilities remain usable indefinitely through old sessions, producing a mixed configuration: stale skills but current connectors, secrets, model, and sandbox settings.

   **Direction:** Record a governance/project revision in session metadata. Reauthorize every turn, and either expire sessions on security-relevant changes or reconcile their copied capability set before execution.

6. **Retries and transport fallback can duplicate model calls and external side effects.**

   Any non-zero runner exit is retried once, even if the process already completed an MCP/CLI mutation. Separately, if the SSE connection fails, the browser sends the same message again through the plain POST while the server explicitly allows the first turn to continue after disconnect. See [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:107), [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:310), [`use-send-message.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/hooks/use-send-message.ts:126), and [`stream/route.ts`](/Users/cez/P/cortex-frontend/app/idp/app/api/cortex-cowork/sessions/[sessionId]/messages/stream/route.ts:45).

   **Risk:** Duplicate tickets, emails, writes, exports, provider spend, and transcript entries.

   **Direction:** Give each turn a client-generated idempotency key and persist its state/result. Reconnect or poll the original turn instead of reposting it. Retry automatically only when failure is known to have occurred before agent/tool execution.

7. **File persistence is crash-aware but not concurrency-safe.**

   Atomic rename prevents torn final documents, but all writers share the same `.tmp` path and every update is read-modify-write with no lock or revision check. Session metadata uses plain `writeFile`, and the source itself notes last-write-wins races. See [`json-file.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/json-file.ts:19), [`store.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/store.ts:175), and [`sandbox-store.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/sandbox-store.ts:50).

   **Risk:** Concurrent admin changes overwrite one another; credential updates disappear; simultaneous turns corrupt or lose messages, usage, and artifact registrations. Multiple app instances are unsafe even with shared storage.

   **Direction:** Move governance, credentials metadata, sessions, and turn state to transactional SQLite or the platform database. Short term: unique temp names, file locking, optimistic revision fields, and a per-session turn mutex.

8. **Catalog identity and grant references lack referential integrity.**

   Project validation checks only that grants contain strings. Connector updates do not enforce unique or slug-valid IDs. Because leaf grants match globally by ID, duplicate connector IDs in different departments cause one leaf to grant both. Skills use order-dependent “first writer wins,” while copying uses `dirName`, creating another collision surface. See [`validation.ts`](/Users/cez/P/cortex-frontend/app/idp/app/api/cortex-config/projects/validation.ts:28), [`connectors/route.ts`](/Users/cez/P/cortex-frontend/app/idp/app/api/cortex-config/catalog/connectors/route.ts:31), [`cortex-cowork.ts`](/Users/cez/P/cortex-frontend/libs/@cortex/types/src/cortex-cowork.ts:217), and [`skills-catalog.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/skills-catalog.ts:30).

   **Risk:** Cross-department privilege widening, nondeterministic skill selection, and stale grants that silently reactivate when a deleted ID or department path is reused.

   **Direction:** Enforce organization-wide unique stable resource IDs, or use qualified IDs such as `sourceId/resourceId`. Validate all grant branches/leaves and role references transactionally; report dangling references and require explicit cleanup or migration.

9. **Credentials are plaintext at rest.**

   The code explicitly stores secrets in plaintext JSON with mode `0600` in [`credentials.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/credentials.ts:7).

   **Risk:** Filesystem snapshots, backups, host compromise, or accidental support bundles disclose every model and connector credential.

   **Direction:** Add envelope encryption using a deployment-provided master key/KMS, with key versioning and rotation. Keep the current write-only API and reference model.

### Medium

10. **Docker limits filesystem visibility, but is not a complete hostile-code sandbox.**

    Containers run as root with unrestricted networking and no memory, CPU, PID, capability, or read-only-root constraints. The `docker run` arguments contain only lifecycle, label, workdir, and volume controls in [`docker-sandbox.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/docker-sandbox.ts:72).

    **Risk:** Runaway commands exhaust the host; prompt-injected code can freely exfiltrate accessible data over the network. Docker failure is also converted into the host-side keyword fallback rather than surfacing the configured policy failure in [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:112). The fallback is visibly marked and does not launch a local agent, but it still violates a strict “Docker project does not degrade” policy.

    **Direction:** Add non-root users, capability dropping, seccomp, resource limits, network policy, read-only root, and explicit egress controls. Do not execute fallback work for Docker-required projects unless governance explicitly allows it.

11. **Composition controls capability availability, not information flow or tool trust.**

    MCP and CLI outputs are treated as ordinary model context; CLI arguments are model-controlled; no side-effect classification, confirmation gate, or cross-zone egress policy exists. Raw tool result excerpts and model thinking are persisted in activity trails in [`connectors.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/connectors.ts:60) and [`observe-events.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/observe-events.ts:59).

    **Risk:** Prompt injection in documents or connector results can induce calls to another connector, data exfiltration, destructive actions, or sensitive data appearing in transcripts and activity details.

    **Direction:** Treat tool results as untrusted data, annotate source/trust zone, separate read and write tools, require human confirmation for consequential calls, redact activity payloads, and enforce connector-level destination/operation policy outside the prompt.

12. **The app↔runner seam is conceptually right but mechanically fragile.**

    The contract is manually mirrored, unversioned, and parsed through unchecked `JSON.parse<T>`. The app even types a resolved `{apiKey}` wire object as domain `CoworkModelConfig`, which officially contains only `apiKeyRef`. See [`env.ts`](/Users/cez/P/cortex-frontend/cowork-runner/src/env.ts:1) and [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:164).

    **Risk:** Shape drift silently falls back to defaults, potentially changing model or sandbox behavior. Large prompts travel through argv and connector/secret payloads through environment variables, both subject to OS size limits.

    **Direction:** Keep the standalone process, but define a versioned resolved wire protocol with runtime validation on both sides. Prefer stdin or a private IPC channel for the turn envelope and secret material.

13. **The bottleneck at scale is process/disk churn, not department matching.**

    Branch matching is adequate at 50 projects and 100 departments. The expensive path is rescanning every skill source, copying entire packages into each session, spawning Flue per turn, starting a container per harness, retaining sessions forever, and loading complete artifacts into memory for download. See [`skills-catalog.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/skills-catalog.ts:36), [`sandbox-store.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/sandbox-store.ts:89), and [`chat-engine.ts`](/Users/cez/P/cortex-frontend/app/idp/features/cortex-cowork/server/chat-engine.ts:263).

    **Risk:** Concurrent sessions produce process storms, Docker startup latency, disk exhaustion, I/O contention, and unbounded session JSON growth.

    **Direction:** Cache/version scanned skill packages, use immutable package snapshots or copy-on-write storage, add session/artifact quotas and retention, stream downloads, and put turns behind a bounded worker queue. Container pooling should come only after measuring startup cost.

14. **Layering is mostly clean, with a few prototype shortcuts.**

    UI code does not reach into server internals, and most routes are thin. However, the config catalog route imports cowork feature server code, project validation imports a persistence-layer type, and session storage imports its data directory from the governance store. The stderr marker protocol plus server fallback plus browser fallback is more machinery than the persistence/idempotency layer can safely support.

    **Direction:** Extract a small server-only catalog/service layer and a protocol package. Keep routes as adapters. Simplify to one authoritative turn lifecycle before adding more recovery paths.

### Low

15. **The department “tree” is a path convention rather than a validated tree.**

    Parent nodes need not exist, implicit resource departments are mixed with explicit departments, and path depth/total length is unbounded. See [`cortex-cowork.ts`](/Users/cez/P/cortex-frontend/libs/@cortex/types/src/cortex-cowork.ts:29) and [`store.ts`](/Users/cez/P/cortex-frontend/app/idp/lib/cortex-governance/store.ts:280).

    This is acceptable at 100 departments, but deeply nested or missing-parent paths will render oddly and make deletion semantics unclear. Normalize ancestor paths and define whether deleting a department is forbidden, cascading, or leaves a tombstone.

## Abstraction altitude

The design is pitched correctly at the domain level: project composition, role-as-access-gate, secret references, copied skill capabilities, and a single provider seam are all durable abstractions.

The shallow parts are raw string references without integrity, JSON files pretending to be concurrent stores, and an env contract without validation. The unnecessarily deep part is recovery: runner retry, deterministic server fallback, client SSE fallback, stderr event framing, and orphan reaping form several interacting mechanisms without an idempotent turn model underneath them.

## Top 3 things to fix first

1. Enforce authenticated identity, project access, and session ownership on every cowork endpoint; make bootstrap fail closed.
2. Make execution and credential isolation real: production Docker-only, minimal runner/CLI environments, and fail-closed credential resolution.
3. Introduce transactional, idempotent turn/session persistence with governance revision checks so retries and revocations are safe.

## Top 3 things NOT to change

1. Do not merge roles and resource composition. Role-as-access-gate and project-as-toolkit is the right model.
2. Do not replace the copied-skill capability boundary; add versioning and revocation around it.
3. Do not collapse the model-provider seam or standalone runner back into Next.js. Strengthen their protocol and lifecycle instead.
