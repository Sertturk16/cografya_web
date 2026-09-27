# Data Fetching & Caching

## Extended fetch API

Next.js extends the native fetch with caching and revalidation options:

```tsx
// lib/api/client.ts
export async function apiGet<T>(path: string, options: { revalidate?: number } = {}): Promise<T> {
  const res = await fetch(`${serverEnv.API_BASE_URL}${path}`, {
    next: { revalidate: options.revalidate ?? CONTENT_REVALIDATE_SECONDS }, // 3600 s ISR
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API GET ${path} failed with status ${res.status}`);
  }

  return (await res.json()) as T;
}

// app/[locale]/(site)/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { ProseSkeleton } from "@/components/patterns/page-skeleton";
import { apiGet } from "@/lib/api/client";
import type { ProvinceListItem } from "@/lib/api/types";

async function ProvinceSection() {
  const data = await apiGet<ProvinceListItem[]>("/api/provinces");
  return <div>{/* render data */}</div>;
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<ProseSkeleton lines={4} />}>
      <ProvinceSection />
    </Suspense>
  );
}
```

## Cache Options

```tsx
// 1. Force cache (Static Site Generation)
fetch("https://api.example.com/data", {
  cache: "force-cache", // Opt-in: fetch is not cached by default since Next 15
});

// 2. No cache (Server-Side Rendering)
fetch("https://api.example.com/data", {
  cache: "no-store", // Always fetch fresh data
});

// 3. Revalidate (Incremental Static Regeneration)
fetch("https://api.example.com/data", {
  next: { revalidate: 3600 }, // Revalidate every hour
});

// 4. Revalidate with tags
fetch("https://api.example.com/data", {
  next: { tags: ["posts"] },
});
```

## Revalidation Methods

### Time-based Revalidation (ISR)

```tsx
// Revalidate every 60 seconds
async function getPosts() {
  return apiGet<Post[]>("/api/posts", { revalidate: 60 });
}

// Route segment config
export const revalidate = 60; // seconds

async function PostsSection() {
  const posts = await getPosts();
  return <div>{/* render */}</div>;
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<ProseSkeleton lines={4} />}>
      <PostsSection />
    </Suspense>
  );
}
```

### On-Demand Revalidation

```tsx
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (path) {
    revalidatePath(path);
    return Response.json({ revalidated: true, now: Date.now() });
  }

  return Response.json({ revalidated: false });
}

// Usage in a BFF route handler (app/api/posts/route.ts)
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { handleCreatePost } from "@/lib/posts/transport.server";

export async function POST(request: Request) {
  const result = await handleCreatePost(request);

  if (result.status === 201) {
    // Revalidate specific path
    revalidatePath("/posts");

    // Revalidate entire layout
    revalidatePath("/posts", "layout");
  }

  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}
```

### Tag-based Revalidation

```tsx
// Fetch with tags
async function getPosts() {
  const res = await fetch("https://api.example.com/posts", {
    next: { tags: ["posts"] },
  });
  return res.json();
}

async function getAuthors() {
  const res = await fetch("https://api.example.com/authors", {
    next: { tags: ["authors"] },
  });
  return res.json();
}

// Revalidate by tag
import { revalidateTag } from "next/cache";

export async function createPost() {
  // Revalidate all fetches tagged with 'posts' (Next 16: second argument is the cache profile)
  revalidateTag("posts", "max");
}
```

## Route Segment Config

```tsx
// app/[locale]/(site)/posts/page.tsx

// Force dynamic rendering
export const dynamic = "force-dynamic"; // 'auto' | 'force-dynamic' | 'error' | 'force-static'

// Revalidation interval
export const revalidate = 3600; // false | 0 | number (seconds)

// Fetch cache
export const fetchCache = "auto"; // 'auto' | 'default-cache' | 'only-cache' | 'force-cache' | 'force-no-store' | 'default-no-store' | 'only-no-store'

// Runtime
export const runtime = "nodejs"; // 'nodejs' | 'edge'

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <div>Posts</div>;
}
```

## Parallel Data Fetching

```tsx
async function getUser() {
  return apiGet<User>("/api/user");
}

async function getPosts() {
  return apiGet<Post[]>("/api/posts");
}

async function getComments() {
  return apiGet<Comment[]>("/api/comments");
}

async function DashboardSection() {
  // Fetch in parallel with Promise.all
  const [user, posts, comments] = await Promise.all([getUser(), getPosts(), getComments()]);

  return (
    <div>
      <UserInfo user={user} />
      <Posts posts={posts} />
      <Comments comments={comments} />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<CardGridSkeleton columns="3" count={3} />}>
      <DashboardSection />
    </Suspense>
  );
}
```

## Sequential Data Fetching

```tsx
// When one fetch depends on another
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // First fetch
  const user = await apiGet<User>(`/api/users/${id}`);

  // Second fetch depends on first
  const posts = await apiGet<Post[]>(`/api/users/${user.id}/posts`);

  return (
    <div>
      <h1>{user.name}</h1>
      <Posts posts={posts} />
    </div>
  );
}
```

## Streaming with Suspense

```tsx
// app/[locale]/(site)/posts/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { ProseSkeleton } from "@/components/patterns/page-skeleton";

