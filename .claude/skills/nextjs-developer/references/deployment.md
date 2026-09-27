# Deployment & Production

## Environment Setup

### Environment Variables

```bash
# .env.local (not committed; .env.example is the committed template)
API_BASE_URL="http://localhost:3001"
INTERNAL_REQUEST_TOKEN="<at least 32 visible ASCII characters>"

# Public vars are inlined at build time: in Docker they are build ARGs
NEXT_PUBLIC_SITE_URL="https://example.com"
```

```tsx
// Access in Server Components (server-only, zod-validated)
import { serverEnv } from "@/lib/env.server";
const apiBaseUrl = serverEnv.API_BASE_URL;

// Access in Client Components (must be prefixed with NEXT_PUBLIC_)
import { env } from "@/lib/env";
const siteUrl = env.NEXT_PUBLIC_SITE_URL;
```

## Self-Hosting

### Standalone Output

```ts
// next.config.ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withNextIntl(nextConfig);
```

```bash
# Build
pnpm build

# The standalone folder contains everything needed
# Copy these to your server:
# - .next/standalone/
# - .next/static/
# - public/
# - assets/
# - node_modules/flag-icons/

# Run on server
node .next/standalone/server.js
```

### Node.js Server

```bash
# Build
pnpm build

# Start production server
pnpm start

# With Docker for process management (restart: unless-stopped)
docker compose -f docker-compose.prod.yml up -d --no-deps web
docker compose -f docker-compose.prod.yml ps web
```

## Docker Deployment

### Dockerfile (Multi-stage)

```dockerfile
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
RUN apk add --no-cache libc6-compat

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG API_BASE_URL=http://127.0.0.1:3001
ENV API_BASE_URL=${API_BASE_URL}
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN --mount=type=secret,id=internal_request_token,required=true \
    : "${NEXT_PUBLIC_SITE_URL:?build arg NEXT_PUBLIC_SITE_URL is required}" && \
    INTERNAL_REQUEST_TOKEN="$(cat /run/secrets/internal_request_token)" pnpm build

# Stage 3: Runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/assets ./assets
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/flag-icons ./node_modules/flag-icons

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### docker-compose.prod.yml

```yaml
services:
  web:
    build:
      context: ./cografya_web
      dockerfile: Dockerfile
      network: host
      args:
        API_BASE_URL: http://127.0.0.1:3001
        NEXT_PUBLIC_SITE_URL: https://example.com
      secrets:
        - internal_request_token
    ports:
      - "3000:3000"
    environment:
      - API_BASE_URL=<api URL reachable from the web container>
      - INTERNAL_REQUEST_TOKEN=${INTERNAL_REQUEST_TOKEN}
    depends_on:
      - api
    restart: unless-stopped

  api:
    # built from cografya_api; published on loopback only
    ports:
      - "127.0.0.1:3001:3001"
    restart: unless-stopped

secrets:
  internal_request_token:
    environment: INTERNAL_REQUEST_TOKEN
```

```bash
# Build and run
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web

# View logs
docker compose -f docker-compose.prod.yml logs -f web

# Rebuild
docker compose -f docker-compose.prod.yml up -d --build --no-deps web
```

## Production Optimization

### next.config.ts

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Standalone for self-hosting
  output: "standalone",

  // Image optimization (no `remotePatterns`, by policy)
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },

  // Compression
  compress: true,

  // Permanent redirects
  async redirects() {
    return [
      {
        source: "/profil",
        destination: "/hesabim/ayarlar",
        permanent: true,
      },
      {
        source: "/en/profile",
        destination: "/en/account/settings",
        permanent: true,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ["@mui/material", "lodash"],
  },
};

export default withNextIntl(nextConfig);
```

### Bundle Analysis

```bash
# Analyze (Turbopack; interactive UI, no application build)
pnpm exec next experimental-analyze

# Or analyze during a build
pnpm exec next build --experimental-analyze
```

### Performance Monitoring

```tsx
// components/web-vitals.tsx
"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    navigator.sendBeacon("/api/vitals", JSON.stringify(metric));
  });
  return null;
}

// app/[locale]/layout.tsx
import { WebVitals } from "@/components/web-vitals";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <html lang={locale}>
      <body>
        {children}
        <WebVitals />
      </body>
    </html>
  );
}

// app/api/vitals/route.ts
export async function POST(request: Request) {
  if (!isSameOrigin(request, getSiteUrl())) return new Response(null, { status: 403 });
  const read = await readBoundedBodyAsText(request, 2_048);
  if (read.ok) console.log("[vitals]", read.text);
  return new Response(null, { status: 204 });
}
```

## CDN & Edge

