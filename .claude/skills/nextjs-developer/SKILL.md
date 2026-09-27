---
name: nextjs-developer
description: "Use when building Next.js 16 applications with App Router, server components, or BFF mutations. Invoke to configure route handlers, implement proxy.ts, set up API routes, add streaming SSR, write generateMetadata for SEO, scaffold Suspense/error.tsx boundaries, or deploy the self-hosted Docker build. Triggers on: Next.js, Next.js 16, App Router, RSC, use server, Server Components, Server Actions, React Server Components, generateMetadata, loading.tsx, Next.js deployment, Docker, Next.js performance."
license: MIT
metadata:
  author: https://github.com/Jeffallan
  version: "1.1.0"
  domain: frontend
  triggers: Next.js, Next.js 16, App Router, Server Components, Server Actions, React Server Components, Next.js deployment, Docker, Next.js performance
  role: specialist
  scope: implementation
  output-format: code
  related-skills: typescript-pro
---

# Next.js Developer

Senior Next.js developer with expertise in Next.js 16 App Router, server components, and self-hosted Docker deployment with focus on performance and SEO excellence.

## Core Workflow

1. **Architecture planning** — Define app structure, routes, layouts, rendering strategy
2. **Implement routing** — Create App Router structure with layouts, templates, loading/error states
3. **Data layer** — Set up server components, data fetching, caching, revalidation
4. **Optimize** — Images, fonts, bundles, streaming, edge runtime
5. **Deploy** — Production build, environment setup, monitoring
   - Validate: run `pnpm typecheck && pnpm lint && pnpm test`; run `pnpm build` (stop `cografya-web-dev` first; needs the API on :3001) when routing/SEO/config changed; check `NEXT_PUBLIC_*` vars are Docker build ARGs and server-only env vars are set; run Lighthouse/PageSpeed to confirm Core Web Vitals > 90

## Reference Guide

Load detailed guidance based on context:

| Topic             | Reference                         | Load When                                            |
| ----------------- | --------------------------------- | ---------------------------------------------------- |
| App Router        | `references/app-router.md`        | File-based routing, layouts, templates, route groups |
| Server Components | `references/server-components.md` | RSC patterns, streaming, client boundaries           |
| Mutations (BFF)   | `references/server-actions.md`    | Form handling, mutations, revalidation               |
| Data Fetching     | `references/data-fetching.md`     | `apiGet`, caching, ISR, on-demand revalidation       |
| Deployment        | `references/deployment.md`        | Self-hosting, Docker, optimization                   |

## Constraints

### MUST DO (Next.js-specific)

- Use App Router (`app/` directory), never Pages Router (`pages/`)
- Keep components as Server Components by default; add `'use client'` only at the leaf boundary where interactivity is required
- Read the API only through `apiGet` from `lib/api/client.ts` (pass `revalidate`; the default is 3600 s); mutations and authenticated reads go through a `transport.server.ts` fetch with `cache: "no-store"` — do not rely on implicit caching
- Use `generateMetadata` returning `buildMetadata()` (or the static `metadata` export) for all SEO — never hardcode `<title>` or `<meta>` tags in JSX
- Optimize every content image with `next/image`; a plain `<img>` only where an `eslint-disable` comment records why
- Await at page top level only what decides `notFound()`/`redirect()`; render every other async server fetch behind `<Suspense>` with a `components/patterns/page-skeleton.tsx` fallback; add `loading.tsx` only to a `force-dynamic` leaf route that calls neither `notFound()` nor `redirect()` first; `error.tsx` lives per route group

### MUST NOT DO

- Convert components to Client Components just to access data — fetch server-side first
- Render an async section without its `<Suspense>` + `page-skeleton` fallback, or put a `loading.tsx` above a route that calls `notFound()`
- Call routing, SEO or config work done without a green `pnpm build`

## Code Examples

### Server Component with data fetching and caching

```tsx
// app/[locale]/(site)/turkiye/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { apiGet } from "@/lib/api/client";
import type { ProvinceListItem } from "@/lib/api/types";

async function ProvinceList() {
  // Revalidate every 60 seconds (ISR); apiGet throws ApiError when the response is not ok
  const provinces = await apiGet<ProvinceListItem[]>("/api/provinces", { revalidate: 60 });

  return (
    <ul>
      {provinces.map((p) => (
        <li key={p.plateCode}>{p.nameTr}</li>
      ))}
    </ul>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<CardGridSkeleton columns="3" count={6} />}>
      <ProvinceList />
    </Suspense>
  );
}
```

### BFF mutation with form handling and refresh

```tsx
// app/api/products/route.ts
import { NextResponse } from "next/server";
import { handleCreateProduct } from "@/lib/products/transport.server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  // Same-origin check, bounded body, zod, `cache: "no-store"` fetch to the API
  const result = await handleCreateProduct(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

// components/v2/v2-new-product-form.tsx
("use client");

import { useRouter } from "@/i18n/navigation";
import { createProduct } from "@/lib/products/client";

export function V2NewProductForm() {
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name"));
    const result = await createProduct({ name }); // fetch("/api/products", { method: "POST" })
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Ürün adı" required />
      <button type="submit">Oluştur</button>
    </form>
  );
}
```

### generateMetadata for dynamic SEO

```tsx
// app/[locale]/(site)/kitaplar/[slug]/page.tsx
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getBookBySlug } from "@/lib/api/books";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return {};
  return buildMetadata({
    locale,
    hrefForLocale: (l) => ({
      pathname: "/kitaplar/[slug]",
      params: { slug: l === "en" ? book.slugEn : book.slugTr },
    }),
    title: book.metaTitleTr,
    description: book.metaDescriptionTr,
    openGraphType: "article",
    surface: "trOnly",
  });
}
```

## Output Templates

When implementing Next.js features, provide:

1. App structure (route organization)
2. Layout/page components with proper data fetching
3. BFF route, `transport.server.ts` and `client.ts` if mutations needed
4. Configuration (`next.config.ts`, TypeScript)
5. Brief explanation of rendering strategy chosen

## Knowledge Reference

Next.js 16, App Router, React Server Components, BFF route-handler mutations, Streaming SSR, Partial Prerendering (`cacheComponents`), next/image, next/font, Metadata API, Route Handlers, Proxy (`proxy.ts`), Edge Runtime, Turbopack, standalone Docker deployment

[Documentation](https://jeffallan.github.io/claude-skills/skills/frontend/nextjs-developer/)
