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
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# The build PRERENDERS ~980 data routes, so it needs the API. Supplied by
# docker-compose.prod.yml's web.build.args; the default keeps a bare `docker build` working
# against a locally running API.
ARG API_BASE_URL=http://127.0.0.1:3001
ENV API_BASE_URL=${API_BASE_URL}
# INTERNAL_REQUEST_TOKEN is deliberately NOT an ARG: build args land in image history. It is
# mounted as a BuildKit secret for the duration of this one command and is not in any layer.
RUN --mount=type=secret,id=internal_request_token \
    INTERNAL_REQUEST_TOKEN="$(cat /run/secrets/internal_request_token)" pnpm build

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