### Static Asset CDN

```ts
// next.config.ts
const nextConfig: NextConfig = {
  assetPrefix: process.env.NODE_ENV === "production" ? "https://cdn.example.com" : "",
};
```

### Edge Runtime

```tsx
// app/api/edge/route.ts
export const runtime = "edge";

export async function GET(request: Request) {
  return new Response("Hello from Edge!", {
    status: 200,
    headers: {
      "content-type": "text/plain",
    },
  });
}

// app/[locale]/(site)/page.tsx
export const runtime = "edge";

export default async function Page() {
  return <div>Edge-rendered page</div>;
}
```

## Caching Strategy

### ISR (Incremental Static Regeneration)

```tsx
// app/[locale]/(site)/blog/[slug]/page.tsx
export const revalidate = 3600; // Revalidate every hour

export default async function BlogPost({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await fetchPost(slug);
  return <article>{post.content}</article>;
}
```

### On-Demand Revalidation

```tsx
// app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ message: "Invalid secret" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path") || "/";

  revalidatePath(path);

  return Response.json({ revalidated: true, now: Date.now() });
}
```

## API Client (Database Access)

```ts
// lib/api/client.ts (the web holds no database connection; the API owns the pool)
import "server-only";
import { serverEnv } from "@/lib/env.server";
import { buildApiRequestHeaders } from "./internal-token";

const API_REQUEST_TIMEOUT_MS = 15_000;

export async function apiGet<T>(path: string, options: { revalidate?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${serverEnv.API_BASE_URL}${path}`, {
      headers: buildApiRequestHeaders(serverEnv.INTERNAL_REQUEST_TOKEN),
      signal: controller.signal,
      next: { revalidate: options.revalidate ?? CONTENT_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new ApiError(res.status, `API GET ${path} failed with status ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
```

## Health Check Endpoint

```tsx
// app/api/health/route.ts
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check the API connection (the web has no database of its own)
    const res = await fetch(`${serverEnv.API_BASE_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`API health ${res.status}`);

    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: "API connection failed",
      },
      { status: 503 },
    );
  }
}
```

## CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy Web

on:
  push:
    branches: [main]

jobs:
  ci-gate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v7

      - name: Install pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck, lint and drift checks
        run: pnpm typecheck && pnpm lint && pnpm codegen:check

      - name: Run tests
        run: pnpm test

  deploy-web:
    needs: [ci-gate]
    runs-on: ubuntu-latest

    steps:
      - name: Deploy via SSH
        env:
          SSH_KEY: ${{ secrets.SERVER_SSH_KEY }}
          HOST: ${{ secrets.SERVER_HOST }}
          USER: ${{ secrets.SERVER_USER }}
        run: |
          mkdir -p ~/.ssh && echo "$SSH_KEY" > ~/.ssh/deploy_key && chmod 600 ~/.ssh/deploy_key
          ssh -o StrictHostKeyChecking=no -i ~/.ssh/deploy_key "$USER@$HOST" << 'EOF'
            set -euo pipefail
            cd /opt/cografya/cografya_web && git fetch origin main && git reset --hard origin/main
            cd /opt/cografya
            docker compose -f docker-compose.prod.yml up -d --no-build --no-deps api
            docker compose -f docker-compose.prod.yml build web
            docker compose -f docker-compose.prod.yml up -d --no-deps web
          EOF
```

## Monitoring & Logging

```tsx
// instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

// Server errors (Server Components, route handlers, proxy)
export const onRequestError = Sentry.captureRequestError;

// instrumentation-client.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });

// app/[locale]/(site)/error.tsx
("use client");

import * as Sentry from "@sentry/nextjs";
import * as React from "react";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        {t("heading")}
      </h2>
      <button onClick={() => reset()}>{t("retry")}</button>
    </div>
  );
}
```

## Quick Reference

| Platform   | Best For                   | Effort |
| ---------- | -------------------------- | ------ |
| **Docker** | Self-hosting, full control | High   |

## Production Checklist

- [ ] Enable TypeScript strict mode
- [ ] Configure CSP headers
- [ ] Setup error monitoring (Sentry)
- [ ] Configure analytics (GA via `NEXT_PUBLIC_GA_ID`)
- [ ] Optimize images (next/image)
- [ ] Enable compression
- [ ] Setup CDN for static assets
- [ ] Configure database connection pooling
- [ ] Add health check endpoint
- [ ] Setup CI/CD pipeline
- [ ] Configure environment variables
- [ ] Enable ISR/SSG where possible
- [ ] Test Core Web Vitals
- [ ] Setup logging (Datadog/LogRocket)
- [ ] Configure backup strategy
