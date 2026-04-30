FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
RUN NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN \
    NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID \
    npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next 15 standalone output, monorepo layout (outputFileTracingRoot=repoRoot).
# Entry point is app/idp/server.js; static + public scoped under app/idp/.
COPY --from=builder --chown=nextjs:nodejs /app/app/idp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/app/idp/.next/static ./app/idp/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/app/idp/public ./app/idp/public

USER nextjs
EXPOSE 80
ENV PORT=80
ENV HOSTNAME=0.0.0.0

CMD ["node", "app/idp/server.js"]
