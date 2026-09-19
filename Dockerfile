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
# docker-compose.prod.yml's web.build.args, alongside `network: host` on the same build block.
# The default is for `docker build --network host` against a locally running API, and ONLY for
# that: under BuildKit's default RUN network the build step gets its own bridge namespace, so
# `127.0.0.1:3001` there is the build container's own loopback and reaches nothing. A bare
# `docker build` with no `--network host` therefore does NOT work against a local API on this
# default — measured while choosing the network mechanism, and the reason every recorded build
# invocation for this image passes `--network host`.
# Deliberate, considered-and-kept default (not overlooked): with `--network host` it resolves
# to the host's own API, and a wrong/absent API at :3001 is NOT a silent failure mode — the
# prerender floor guard below (scripts/assert-prerender-floor.mjs, chained into `pnpm build`)
# fails loud on every route family that comes up short, and for that guard to miss a wrong API,
# the wrong service on :3001 would have to return well-formed data for ~980 distinct routes,
# which does not happen by accident. Removing the default, or poisoning it with a fail-fast
# placeholder, would only lengthen the documented `--network host` invocation without closing
# a failure mode the guard leaves open.
ARG API_BASE_URL=http://127.0.0.1:3001
ENV API_BASE_URL=${API_BASE_URL}
# INTERNAL_REQUEST_TOKEN is deliberately NOT an ARG: build args land in image history. It is
# mounted as a BuildKit secret for the duration of this one command and is not in any layer.
# required=true: without it, a missing secret is not an error at this RUN — the mounted file
# simply doesn't exist, `cat` fails, but `VAR="$(cat …)" pnpm build` takes its exit status
# from `pnpm build`, not `cat`, so the token silently becomes "". The build still fails, but
# two hops downstream and misleadingly: z.string().min(32).optional() treats "" as
# present-but-invalid rather than absent, so the error names zod instead of the missing
# secret. This matters beyond diagnostics: docker-compose.prod.yml lives outside every git
# repo in this workspace, so wiring it in is a manual, uncatchable-by-CI step — required=true
# means a compose file missing the `secrets:` entry now fails immediately with BuildKit
# naming the missing secret by id, matching how a compose file missing `network: host` or
# `args.API_BASE_URL` already fails loudly via this guard's FAIL rows. Every path where the
# host's compose file was not updated now fails loudly and by name.
RUN --mount=type=secret,id=internal_request_token,required=true \
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