async function Posts() {
  const posts = await apiGet<Post[]>("/api/posts");

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      <h1>Yazılar</h1>
      <Suspense fallback={<ProseSkeleton lines={4} />}>
        <Posts />
      </Suspense>
    </div>
  );
}
```

## React cache for Deduplication

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
  const user = await getUser(userId); // Cached
  return <div>{user.name}</div>;
}

// components/v2/v2-user-posts.tsx
export async function UserPosts({ userId }: { userId: string }) {
  const user = await getUser(userId); // Uses cached result
  return <div>{user.posts.length} posts</div>;
}

// app/[locale]/(site)/page.tsx
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <UserProfile userId="123" />
      <UserPosts userId="123" /> {/* Same fetch, deduplicated */}
    </>
  );
}
```

## Database Queries

```tsx
// lib/api/posts.ts (the web has no database; it queries through the API)
import "server-only";
import { apiGet } from "./client";

export async function getPosts() {
  return apiGet<PostWithAuthor[]>("/api/posts");
}

// app/[locale]/(site)/posts/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { ProseSkeleton } from "@/components/patterns/page-skeleton";
import { getPosts } from "@/lib/api/posts";

export const revalidate = 60; // Revalidate every 60 seconds

async function PostList() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.name}</p>
        </article>
      ))}
    </div>
  );
}

export default async function PostsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<ProseSkeleton lines={4} />}>
      <PostList />
    </Suspense>
  );
}
```

## Error Handling

```tsx
async function getData() {
  // apiGet throws ApiError on a non-OK status: this will activate the closest error.tsx
  return apiGet<Data>("/api/data");
}

async function DataSection() {
  const data = await getData();
  return <div>{data.title}</div>;
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<ProseSkeleton lines={2} />}>
      <DataSection />
    </Suspense>
  );
}

// app/[locale]/(site)/error.tsx
("use client");

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

## Loading States

```tsx
// app/[locale]/(site)/kayit/loading.tsx (force-dynamic leaf route)
import { PageSkeleton } from "@/components/patterns/page-skeleton";

export default function Loading() {
  return <PageSkeleton shape="auth" />;
}

// app/[locale]/(site)/kayit/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getProvinces } from "@/lib/api/provinces";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const provinces = await getProvinces();

  return (
    <div>
      {provinces.length} il {/* render form */}
    </div>
  );
}
```

## Client-Side Data Fetching

```tsx
// When you need client-side fetching (a BFF route under /api, never the API itself)
"use client";

import * as React from "react";

export function Posts() {
  const [data, setData] = React.useState<Post[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      fetch("/api/posts", { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then(setData, () => {
          if (!controller.signal.aborted) setError(true);
        });
    load();
    const timer = setInterval(load, 3000); // Refresh every 3 seconds
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  if (error) return <div>Yüklenemedi</div>;
  if (!data) return <div>Yükleniyor…</div>;

  return (
    <ul>
      {data.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

## Preloading Data

```tsx
// lib/api/users.ts
import "server-only";
import { cache } from "react";
import { apiGet } from "./client";

export const preload = (id: string) => {
  void getUser(id); // Trigger fetch without awaiting
};

export const getUser = cache(async (id: string) => {
  return apiGet<User>(`/api/users/${id}`);
});

// components/v2/v2-user.tsx
import { getUser } from "@/lib/api/users";

export async function User({ id }: { id: string }) {
  const user = await getUser(id);
  return <div>{user.name}</div>;
}

// app/[locale]/(site)/page.tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { User } from "@/components/v2/v2-user";
import { preload } from "@/lib/api/users";

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  preload("123"); // Start loading immediately
  return <User id="123" />;
}
```

## Static Generation with Dynamic Routes

```tsx
// app/[locale]/(site)/turkiye/[slug]/page.tsx
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getProvinceBySlug, getProvincesResilient } from "@/lib/api/provinces";

export async function generateStaticParams() {
  const provinces = await getProvincesResilient();

  return routing.locales.flatMap((locale) =>
    provinces.map((province) => ({
      locale,
      slug: locale === "en" ? province.slugEn : province.slugTr,
    })),
  );
}

export default async function Province({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const province = await getProvinceBySlug(slug);
  if (!province) notFound();

  return (
    <article>
      <h1>{province.nameTr}</h1>
    </article>
  );
}
```

## Quick Reference

| Strategy      | Config                                   | Use Case               |
| ------------- | ---------------------------------------- | ---------------------- |
| **SSG**       | `cache: 'force-cache'`                   | Static content         |
| **SSR**       | `cache: 'no-store'`                      | Always fresh data      |
| **ISR**       | `apiGet(path, { revalidate: 60 })`       | Periodic updates       |
| **Tag-based** | `next: { tags: ['posts'] }`              | On-demand revalidation |
| **Dynamic**   | `export const dynamic = 'force-dynamic'` | Per-request data       |

## Best Practices

1. **Default to caching** - Every `apiGet` read carries a `revalidate` window
2. **Use ISR** - Revalidate periodically for semi-dynamic content
3. **Parallel fetching** - Use Promise.all for independent requests
4. **Deduplicate** - Use React cache() for repeated calls
5. **Stream with Suspense** - Show content progressively
6. **Tag your fetches** - Enable granular revalidation
7. **Handle errors** - Use error.tsx for graceful degradation
