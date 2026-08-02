FROM node:22-alpine AS base

# `packageManager` w package.json (pnpm@10.32.1) pozwala corepackowi dobrać
# dokładnie tę wersję przy pierwszym użyciu `pnpm` w dowolnym etapie niżej —
# enable tutaj, raz, w wspólnym przodku wszystkich stage'ów.
RUN corepack enable

FROM base AS deps
WORKDIR /app
# Cały workspace potrzebny PRZED `pnpm install` — pnpm rozwiązuje zależności
# między pakietami @cortex/* z ich package.json, nie tylko z korzenia.
# Kopiowanie całego `packages/` (nie tylko plików package.json) jest prostsze
# i bezpieczniejsze niż selektywne COPY per-pakiet (Docker COPY z globem typu
# `packages/@cortex/*/package.json` spłaszczyłoby wszystkie do jednego pliku
# w katalogu docelowym — kolizja nazw) kosztem nieco grubszego cache'a: zmiana
# w źródle @cortex/* unieważnia tę warstwę, nie tylko zmiana zależności.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# cowork-runner is a standalone Flue project (spawned as a subprocess per
# chat turn, not bundled into the Next.js build) with its own lockfile.
# --ignore-scripts: sharp's postinstall would otherwise attempt a source
# build; the platform-matched prebuilt binary resolves via its own
# optionalDependencies regardless.
FROM base AS cowork-runner-deps
WORKDIR /app/cowork-runner
COPY cowork-runner/package.json cowork-runner/package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS builder
WORKDIR /app
# Całe /app z `deps`, nie tylko korzeniowy node_modules: pnpm tworzy symlinki
# node_modules WEWNĄTRZ każdego pakietu (packages/@cortex/*/node_modules ->
# ../../../node_modules/.pnpm/...), więc samo skopiowanie korzenia zerwałoby
# rozwiązywanie zależności per-pakiet. `.dockerignore` wyklucza node_modules
# z kontekstu builda, więc kolejny COPY (pełne źródło) niczego tu nie nadpisze.
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG VERSION=dev
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_SHELL_VERSION=$VERSION
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN pnpm run build

# Generuje packages/@cortex/db/scripts/tile-manifests.generated.json z
# app/idp/lib/tile-manifests.ts (barrel statycznie zbierający wszystkie
# manifest.ts). Musi jechać TU, nie w kroku `migrate`: ten etap ma pełny
# toolchain TS (i tak potrzebny do `next build` wyżej) oraz dostęp do plików
# manifest.ts spod app/idp/app/(main)/** — etap `runner` niżej nie ma ani
# jednego, ani drugiego (patrz komentarz przy COPY .../scripts niżej i
# PROJECT/cortex-frontend-hub-db-driven-projekt.md D10-rewizja c).
RUN node scripts/generate-tile-manifests.mjs

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# demo/bin/*.py CLI connectors are `uv run --script` (PEP 723 inline deps).
# BusyBox's env applet doesn't support `-S` (verified: shebang exec fails
# with "env: unrecognized option: S"), so their `#!/usr/bin/env -S uv run
# --script` shebang needs GNU coreutils' env instead. uv itself is a single
# static binary - the astral-sh image is the documented way to add it to a
# foreign base image without needing pip/python preinstalled.
#
# fontconfig: wymagane przez renderowanie tekstu w `sharp` (pangocairo), z
# którego korzysta Ilustromat. Bez tego pakietu sharp wypisuje przy KAŻDYM
# renderze "Fontconfig error: Cannot load default config file", a — co
# ważniejsze — metryki tekstu się rozjeżdżają: ten sam render dał 626x53 bez
# fontconfiga i 626x54 z nim (zweryfikowane w node:22-alpine). To nie jest
# kosmetyka logów, tylko determinizm składu: obraz Dockera jest referencją
# renderu, maszyna dewelopera nie.
RUN apk add --no-cache coreutils fontconfig
COPY --from=ghcr.io/astral-sh/uv:0.11.30 /uv /uvx /usr/local/bin/

# /app/app/idp/.data/* backs cortex-cowork (governance/sessions/credentials)
# and okna-czasowe (film-tracking store) - see app/idp/lib/data-dir.ts.
RUN mkdir -p /data/ai-tools-history \
      /app/app/idp/.data/cortex-cowork \
      /app/app/idp/.data/okna-czasowe && \
    chown -R nextjs:nodejs /data /app/app

# Next 15 standalone output, monorepo layout (outputFileTracingRoot=repoRoot).
# Entry point is app/idp/server.js; static + public scoped under app/idp/.
COPY --from=builder --chown=nextjs:nodejs /app/app/idp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/app/idp/.next/static ./app/idp/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/app/idp/public ./app/idp/public

