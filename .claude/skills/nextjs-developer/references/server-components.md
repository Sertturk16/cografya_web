# React Server Components

## Server Components (Default)

```tsx
// app/[locale]/(site)/turkiye/page.tsx - Server Component by default
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { getProvinces } from "@/lib/api/provinces";

async function ProvinceList() {
  // Data fetching in Server Component
  const provinces = await getProvinces();

  return (
    <ul>
      {provinces.map((province) => (
        <li key={province.plateCode}>{province.nameTr}</li>
      ))}
    </ul>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      <h1>İller</h1>
      <Suspense fallback={<CardGridSkeleton columns="3" count={6} />}>
        <ProvinceList />
      </Suspense>
    </div>
  );
}
```

## Benefits of Server Components

- **Zero bundle size** - Server Components don't add JavaScript to client bundle
- **Direct backend access** - Call the API through `apiGet`, read files, use secrets
- **Automatic code splitting** - Only Client Components add to bundle
- **Streaming** - Send UI progressively as data loads
- **No client-side waterfalls** - Fetch all data in parallel on server

## Client Components

```tsx
// components/counter.tsx
"use client"; // Required directive

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

## When to Use Client Components

Use `'use client'` when you need:

- **Interactivity** - onClick, onChange, event handlers
- **State** - useState, useReducer
- **Effects** - useEffect, useLayoutEffect
- **Browser APIs** - localStorage, window, document
- **Custom hooks** - Any hook using client-only features
- **Class components** - Component lifecycle methods

## Composition Pattern

```tsx
// app/[locale]/(site)/page.tsx - Server Component
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { ClientWrapper } from "@/components/v2/v2-client-wrapper";
import { getProvinces } from "@/lib/api/provinces";

async function ProvinceSection() {
  const data = await getProvinces();

  return (
    <ClientWrapper initialData={data}>
      {/* Server Component as children */}
      <ServerSidebar />
    </ClientWrapper>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      {/* Server Component content */}
      <h1>Server Content</h1>

      {/* Pass data to Client Component */}
      <Suspense fallback={<CardGridSkeleton columns="3" count={6} />}>
        <ProvinceSection />
      </Suspense>
    </div>
  );
}

// components/v2/v2-client-wrapper.tsx
("use client");

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { ProvinceListItem } from "@/lib/api/types";

export function ClientWrapper({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData: ProvinceListItem[];
}) {
  const [data] = useState(initialData);
  const router = useRouter();

  return (
    <div>
      {/* Client Component UI */}
      <p>{data.length}</p>
      <button onClick={() => router.refresh()}>Yenile</button>
      {/* Server Component children */}
      {children}
    </div>
  );
}
```

## Streaming with Suspense

```tsx
// app/[locale]/(site)/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { ProseSkeleton } from "@/components/patterns/page-skeleton";
import { SlowComponent } from "@/components/v2/v2-slow-component";
import { FastComponent } from "@/components/v2/v2-fast-component";

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      {/* Renders immediately */}
      <FastComponent />

      {/* Shows fallback while loading */}
      <Suspense fallback={<ProseSkeleton lines={4} />}>
        <SlowComponent />
      </Suspense>
    </div>
  );
}

// components/v2/v2-slow-component.tsx
async function getData() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { data: "Loaded!" };
}

export async function SlowComponent() {
  const data = await getData();
  return <div>{data.data}</div>;
}
```

## Parallel Data Fetching

```tsx
// app/[locale]/(site)/hesabim/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CardGridSkeleton } from "@/components/patterns/page-skeleton";
import { getCountriesResilient } from "@/lib/api/countries";
import { getProvincesResilient } from "@/lib/api/provinces";

async function DashboardSection() {
  // Fetch in parallel
  const [provinces, countries] = await Promise.all([
    getProvincesResilient(),
    getCountriesResilient(),
  ]);

  return (
    <div>
      <ProvinceList provinces={provinces} />
      <CountryList countries={countries} />
    </div>
  );
}

export default async function Dashboard({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<CardGridSkeleton columns="2" count={4} />}>
      <DashboardSection />
    </Suspense>
  );
}
```

## Sequential Data Fetching

```tsx
// app/[locale]/(site)/artist/[id]/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { apiGet } from "@/lib/api/client";

