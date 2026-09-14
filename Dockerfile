FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy or build-time defaults for static generation
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy assets if present
COPY --from=builder --chown=nextjs:nodejs /app/assets ./assets
# Copy flag-icons package for runtime file system reading by country and flag routes
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/flag-icons ./node_modules/flag-icons

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
