# Mutations (BFF Route Handlers)

## Basic Mutation Handler

```tsx
// lib/posts/transport.server.ts
import "server-only";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { serverEnv } from "@/lib/env.server";
import {
  bffHeaders,
  drainBody,
  readBoundedBodyAsText,
  readCookieValue,
} from "@/lib/http/bff-helpers.server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";

function bffResult(status: number, body: PostBffBody): PostBffResult {
  return { status, body, headers: bffHeaders() };
}

export async function handleCreatePost(request: Request): Promise<PostBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return bffResult(403, { ok: false, code: "errors.transport.forbidden" });
  }
  const read = await readBoundedBodyAsText(request, 4_096);
  if (!read.ok) return bffResult(413, { ok: false, code: "errors.transport.invalidRequest" });

  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME); // checked: see Authentication

  const res = await fetch(`${serverEnv.API_BASE_URL}/api/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: read.text,
  });
  await drainBody(res);

  return res.ok
    ? bffResult(201, { ok: true })
    : bffResult(502, { ok: false, code: "errors.transport.unavailable" });
}

// app/api/posts/route.ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { handleCreatePost } from "@/lib/posts/transport.server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await handleCreatePost(request);
  if (result.status === 201) revalidatePath("/posts");
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}
```

## Form with a BFF Mutation

```tsx
// lib/posts/client.ts
"use client";

import { mutationErrorCodeFromResponse, readErrorBody } from "@/lib/http/mutation-error";

export async function createPost(payload: { title: string; content: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("/api/posts", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true as const, post: ((await res.json()) as { post: Post }).post };
    return {
      ok: false as const,
      code: mutationErrorCodeFromResponse(res.status, await readErrorBody(res)),
    };
  } catch {
    return { ok: false as const, code: "failed" as const };
  } finally {
    clearTimeout(timeout);
  }
}

// components/v2/v2-new-post-form.tsx
("use client");

import { useRouter } from "@/i18n/navigation";
import { createPost } from "@/lib/posts/client";

export function V2NewPostForm() {
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await createPost({
      title: String(form.get("title")),
      content: String(form.get("content")),
    });
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Yazıyı oluştur</button>
    </form>
  );
}
```

## Transport with Validation

```tsx
// lib/posts/transport.server.ts
import "server-only";
import { z } from "zod";

const createPostRequestSchema = z
  .object({
    title: z.string().min(3).max(100),
    content: z.string().min(10),
  })
  .strict();