# cowork-runner: standalone Flue project spawned per chat turn (see
# app/idp/features/cortex-cowork/server/chat-engine.ts, runnerDir()) - not
# part of the Next.js build/bundle, so it needs its own explicit copy.
COPY --from=cowork-runner-deps --chown=nextjs:nodejs /app/cowork-runner/node_modules ./cowork-runner/node_modules
COPY --chown=nextjs:nodejs cowork-runner/package.json cowork-runner/flue.config.ts ./cowork-runner/
COPY --chown=nextjs:nodejs cowork-runner/src ./cowork-runner/src

# Migracje i seedy to KROK DEPLOYU uruchamiany z tego obrazu (usługa `migrate`
# w docker-compose.yml / docker-compose.image.yml), nie część startu serwera.
# Standalone output ich nie wciąga, bo nie importuje ich żaden kod aplikacji:
# potrzebne są skrypty .mjs oraz pliki migracji SQL wraz z meta/_journal.json.
#
# `drizzle-orm`/`postgres` NIE trafiają do /app/node_modules przez tracing
# Next.js — zweryfikowane realnym `docker run` + `node migrate.mjs`:
# ERR_MODULE_NOT_FOUND na drizzle-orm, mimo że deps-stage ma je poprawnie
# zainstalowane (tracer podąża tylko za importami faktycznie użytymi przez
# route'y/strony, a te skrypty nie są importowane przez żaden kod appki —
# wcześniejszy komentarz zakładał inaczej, bez sprawdzenia w kontenerze).
# Osobny, minimalny install tych dwóch pakietów w runtime, niezależny od
# tracingu — drizzle-kit (devDependency @cortex/db) nie jest tu potrzebny,
# migrate.mjs woła migrator z samego drizzle-orm.
COPY --from=builder --chown=nextjs:nodejs /app/packages/@cortex/db/drizzle ./packages/@cortex/db/drizzle
# Z ETAPU `builder`, NIE z kontekstu builda: `builder` dopisał tu
# tile-manifests.generated.json (RUN node scripts/generate-tile-manifests.mjs
# wyżej) — kopiowanie z kontekstu (jak poprzednio) zostawiłoby ten artefakt
# wyłącznie w etapie builder, nigdy nie docierając do obrazu, który faktycznie
# startuje `migrate` (PROJECT/cortex-frontend-hub-db-driven-projekt.md
# D10-rewizja c).
COPY --from=builder --chown=nextjs:nodejs /app/packages/@cortex/db/scripts ./packages/@cortex/db/scripts
RUN pnpm add --prod drizzle-orm@^0.36.0 postgres@^3.4.0

# Skill/connector assets read from disk at runtime (SKILL.md + CLI scripts),
# not imported by app code, so Next's standalone output tracing misses them.
COPY --chown=nextjs:nodejs app/idp/features/cortex-cowork/skills ./app/idp/features/cortex-cowork/skills
COPY --chown=nextjs:nodejs demo ./demo
COPY --chown=nextjs:nodejs scripts ./scripts

USER nextjs
EXPOSE 80
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV AI_TOOLS_HISTORY_DIR=/data/ai-tools-history
# runnerDir() in chat-engine.ts defaults to `${process.cwd()}/cowork-runner`,
# assuming cwd is the WORKDIR (/app). Verified empirically: Next's generated
# standalone server.js chdir()s to its own directory at startup, so the
# running server's actual process.cwd() is /app/app/idp, not /app - the
# unqualified default would look for a nonexistent /app/app/idp/cowork-runner
# and fail (spawn ENOENT, misleadingly blamed on the "node" command rather
# than the missing cwd). Point it at the real copy explicitly instead of
# relying on a cwd assumption that doesn't hold for this standalone layout.
ENV COWORK_RUNNER_DIR=/app/cowork-runner
# Belt-and-suspenders alongside the app-code fix in lib/data-dir.ts: state
# explicitly instead of relying on any cwd-detection heuristic at all, since
# this app's own "idp" route segment can fool existsSync-based checks (see
# data-dir.ts comment - a live deploy actually hit this and split cowork's
# governance/sessions/skills-catalog across two different directories).
ENV COWORK_DATA_DIR=/app/app/idp/.data/cortex-cowork
ENV COWORK_BUILTIN_SKILLS_DIR=/app/app/idp/features/cortex-cowork/skills
ENV OKNA_CZASOWE_DATA_DIR=/app/app/idp/.data/okna-czasowe

CMD ["node", "app/idp/server.js"]
