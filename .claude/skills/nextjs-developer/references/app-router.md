# App Router Architecture

## File-Based Routing

```
app/
├── not-found.tsx               # 404 for URLs outside [locale] (no root app/layout.tsx)
├── global-error.tsx            # Error boundary for the root layout
│
├── [locale]/
│   ├── layout.tsx              # Root layout (required)
│   │
│   ├── (site)/                 # Route group (no URL segment)
│   │   ├── layout.tsx          # Header, footer, ONE <main>
│   │   ├── page.tsx            # Home page (/)
│   │   ├── error.tsx           # Error boundary
│   │   ├── not-found.tsx       # 404 page
│   │   ├── template.tsx        # Re-mounted layout
│   │   ├── dashboard/
│   │   │   ├── layout.tsx      # Shared dashboard layout
│   │   │   ├── page.tsx        # /dashboard
│   │   │   ├── settings/
│   │   │   │   └── page.tsx    # /dashboard/settings
│   │   │   └── @analytics/     # Parallel route (slot)
│   │   │       ├── default.tsx # Required fallback for the slot
│   │   │       └── page.tsx
│   │   ├── kayit/
│   │   │   ├── loading.tsx     # Loading UI (force-dynamic leaf only)
│   │   │   └── page.tsx        # /kayit
│   │   └── dunya/
│   │       ├── page.tsx        # /dunya
│   │       └── [slug]/
│   │           └── page.tsx    # /dunya/almanya (dynamic)
│   │
│   └── (play)/                 # Route group: fullscreen game screens
│       ├── layout.tsx
│       └── error.tsx
│
└── api/
    ├── auth/
    │   └── [...action]/
    │       └── route.ts        # /api/auth/a/b/c (catch-all)
    └── profile/
        └── route.ts            # API route handler (BFF)
```

## Root Layout (Required)

```tsx
// app/[locale]/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { fraunces, nunitoSans } from "@/lib/fonts";
import { getSiteUrl, siteConfig } from "@/lib/seo/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${fraunces.variable} ${nunitoSans.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

## Nested Layouts

```tsx
// app/[locale]/(site)/layout.tsx
import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2Footer } from "@/components/v2/v2-footer";

export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <V2Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <V2Footer />
    </div>
  );
}
```

## Templates (Re-mount on Navigation)

```tsx
// app/[locale]/(site)/template.tsx
"use client";

import { useEffect } from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Runs on every navigation
    console.log("Template mounted");
  }, []);

  return <div>{children}</div>;
}
```

## Loading States

```tsx
// app/[locale]/(site)/kayit/loading.tsx
import { PageSkeleton } from "@/components/patterns/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="auth" />;
}
```

## Error Boundaries

```tsx
// app/[locale]/(site)/error.tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

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

## Route Groups

```tsx
// (site) and (play) share the same URL level
app/[locale]/
├── (site)/
│   ├── layout.tsx      # Reading layout (header, footer, <main>)
│   └── hakkimizda/
│       └── page.tsx    # /hakkimizda
└── (play)/
    ├── layout.tsx      # Fullscreen game layout
    └── oyun/
        └── 81-il/
            └── page.tsx    # /oyun/81-il
```

## Parallel Routes

```tsx
// app/[locale]/(site)/dashboard/layout.tsx
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <>
      {children}
      {analytics}
      {team}
    </>
  );
}

// app/[locale]/(site)/dashboard/@analytics/page.tsx
export default function Analytics() {
  return <div>Analytics Dashboard</div>;
}

// app/[locale]/(site)/dashboard/@analytics/default.tsx (required for every slot in Next 16)
export default function Default() {
  return null;
}
```

## Intercepting Routes

```tsx
// Show modal when navigating from same app
// but show full page on direct navigation

// app/[locale]/(site)/photos/[id]/page.tsx (full page)
export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Photo {id} - Full Page</div>;
}

// app/[locale]/(site)/@modal/(.)photos/[id]/page.tsx (modal)
export default async function PhotoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>Photo {id} - Modal</div>;
}

// app/[locale]/(site)/@modal/default.tsx (required for every slot in Next 16)
export default function Default() {
  return null;
}
```

## Dynamic Routes

```tsx
// app/[locale]/(site)/dunya/[slug]/page.tsx
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getCountriesResilient } from "@/lib/api/countries";

export default async function CountryPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <h1>Ülke: {slug}</h1>;
}

// Generate static params at build time
export async function generateStaticParams() {
  const countries = await getCountriesResilient();

  return routing.locales.flatMap((locale) =>
    countries.map((country) => ({
      locale,
      slug: locale === "en" ? country.slugEn : country.slugTr,
    })),
  );
}

// Opt out of static generation
export const dynamic = "force-dynamic";

// Revalidate every 60 seconds
export const revalidate = 60;
```

## Catch-All Routes

```tsx
// app/[locale]/(site)/docs/[...slug]/page.tsx
// Matches: /docs/a, /docs/a/b, /docs/a/b/c
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

export default async function Docs({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <div>Docs: {slug.join("/")}</div>;
}

// Optional catch-all: [[...slug]]
// Also matches: /docs
```

## Route Handlers (API Routes)

```tsx
// app/api/measurements/route.ts
import { NextResponse } from "next/server";
import {
  handleCreateMeasurement,
  handleListMeasurements,
} from "@/lib/measurements/transport.server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await handleListMeasurements(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export async function POST(request: Request) {
  const result = await handleCreateMeasurement(request);
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

// Dynamic routes: app/api/measurements/[id]/route.ts (imports handleDeleteMeasurement)
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await handleDeleteMeasurement(request, id);
  if (result.status === 204)
    return new NextResponse(null, { status: 204, headers: result.headers });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}
```

## Metadata API

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
    openGraphType: "article", // openGraph + twitter built from title/description
    surface: "trOnly",
  });
}
```

## Quick Reference

| File            | Purpose                     | Use Case                                        |
| --------------- | --------------------------- | ----------------------------------------------- |
| `layout.tsx`    | Persistent UI across routes | Shared navigation, providers                    |
| `page.tsx`      | Route UI                    | Actual page content                             |
| `loading.tsx`   | Loading fallback            | Automatic Suspense boundary                     |
| `error.tsx`     | Error boundary              | Handle errors gracefully                        |
| `template.tsx`  | Re-mounted layout           | Analytics, animations                           |
| `not-found.tsx` | 404 page                    | Custom not found UI                             |
| `route.ts`      | BFF handler                 | Delegates to `lib/<domain>/transport.server.ts` |