export async function handleCreatePost(request: Request): Promise<PostBffResult> {
  // ... same-origin check and bounded read as above

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(read.text);
  } catch {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const parsedBody = createPostRequestSchema.safeParse(rawJson);
  if (!parsedBody.success) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" });
  }

  const res = await fetch(`${serverEnv.API_BASE_URL}/api/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(parsedBody.data),
  });

  // Validate the API's answer too
  const post = postSchema.safeParse(await res.json().catch(() => null));
  if (!res.ok || !post.success) {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  return bffResult(201, { ok: true, post: post.data });
}
```

## Client Component with a BFF Mutation

```tsx
// components/v2/v2-create-post-form.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MutationErrorCode } from "@/lib/http/mutation-error";
import { createPost } from "@/lib/posts/client";

export function CreatePostForm() {
  const t = useTranslations("Posts");
  const [code, setCode] = useState<MutationErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await createPost({
      title: String(form.get("title")),
      content: String(form.get("content")),
    });
    setPending(false);
    setCode(result.ok ? null : result.code);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input name="title" />
      </div>

      <div>
        <textarea name="content" />
      </div>

      {code && <p role="alert">{t(`errors.${code}`)}</p>}
      <button type="submit" disabled={pending}>
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
```

## Mutation with Redirect

```tsx
// components/v2/v2-new-post-form.tsx
"use client";

import { useRouter } from "@/i18n/navigation";
import { createPost } from "@/lib/posts/client";

export function V2NewPostForm() {
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await createPost({
      title: String(form.get("title")),
      content: String(form.get("content")),
    });

    if (result.ok) {
      router.push({ pathname: "/posts/[id]", params: { id: result.post.id } });
    }
  }

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

## Optimistic Updates

```tsx
// components/v2/v2-todo-list.tsx
"use client";

import { useOptimistic } from "react";
import { useRouter } from "@/i18n/navigation";
import { createTodo } from "@/lib/todos/client";

export function TodoList({ todos }: { todos: Todo[] }) {
  const router = useRouter();
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(todos, (state, newTodo: Todo) => [
    ...state,
    newTodo,
  ]);

  async function handleSubmit(formData: FormData) {
    const title = String(formData.get("title"));
    const newTodo = { id: crypto.randomUUID(), title, completed: false };

    // Optimistically update UI
    addOptimisticTodo(newTodo);

    // Send to the BFF route, then re-render the Server Components that own `todos`
    const result = await createTodo({ title });
    if (result.ok) router.refresh();
  }

  return (
    <div>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>

      <form action={handleSubmit}>
        <input name="title" />
        <button type="submit">Ekle</button>
      </form>
    </div>
  );
}
```

## Transport with Authentication

```tsx
// lib/posts/transport.server.ts
import "server-only";
import { ACCESS_COOKIE_NAME } from "@/lib/auth/cookies";
import { drainBody, readCookieValue } from "@/lib/http/bff-helpers.server";

export async function handleCreatePost(request: Request): Promise<PostBffResult> {
  const accessToken = readCookieValue(request, ACCESS_COOKIE_NAME);

  if (!accessToken) {
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }

  const res = await fetch(`${serverEnv.API_BASE_URL}/api/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(parsedBody.data),
  });

  if (res.status === 401) {
    await drainBody(res);
    return bffResult(401, { ok: false, code: "errors.auth.unauthenticated" });
  }
  // ...
}

// lib/posts/client.ts maps the 401 to "session-expired" (mutationErrorCodeFromResponse);
// the island then links to the login page.
```

## Inline Mutation Form

```tsx
// app/[locale]/(site)/posts/page.tsx
import { getPosts } from "@/lib/api/posts";
import { DeletePostForm } from "@/components/v2/v2-delete-post-form";

export default async function Posts() {
  const posts = await getPosts();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          {post.title}
          <DeletePostForm postId={post.id} />
        </li>
      ))}
    </ul>
  );
}

// components/v2/v2-delete-post-form.tsx
("use client");

import { useRouter } from "@/i18n/navigation";
import { removePost } from "@/lib/posts/client";

export function DeletePostForm({ postId }: { postId: string }) {
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await removePost(postId); // DELETE /api/posts/[id]
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit">Sil</button>
    </form>
  );
}
```

## Programmatic Mutation Call

```tsx
// components/v2/v2-delete-button.tsx
"use client";

import { useRouter } from "@/i18n/navigation";
import { removePost } from "@/lib/posts/client";

export function DeleteButton({ postId }: { postId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (confirm("Emin misin?")) {
      const result = await removePost(postId);
      if (result.ok) router.refresh();
    }
  }

  return <button onClick={handleDelete}>Sil</button>;
}

// lib/posts/client.ts
export async function removePost(postId: string) {
  const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (res.status === 204) return { ok: true as const };
  return {
    ok: false as const,
    code: mutationErrorCodeFromResponse(res.status, await readErrorBody(res)),
  };
}
```

## Revalidation Strategies

```tsx
// app/api/posts/[id]/route.ts
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { handleUpdatePost } from "@/lib/posts/transport.server";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await handleUpdatePost(request, id);

  if (result.status === 200) {
    // Revalidate specific path
    revalidatePath("/posts");
    revalidatePath(`/posts/${id}`);

    // Revalidate all paths in a layout
    revalidatePath("/posts", "layout");

    // Revalidate by cache tag (Next 16: second argument is the cache profile)
    revalidateTag("posts", "max");
  }

  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

// In the island, re-render the current route's Server Components:
// router.refresh() (useRouter from @/i18n/navigation)
```

## Mutation with File Upload

```tsx
// lib/profile/avatar-transport.server.ts
import "server-only";

export async function handleUploadAvatar(request: Request): Promise<AvatarBffResult> {
  if (!isSameOrigin(request, getSiteUrl())) {
    return bffResult(403, { ok: false, code: "errors.transport.forbidden" });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return bffResult(400, { ok: false, code: "errors.transport.invalidRequest" }); // No file uploaded
  }

  // Forward the file to the API instead of writing into public/ (served ahead of the router)
  const body = new FormData();
  body.set("avatar", file);
  const res = await fetch(`${serverEnv.API_BASE_URL}/api/avatars`, {
    method: "POST",
    headers: { Authorization: `Bearer ${readCookieValue(request, ACCESS_COOKIE_NAME)}` },
    cache: "no-store",
    body,
  });

  if (!res.ok) {
    await drainBody(res);
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  }
  const { url } = (await res.json()) as { url: string };
  return bffResult(200, { ok: true, path: url });
}

// components/v2/v2-upload-form.tsx
("use client");

import { uploadAvatar } from "@/lib/profile/client";

export function UploadForm() {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // fetch("/api/avatar", { method: "POST", body: new FormData(form) })
    const result = await uploadAvatar(new FormData(event.currentTarget));
    if (result.ok) {
      console.log("Uploaded to:", result.path);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" name="avatar" accept="image/*" />
      <button type="submit">Yükle</button>
    </form>
  );
}
```

## Error Handling

```tsx
// lib/posts/transport.server.ts
export async function handleCreatePost(request: Request): Promise<PostBffResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(`${serverEnv.API_BASE_URL}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(parsedBody.data),
    });
  } catch {
    return bffResult(502, { ok: false, code: "errors.transport.unavailable" });
  } finally {
    clearTimeout(timer);
  }

  // ... map res.status to { ok: true } or { ok: false, code }
}