async function getArtist(id: string) {
  return apiGet<Artist>(`/api/artists/${id}`);
}

async function getAlbums(artistId: string) {
  return apiGet<Album[]>(`/api/artists/${artistId}/albums`);
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  // Sequential: albums depends on artist
  const artist = await getArtist(id);
  const albums = await getAlbums(artist.id);

  return (
    <div>
      <h1>{artist.name}</h1>
      <Albums albums={albums} />
    </div>
  );
}
```

## Preloading Data

```tsx
// lib/api/users.ts
import "server-only";
import { cache } from "react";
import { apiGet } from "./client";

export const getUser = cache(async (id: string) => {
  return apiGet<User>(`/api/users/${id}`);
});

// components/v2/v2-user-profile.tsx
export async function UserProfile({ userId }: { userId: string }) {
  const user = await getUser(userId);
  return <div>{user.name}</div>;
}

// app/[locale]/(site)/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getUser } from "@/lib/api/users";
import { UserProfile } from "@/components/v2/v2-user-profile";

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Preload
  getUser("123");

  return (
    <div>
      {/* This will use cached result */}
      <UserProfile userId="123" />
    </div>
  );
}
```

## Server Component Patterns

### Pattern: Layout with Data Fetching

```tsx
// app/[locale]/(site)/layout.tsx
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Common");

  return (
    <div>
      <a href="#main-content">{t("skipToContent")}</a>
      <main id="main-content">{children}</main>
    </div>
  );
}
```

### Pattern: Conditional Client Components

```tsx
// app/[locale]/(site)/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { ClientComponent } from "@/components/v2/v2-client-component";

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await fetchData();

  // Only render Client Component when needed
  if (data.requiresInteractivity) {
    return <ClientComponent data={data} />;
  }

  return <div>{data.content}</div>;
}
```

### Pattern: Server Component with Client Island

```tsx
// app/[locale]/(site)/blog/[slug]/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LikeButton } from "@/components/v2/v2-like-button";

export default async function BlogPost({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPost(slug);

  return (
    <article>
      {/* Server-rendered content */}
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      {/* Client island for interactivity */}
      <LikeButton postId={post.id} initialLikes={post.likes} />
    </article>
  );
}
```

## Context in Server/Client Components

```tsx
// components/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      {children}
    </NextThemesProvider>
  );
}

// app/[locale]/layout.tsx
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## Third-Party Components

```tsx
// components/v2/v2-carousel-wrapper.tsx
"use client";

import { Carousel } from "third-party-carousel";

export function CarouselWrapper({ items }: { items: Item[] }) {
  return <Carousel items={items} />;
}

// app/[locale]/(site)/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { CarouselWrapper } from "@/components/v2/v2-carousel-wrapper";

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const items = await fetchItems();
  return <CarouselWrapper items={items} />;
}
```

## Edge Runtime

```tsx
// app/api/route.ts
export const runtime = "edge";

export async function GET() {
  return new Response("Hello from Edge!");
}

// app/[locale]/(site)/page.tsx
export const runtime = "edge";

export default async function Page() {
  return <div>Edge-rendered page</div>;
}
```

## Quick Reference

| Capability     | Server Component         | Client Component                                          |
| -------------- | ------------------------ | --------------------------------------------------------- |
| Data fetching  | ✅ Yes                   | ⚠️ `fetch("/api/...")` in an effect, with AbortController |
| Backend access | ✅ Yes (`apiGet`, files) | ❌ No                                                     |
| Event handlers | ❌ No                    | ✅ Yes                                                    |
| State/Effects  | ❌ No                    | ✅ Yes                                                    |
| Browser APIs   | ❌ No                    | ✅ Yes                                                    |
| Bundle size    | 0 KB                     | Adds to bundle                                            |
| Streaming      | ✅ Yes                   | ❌ No                                                     |

## Best Practices

1. **Default to Server Components** - Only use 'use client' when needed
2. **Move Client Components down** - Push them to leaves of component tree
3. **Pass data down** - Fetch in Server Components, pass to Client Components
4. **Use composition** - Nest Server Components inside Client Components via children
5. **Cache expensive operations** - Use React cache() for deduplication
