FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

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
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG VERSION=dev
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_SHELL_VERSION=$VERSION
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN npm run build

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
RUN apk add --no-cache coreutils
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

CMD ["node", "app/idp/server.js"]