// components/v2/v2-create-post-form.tsx
("use client");

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { MutationErrorCode } from "@/lib/http/mutation-error";
import { createPost } from "@/lib/posts/client";

export function CreatePostForm() {
  const [error, setError] = useState<MutationErrorCode | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await createPost(readPostForm(event.currentTarget));

    if (!result.ok) {
      setError(result.code);
    } else {
      // Success
      router.push("/posts");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div role="alert">
          {error === "session-expired" ? "Oturumun sona erdi." : "Olmadı, tekrar dene."}
        </div>
      )}
      {/* form fields */}
    </form>
  );
}
```

## Cookies in Route Handlers

```tsx
// app/api/theme/route.ts
import { NextResponse } from "next/server";
import { deriveSecureCookieAttribute } from "@/lib/auth/cookies";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getSiteUrl } from "@/lib/seo/site";

export async function POST(request: Request) {
  if (!isSameOrigin(request, getSiteUrl())) return new NextResponse(null, { status: 403 });
  const theme = new URL(request.url).searchParams.get("theme") === "dark" ? "dark" : "light";

  const response = NextResponse.json({ ok: true });
  response.cookies.set("theme", theme, {
    httpOnly: true,
    secure: deriveSecureCookieAttribute(getSiteUrl()),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
  return response;
}

// lib/theme/theme.server.ts
import "server-only";
import { cookies } from "next/headers";

export async function getTheme() {
  return (await cookies()).get("theme")?.value ?? "light";
}
```

## Rate Limiting

```tsx
// lib/<domain>/transport.server.ts
// The API throttles; the transport passes its 429 and error key through
const message = ((await readErrorBody(res)) as { message?: unknown } | null)?.message;
if (res.status === 429 && isKnownApiErrorCode(message)) {
  return bffResult(429, { ok: false, code: message });
}

// components/v2/v2-login-card.tsx
if (result.code === "errors.auth.rateLimited" || result.code === "errors.auth.tooManyAttempts") {
  // Show the wait-and-retry message
}
```

## Quick Reference

| Capability       | Usage                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Define**       | `app/api/**/route.ts` delegating to `lib/<domain>/transport.server.ts` |
| **Form**         | `<form onSubmit>` in a `"use client"` island                           |
| **Programmatic** | Call `lib/<domain>/client.ts`: `await createPost(data)`                |
| **Validation**   | zod on the request body and on the API response                        |
| **Revalidate**   | `revalidatePath()` or `revalidateTag()`                                |
| **Redirect**     | `router.push()` after mutation                                         |
| **Errors**       | Return error objects, handle in client                                 |
| **Files**        | Access via `formData.get()` as File                                    |

## Best Practices

1. **Always validate** - Use zod in `transport.server.ts` for type-safe validation
2. **Revalidate** - Call revalidatePath() after mutations
3. **Handle errors** - Return error objects instead of throwing
4. **Auth checks** - Verify session before mutations
5. **Rate limiting** - The API throttles; pass its 429 through as an error code
6. **Type safety** - Define input/output types
7. **Optimistic updates** - Use useOptimistic for better UX
