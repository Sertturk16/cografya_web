# V1 Retirement Implementation Plan (T-032)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete V1 entirely, drop V2's `/v2` prefix and `noindex`, and make V2 the public indexed site.

**Architecture:** Four sequential PRs. PR1 ports the six V1 routes that have no V2 counterpart (still under `/v2`). PR2 adds the missing error boundaries and the EN honesty notice. PR3 performs the URL migration in one commit and consolidates page chrome into `(site)`/`(play)` route groups. PR4 removes the now-unreferenced V1 code. PR1 and PR2 are independent of each other; PR3 depends on both; PR4 depends on PR3.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4 (CSS-first, no config file), shadcn `base-nova` on Base UI, next-intl 4, vitest (node env, **no jsdom**), Node 24, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-17-v1-retirement-design.md`

## Global Constraints

- Work on a `feature/*` branch off `dev`. Never push to `main`. Conventional Commits (commitlint hook is active).
- **Vitest runs nothing under `app/`.** Tests live co-located under `lib/`, `components/`, `tools/`. A test that needs to assert something about a file in `app/` reads it with `readFileSync` and asserts over the source text — this repo's established house form (`lib/seo/auth-routes.test.ts`, `lib/seo/redirects.test.ts`, `components/v2/v2-header-search-theme.test.ts`).
- **No jsdom.** There is no component rendering in tests. Do not write `render()`-style tests; write structure tests over source text, or pure unit tests over `lib/` functions.
- Gate before every commit: `pnpm typecheck && pnpm lint && pnpm test`. Add `pnpm build` for any change touching routing, SEO or config.
- Import `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation`, never from `next/link` or `next/navigation`.
- Every route needs an entry in `i18n/routing.ts` `pathnames` for **both** TR and EN.
- `Button` has no `asChild`. A link styled as a button is `<Link className={cn(buttonVariants({ variant, size }))}>`.
- Href typing: never `as any`. Where next-intl's typed `Link` rejects a computed href, use `as unknown as React.ComponentProps<typeof Link>["href"]`.
- Colours come from `var(--token)` in `app/globals.css` or Tailwind theme keys (`bg-primary`, `text-muted-foreground`). No brand hex in components.
- Never hand-edit the five generated files (`lib/api/schema.ts`, `lib/map/{tr-provinces,world-countries,tr-inland-water,tr-context}.generated.ts`).
- Visible UI change: check 320, 360, 390 px and desktop, light and dark, via Playwright MCP before calling it done.
- **Do not restyle Group C** (`air`, `book`, `climate`, `earthquake`, `marine`, `site-search`). That is T-033.

---

## File Structure

**PR1 — created**

| File                                               | Responsibility                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `components/v2/v2-auth-field.tsx`                  | Shared V2 form primitives: `V2TextField`, `V2FormErrorRegion`. Replaces `components/auth/field.tsx` for the ported flows. |
| `components/v2/v2-password-reset-request-card.tsx` | Client island for `/sifre-sifirlama`. Port of `password-reset-request-form.tsx`.                                          |
| `components/v2/v2-password-reset-confirm-card.tsx` | Client island for `/sifre-sifirlama/yeni`. Port of `password-reset-confirm-form.tsx`.                                     |
| `components/v2/v2-verify-email-card.tsx`           | Client island for `/e-posta-dogrulama`. Port of `verify-email-form.tsx`.                                                  |
| `app/[locale]/v2/sifre-sifirlama/page.tsx`         | Server shell.                                                                                                             |
| `app/[locale]/v2/sifre-sifirlama/yeni/page.tsx`    | Server shell.                                                                                                             |
| `app/[locale]/v2/e-posta-dogrulama/page.tsx`       | Server shell.                                                                                                             |
| `app/[locale]/v2/hakkimizda/page.tsx`              | Server page, T-030 copy verbatim.                                                                                         |
| `components/v2/v2-auth-ports.test.ts`              | Structure test over the four new page files and three cards.                                                              |

**PR2 — created**

| File                                              | Responsibility                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `app/not-found.tsx`                               | Root 404 for genuinely unmatched URLs. Own `<html>/<body>`, bilingual, static. |
| `app/[locale]/v2/not-found.tsx`                   | V2-chrome 404 for in-locale `notFound()` throws from V2 routes.                |
| `app/[locale]/v2/error.tsx`                       | V2-chrome error boundary.                                                      |
| `components/v2/v2-en-work-in-progress-notice.tsx` | EN honesty notice, gated on `EN_CONTENT_READY`.                                |
| `components/v2/v2-error-boundaries.test.ts`       | Structure test over the three boundary files.                                  |
| `components/v2/v2-en-notice.test.ts`              | Asserts the notice is flag-driven and covers the intended surfaces.            |

No marine module appears here. An earlier draft created one; it would have duplicated
`marineShowsValues` in `lib/marine/overview.ts`, and the work that consumed it is now
deferred to T-033 — see "Tasks 10 and 11: CUT".

**PR3 — modified**

| File                                                           | Responsibility                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `i18n/routing.ts`                                              | All 99 `/v2` pathnames lose the prefix; V1-only pathnames removed.                        |
| `app/[locale]/(site)/layout.tsx`                               | New. Skip link, `V2Header`, single `<main id="main-content">`, `V2Footer`.                |
| `app/[locale]/(play)/layout.tsx`                               | New. Bare wrapper for the three fullscreen game routes.                                   |
| `app/[locale]/layout.tsx`                                      | Root shell only: `<html>/<body>`, `NextIntlClientProvider`, `Toaster`. V1 chrome removed. |
| `next.config.ts`                                               | `redirects()` gains the two `/v2` prefix-strip entries.                                   |
| `lib/auth/auth-metadata.ts`                                    | `AUTH_PATHNAMES` loses `/v2` prefixes; D-4 note resolved.                                 |
| `lib/seo/auth-routes.test.ts`                                  | Gains the cross-repo mail-path tripwire.                                                  |
| `lib/seo/redirects.test.ts`                                    | Entry-count assertion updated.                                                            |
| `app/sitemap.ts`, `app/robots.ts`, `lib/seo/routes.fixture.ts` | `/v2` references normalized.                                                              |

**PR4 — moved / deleted**

| File                             | Responsibility                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `lib/game/region-labels.ts`      | Moved from `components/game/`.                                                  |
| `lib/home/featured-card-item.ts` | `FeaturedCardItem` type, extracted.                                             |
| `lib/tools/province-area.ts`     | `ProvinceArea` type, extracted.                                                 |
| `components/v1-removal.test.ts`  | Absence tripwire: asserts the deleted directories and CSS classes stay deleted. |

---

# PR1 — Port the six routes

Branch: `feature/t032-pr1-route-ports`. These pages live under `/v2` for now; PR3 strips the prefix along with every other route.

## Task 1: V2 auth form primitives

`components/auth/field.tsx` supplies `TextField` and `FormErrorRegion` to the three flows being ported. It uses `auth-form.module.css` and the global `.btn` classes, both of which PR4 deletes. Build the V2 equivalents on `components/ui` first, so the three card ports have something to consume.

**Files:**

- Create: `components/v2/v2-auth-field.tsx`
- Create: `components/v2/v2-auth-field.test.ts`

**Interfaces:**

- Consumes: `components/ui/{input,label}`, `@/lib/utils` `cn`.
- Produces:
  - `V2TextField(props: V2TextFieldProps): JSX.Element` where `V2TextFieldProps = Omit<React.ComponentProps<"input">, "id"> & { id: string; label: string; error?: string }`
  - `V2FormErrorRegion(props: { headingRef: React.RefObject<HTMLHeadingElement | null>; summary: string; fieldErrors?: readonly { id: string; label: string }[] }): JSX.Element`

- [ ] **Step 1: Read the component being replaced**

Read `components/auth/field.tsx` in full. The port must preserve its accessibility contract exactly: the error region is a focusable heading (`tabIndex={-1}`) that receives focus on error, each field error links to its input by `id`, and inputs carry `aria-invalid` and `aria-describedby`.

- [ ] **Step 2: Write the failing structure test**

```ts
// components/v2/v2-auth-field.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(fileURLToPath(new URL("./v2-auth-field.tsx", import.meta.url)), "utf8");

describe("V2 auth field primitives", () => {
  it("exports both primitives the ported cards consume", () => {
    expect(SOURCE).toContain("export function V2TextField");
    expect(SOURCE).toContain("export function V2FormErrorRegion");
  });

  it("builds on components/ui, not on the deleted V1 CSS module", () => {
    expect(SOURCE).toContain('from "@/components/ui/input"');
    expect(SOURCE).toContain('from "@/components/ui/label"');
    expect(SOURCE).not.toContain("auth-form.module.css");
    expect(SOURCE).not.toMatch(/className="[^"]*\bbtn\b/);
  });

  it("preserves the error-region accessibility contract", () => {
    // The heading is programmatically focused when errors appear, so it must be
    // focusable but out of the tab order (same contract as components/auth/field.tsx).
    expect(SOURCE).toContain("tabIndex={-1}");
    expect(SOURCE).toContain('role="alert"');
    expect(SOURCE).toContain("aria-invalid");
    expect(SOURCE).toContain("aria-describedby");
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run components/v2/v2-auth-field.test.ts`
Expected: FAIL — `ENOENT`, the source file does not exist yet.

- [ ] **Step 4: Implement the primitives**

```tsx
// components/v2/v2-auth-field.tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface V2TextFieldProps extends Omit<React.ComponentProps<"input">, "id"> {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
}

/**
 * V2 port of `components/auth/field.tsx`'s `TextField`. The accessibility contract is
 * carried over unchanged — `aria-invalid` plus an `aria-describedby` that points at the
 * error paragraph — because the auth flows' error handling depends on it; only the
 * presentation moves from `auth-form.module.css` to Tailwind + `components/ui`.
 */
export function V2TextField({ id, label, error, className, ...inputProps }: V2TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-bold text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className={cn(error !== undefined && "border-destructive", className)}
        {...inputProps}
      />
      {error !== undefined ? (
        <p id={errorId} className="text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface V2FormErrorRegionProps {
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly summary: string;
  readonly fieldErrors?: readonly { readonly id: string; readonly label: string }[];
}

/**
 * V2 port of `FormErrorRegion`. `tabIndex={-1}` makes the heading programmatically
 * focusable so the form can move focus here when submission fails; `role="alert"` is what
 * announces the change. Both are load-bearing, not decoration.
 */
export function V2FormErrorRegion({ headingRef, summary, fieldErrors }: V2FormErrorRegionProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 space-y-2"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-sm font-bold text-destructive"
      >
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {summary}
      </h2>
      {fieldErrors !== undefined && fieldErrors.length > 0 ? (
        <ul className="list-disc pl-5 text-xs text-destructive space-y-1" role="list">
          {fieldErrors.map((fieldError) => (
            <li key={fieldError.id}>
              <a href={`#${fieldError.id}`} className="underline underline-offset-2">
                {fieldError.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run components/v2/v2-auth-field.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components/v2/v2-auth-field.tsx components/v2/v2-auth-field.test.ts
git commit -m "feat(v2): add V2 auth form primitives for the ported flows"
```

## Task 2: Port the password-reset request card

**Files:**

- Create: `components/v2/v2-password-reset-request-card.tsx`
- Read for reference: `components/auth/password-reset-request-form.tsx`, `components/v2/v2-login-card.tsx`

**Interfaces:**

- Consumes: `V2TextField`, `V2FormErrorRegion` (Task 1); `@/lib/auth/submit.client` `submitAuth`; `@/lib/auth/form-rules` `EMAIL_SHAPE`, `EMAIL_MAX`; `@/lib/auth/error-messages` `AUTH_ERROR_MESSAGE_KEYS`; `@/lib/auth/transport.server` type `AuthBffCode`.
- Produces: `V2PasswordResetRequestCard(): JSX.Element`

- [ ] **Step 1: Copy the logic verbatim, change only the markup**

Every `lib/auth/*` import survives PR4 — only `components/auth/*` is deleted. Keep the state machine, the validation, the `submitAuth("password-reset/request", { email })` call, the anti-enumeration behaviour (always 202; never branch on whether the address exists) and both focus effects exactly as they are. Replace `styles.*` class names with Tailwind, `TextField`/`FormErrorRegion` with the Task 1 primitives, and `<button className="btn btn-primary">` with `components/ui/button`'s `Button`.

```tsx
// components/v2/v2-password-reset-request-card.tsx
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import { EMAIL_SHAPE, EMAIL_MAX } from "@/lib/auth/form-rules";
import { submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { V2FormErrorRegion, V2TextField } from "./v2-auth-field";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Send } from "lucide-react";

interface FieldErrors {
  email?: string;
}

/**
 * `/sifre-sifirlama` · `/en/reset-password`. V2 port of
 * `components/auth/password-reset-request-form.tsx`; behaviour is unchanged.
 *
 * ANTI-ENUMERATION: a well-formed submission always resolves to the same accepted state,
 * whether or not the address exists. Do not add a branch that distinguishes them.
 */
export function V2PasswordResetRequestCard() {
  const t = useTranslations("Auth");

  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const hasFieldErrors = fieldErrors.email !== undefined;
  const hasErrors = hasFieldErrors || serverErrorCode !== null;

  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  useEffect(() => {
    if (accepted) successHeadingRef.current?.focus();
  }, [accepted]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (email.trim().length === 0) next.email = t("fieldErrors.required");
    else if (!EMAIL_SHAPE.test(email)) next.email = t("fieldErrors.emailInvalid");
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email !== undefined) return;

    setSubmitting(true);
    const result = await submitAuth("password-reset/request", { email });
    setSubmitting(false);

    if (result.ok) {
      setAccepted(true);
      return;
    }
    setServerErrorCode(result.code);
  }

  if (accepted) {
    return (
      <div className="space-y-3">
        <h2
          ref={successHeadingRef}
          tabIndex={-1}
          className="flex items-center gap-2 font-heading text-lg font-bold text-foreground"
        >
          <CheckCircle2 className="size-5 text-secondary shrink-0" aria-hidden="true" />
          {t("reset.accepted")}
        </h2>
      </div>
    );
  }

  const fieldErrorLinks = hasFieldErrors
    ? [{ id: "reset-email", label: t("fields.email") }]
    : undefined;

  return (
    <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {hasErrors ? (
        <V2FormErrorRegion
          headingRef={errorHeadingRef}
          summary={
            serverErrorCode !== null
              ? t(AUTH_ERROR_MESSAGE_KEYS[serverErrorCode])
              : t("formErrors.summary")
          }
          fieldErrors={fieldErrorLinks}
        />
      ) : null}
      <V2TextField
        id="reset-email"
        label={t("fields.email")}
        type="email"
        autoComplete="email"
        required
        maxLength={EMAIL_MAX}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
      />
      <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<Send />}>
        {t("reset.submit")}
      </Button>
      <noscript>
        <p className="text-xs text-muted-foreground">{t("noscript")}</p>
      </noscript>
    </form>
  );
}
```

- [ ] **Step 2: Note on the `Button` API**

Already verified against `components/ui/button.tsx`: `isLoading`, `leftIcon` and `rightIcon`
are real props (lines 46–48) and `primary` is a real variant (line 12). `isLoading` also sets
`disabled`, so do not pass both. No `asChild` exists and none is needed here.

- [ ] **Step 3: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add components/v2/v2-password-reset-request-card.tsx
git commit -m "feat(v2): port password-reset request form to V2"
```

## Task 3: Port the password-reset confirm card

**Files:**

- Create: `components/v2/v2-password-reset-confirm-card.tsx`
- Read for reference: `components/auth/password-reset-confirm-form.tsx` (394 lines — the largest of the three)

**Interfaces:**

- Consumes: same `lib/auth/*` surface as Task 2, plus whatever password-rule helpers the V1 form imports from `@/lib/auth/form-rules`.
- Produces: `V2PasswordResetConfirmCard(): JSX.Element`

- [ ] **Step 1: Read the source in full before porting**

This form is the most complex of the three: it reads `?token=` from the URL, enforces the password rules, and has more error states than the request form. Read it end to end and list every state it can be in before writing anything.

- [ ] **Step 2: Port it, preserving behaviour exactly**

Apply the same substitutions as Task 2 — `styles.*` → Tailwind, `TextField`/`FormErrorRegion` → `V2TextField`/`V2FormErrorRegion`, `.btn.btn-primary` → `Button`. Change no logic: not the token read, not the validation rules, not the error taxonomy, not the focus management.

Read the token with `useSearchParams` from `next/navigation` **only if the V1 form already does**; if it reads the token some other way, keep that way. (`@/i18n/navigation` re-exports navigation hooks, but `useSearchParams` is not a routing-aware hook — match whatever the V1 file does rather than switching import sources during a port.)

Password visibility toggles, if present, keep their `aria-label`; copy the idiom from `components/v2/v2-login-card.tsx:261`.

- [ ] **Step 3: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add components/v2/v2-password-reset-confirm-card.tsx
git commit -m "feat(v2): port password-reset confirm form to V2"
```

## Task 4: Port the verify-email card

**Files:**

- Create: `components/v2/v2-verify-email-card.tsx`
- Read for reference: `components/auth/verify-email-form.tsx` (209 lines)

**Interfaces:**

- Produces: `V2VerifyEmailCard(): JSX.Element`

- [ ] **Step 1: Port it with the same substitutions as Tasks 2 and 3**

Preserve the resend flow and its rate-limit error handling verbatim; those states come from the API contract, not from the UI.

- [ ] **Step 2: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add components/v2/v2-verify-email-card.tsx
git commit -m "feat(v2): port verify-email form to V2"
```

## Task 5: Add the three V2 auth pages and their routing entries

**Files:**

- Create: `app/[locale]/v2/sifre-sifirlama/page.tsx`
- Create: `app/[locale]/v2/sifre-sifirlama/yeni/page.tsx`
- Create: `app/[locale]/v2/e-posta-dogrulama/page.tsx`
- Modify: `i18n/routing.ts`
- Modify: `lib/auth/auth-metadata.ts` (`AUTH_PATHNAMES`)

**Interfaces:**

- Consumes: the three cards from Tasks 2–4; `buildAuthMetadata` from `@/lib/auth/auth-metadata`.
- Produces: three routes reachable at `/v2/sifre-sifirlama`, `/v2/sifre-sifirlama/yeni`, `/v2/e-posta-dogrulama` (and their EN segments).

- [ ] **Step 1: Add the pathname entries**

In `i18n/routing.ts` `pathnames`, alongside the existing `/v2/*` entries:

```ts
    "/v2/sifre-sifirlama": {
      tr: "/v2/sifre-sifirlama",
      en: "/v2/reset-password",
    },
    "/v2/sifre-sifirlama/yeni": {
      tr: "/v2/sifre-sifirlama/yeni",
      en: "/v2/reset-password/new",
    },
    "/v2/e-posta-dogrulama": {
      tr: "/v2/e-posta-dogrulama",
      en: "/v2/verify-email",
    },
```

The EN segments deliberately mirror the V1 ones (`/en/reset-password`, `/en/reset-password/new`, `/en/verify-email`), because PR3 strips the `/v2` prefix and the result must land exactly on the paths `cografya_api`'s `mail-copy.ts` hard-codes.

- [ ] **Step 2: Add the three pathnames to `AUTH_PATHNAMES`**

In `lib/auth/auth-metadata.ts`, add `"/v2/sifre-sifirlama"`, `"/v2/sifre-sifirlama/yeni"` and `"/v2/e-posta-dogrulama"` to the `AUTH_PATHNAMES` array. Add a one-line comment saying these are the V2 shells of the V1 routes of the same name and that PR3 collapses the pairs.

The existing gate in `lib/seo/auth-routes.test.ts` ("every auth page calls `buildAuthMetadata`, never `buildMetadata` directly") derives its page-file list from this array, so it will start covering the new pages automatically — that is the intent.

- [ ] **Step 3: Write the three page shells**

Follow `app/[locale]/v2/giris/page.tsx` exactly for chrome and layout. Use `buildAuthMetadata`, not `buildMetadata`.

```tsx
// app/[locale]/v2/sifre-sifirlama/page.tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2PasswordResetRequestCard } from "@/components/v2/v2-password-reset-request-card";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Home, ChevronRight } from "lucide-react";

interface PageProps {
  readonly params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return buildAuthMetadata({
    locale,
    pathname: "/v2/sifre-sifirlama",
    title: t("reset.metaTitle"),
    description: t("reset.metaDescription"),
  });
}

export default async function V2PasswordResetRequestPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <V2LiveTicker />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-20 space-y-14">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" aria-hidden="true" />
              <span>{t("breadcrumb.home")}</span>
            </Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span className="text-foreground font-semibold">{t("reset.heading")}</span>
          </nav>

          <div className="max-w-xl">
            <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
              {t("reset.heading")}
            </h1>
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
              <V2PasswordResetRequestCard />
            </div>
          </div>

          <V2SourcesSection scope="general" />
        </div>
      </div>
      <V2Footer />
    </div>
  );
}
```

Write the other two the same way, swapping the card, the `pathname`, and the translation keys (`verify.*` for the verification page; check `messages/tr.json`'s `Auth` namespace for the exact key names the V1 pages already use and reuse those — do not invent new keys).

`t("breadcrumb.home")` is used instead of the literal `"Ana Sayfa"` that `v2/giris/page.tsx` hard-codes. If the `Auth` namespace has no such key, add `breadcrumb.home` to both `messages/tr.json` and `messages/en.json` rather than copying the hard-coded Turkish string into three new files.

- [ ] **Step 4: Verify the routes build**

Run: `pnpm build`
Expected: succeeds, and the build output lists the three new routes. The API must be running on :3001 for the build.

- [ ] **Step 5: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green, including the auth-routes conformance gate now covering three more pages.

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/v2/sifre-sifirlama app/[locale]/v2/e-posta-dogrulama i18n/routing.ts lib/auth/auth-metadata.ts messages/tr.json messages/en.json
git commit -m "feat(v2): add password-reset and verify-email pages"
```

## Task 6: Port `/hakkimizda`

**Files:**

- Create: `app/[locale]/v2/hakkimizda/page.tsx`
- Modify: `i18n/routing.ts`
- Read for reference: `app/[locale]/hakkimizda/page.tsx`

- [ ] **Step 1: Add the pathname entry**

```ts
    "/v2/hakkimizda": {
      tr: "/v2/hakkimizda",
      en: "/v2/about",
    },
```

- [ ] **Step 2: Port the page with a real V2 design pass**

**The copy moves verbatim; the layout does not.** The strings are already in
`messages/{tr,en}.json` (T-030, PR #147) — reuse those exact keys and change no wording. The
V1 page is a bare `.container .page` with an `<h1>` and paragraphs, which is a pre-V2 shape;
transcribing it into a V2 wrapper would leave the site's one editorial page visibly older
than everything around it.

Rebuild the layout in the V2 language instead: `components/ui/card` for the team and mission
blocks, the section rhythm and `font-heading` scale the other V2 pages use, and
`V2SourcesSection` where the V1 page's data-source block sits today. `components/v2/v2-hero.tsx`
and `components/v2/v2-member-hub.tsx` are the closest reference shapes for an editorial page
with distinct content blocks.

Keep the existing `buildMetadata` surface value (`/hakkimizda` is `"localized"` per
`lib/seo/indexing.ts` — do not silently change it to `noindex`), and keep the existing
data-source section's content; only its presentation changes.

Load the `frontend-design` skill before starting this step, and check the result against
`docs/design.md` — which overrides anything the skill suggests.

- [ ] **Step 3: Write the port-coverage structure test**

```ts
// components/v2/v2-auth-ports.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const PAGES = [
  "../../app/[locale]/v2/sifre-sifirlama/page.tsx",
  "../../app/[locale]/v2/sifre-sifirlama/yeni/page.tsx",
  "../../app/[locale]/v2/e-posta-dogrulama/page.tsx",
  "../../app/[locale]/v2/hakkimizda/page.tsx",
] as const;

describe("T-032 PR1 — ported V2 pages", () => {
  it.each(PAGES)("%s renders V2 chrome, not V1 chrome", (page) => {
    const source = read(page);
    expect(source).toContain("V2Header");
    expect(source).toContain("V2Footer");
    expect(source).not.toContain("@/components/breadcrumb");
    expect(source).not.toMatch(/className="container page"/);
  });

  it.each(PAGES.slice(0, 3))("%s uses buildAuthMetadata, never buildMetadata", (page) => {
    const source = read(page);
    expect(source).toContain("buildAuthMetadata");
    expect(source).not.toMatch(/\bbuildMetadata\s*\(/);
  });

  it("the three auth cards consume lib/auth, never components/auth", () => {
    for (const card of [
      "./v2-password-reset-request-card.tsx",
      "./v2-password-reset-confirm-card.tsx",
      "./v2-verify-email-card.tsx",
    ]) {
      const source = read(card);
      expect(source).toContain("@/lib/auth/");
      expect(source).not.toContain("@/components/auth/");
    }
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run components/v2/v2-auth-ports.test.ts`
Expected: PASS.

- [ ] **Step 5: Screenshot the four ported pages**

Use Playwright MCP at 320, 360, 390 px and desktop, light and dark. The three auth pages must have no horizontal scroll at 320 px and a visible focus ring on every control.

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add app/[locale]/v2/hakkimizda i18n/routing.ts components/v2/v2-auth-ports.test.ts
git commit -m "feat(v2): port hakkimizda page and add PR1 port coverage"
```

---

# PR2 — Error boundaries and the EN notice

Branch: `feature/t032-pr2-boundaries`. Independent of PR1; can be developed in parallel.

Three tasks, not five: Tasks 10 and 11 were cut when the production flags were switched on
(see "Tasks 10 and 11: CUT" below for what was deferred and why).

## Task 7: Root `not-found.tsx`

`app/[locale]/araclar/[...rest]/page.tsx` exists only because a genuinely unmatched URL reaches no `[locale]` segment and therefore falls to Next's own unstyled, unlocalized 404. Its docblock names the real fix — a root `app/not-found.tsx` with its own shell — and declines it. Build it; it retires the catch-all pattern for every subtree at once instead of one directory at a time.

**Files:**

- Create: `app/not-found.tsx`
- Create: `components/root-not-found.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/root-not-found.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../app/not-found.tsx", import.meta.url)),
  "utf8",
);

describe("root not-found boundary", () => {
  it("supplies its own document shell", () => {
    // It renders OUTSIDE app/[locale]/layout.tsx, so nothing else provides html/body.
    expect(SOURCE).toContain("<html");
    expect(SOURCE).toContain("<body");
  });

  it("is static — it must not read the request", () => {
    // Resolving a locale here would force dynamic rendering on every route that can
    // throw notFound(), which is the regression app/[locale]/not-found.tsx documents.
    expect(SOURCE).not.toContain("getTranslations");
    expect(SOURCE).not.toContain("setRequestLocale");
    expect(SOURCE).not.toContain("headers(");
    expect(SOURCE).not.toContain("cookies(");
  });

  it("addresses both audiences, since it cannot know the locale", () => {
    expect(SOURCE).toMatch(/Sayfa bulunamad/i);
    expect(SOURCE).toMatch(/not found/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run components/root-not-found.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Implement it**

```tsx
// app/not-found.tsx
import "./globals.css";

/**
 * ROOT 404 — the boundary for a URL that matches no route at all.
 *
 * Next resolves an unmatched URL against the ROOT not-found only; a nested
 * `app/[locale]/not-found.tsx` fires exclusively when `notFound()` is thrown from inside a
 * MATCHED segment. Without this file such a URL falls to Next's own unstyled, unlocalized
 * default page — the defect `app/[locale]/araclar/[...rest]/page.tsx` was added to work
 * around for one subtree. This file replaces that pattern for every subtree.
 *
 * It renders outside `app/[locale]/layout.tsx`, so it must supply its own `<html>`/`<body>`.
 *
 * DELIBERATELY BILINGUAL AND STATIC. Resolving a locale here means a request read, which in
 * this SSG setup flips the statically-prerendered route that threw `notFound()` from static
 * to dynamic at runtime and 500s instead of returning 404 — the regression
 * `app/[locale]/not-found.tsx` already documents. Showing both languages is the honest
 * alternative and costs nothing at build time.
 *
 * The fonts are NOT loaded here. `lib/fonts.ts` attaches its CSS variables through the
 * locale layout, which never runs for this page; the body stack falls back to the system
 * sans in `--font-body`, which is correct rather than a missing feature.
 */
export default function RootNotFound() {
  return (
    <html lang="tr">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-5 py-16">
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">404</p>
            <h1 className="font-heading text-3xl font-bold">Sayfa bulunamadı</h1>
            <p className="text-muted-foreground">
              Aradığınız adres taşınmış veya hiç var olmamış olabilir.
            </p>
            <a href="/" className="inline-block font-semibold text-primary underline-offset-4">
              Ana sayfaya dön
            </a>
          </div>

          <hr className="border-border" />

          <div className="space-y-3">
            <h2 className="font-heading text-2xl font-bold">Page not found</h2>
            <p className="text-muted-foreground">
              The address you requested may have moved, or may never have existed.
            </p>
            <a href="/en" className="inline-block font-semibold text-primary underline-offset-4">
              Back to the homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
```

Plain `<a>` is correct here, not `@/i18n/navigation`'s `Link`: this component renders outside the locale provider, so the routing-aware link has no config to read.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run components/root-not-found.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify the real status code**

Run `pnpm build && pnpm start`, then in another shell:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/bu-adres-yok/derinde
```

Expected: `404`. A source-text test cannot prove this; the curl is the evidence.

- [ ] **Step 6: Commit**

```bash
git add app/not-found.tsx components/root-not-found.test.ts
git commit -m "feat(seo): add root 404 boundary for unmatched URLs"
```

## Task 8: V2 error boundaries

Today a V2 page that calls `notFound()` renders the V1-styled 404 **inside V1 header and footer**: the not-found subtree replaces `children`, so `.v2-app` never renders and the `body:has(.v2-app) > header, footer` suppression rule never matches. Give V2 its own boundaries.

**Files:**

- Create: `app/[locale]/v2/not-found.tsx`
- Create: `app/[locale]/v2/error.tsx`
- Create: `components/v2/v2-error-boundaries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/v2/v2-error-boundaries.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("V2 error boundaries", () => {
  it("V2 has its own not-found so it never renders V1 chrome", () => {
    const source = read("../../app/[locale]/v2/not-found.tsx");
    expect(source).toContain("V2Header");
    expect(source).toContain("V2Footer");
  });

  it("the error boundary is a client component and exposes reset", () => {
    const source = read("../../app/[locale]/v2/error.tsx");
    expect(source).toContain('"use client"');
    expect(source).toContain("reset");
  });

  it("the error boundary moves focus to its heading", () => {
    // docs/design.md a11y floor: error boundaries move focus to the heading.
    const source = read("../../app/[locale]/v2/error.tsx");
    expect(source).toContain("tabIndex={-1}");
    expect(source).toContain(".focus()");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run components/v2/v2-error-boundaries.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Implement `not-found.tsx`**

```tsx
// app/[locale]/v2/not-found.tsx
import { getTranslations } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2Footer } from "@/components/v2/v2-footer";

/**
 * V2's own 404 boundary. Before this file existed, a V2 route calling `notFound()` rendered
 * `app/[locale]/not-found.tsx` inside V1 header and footer: the boundary replaces `children`,
 * so `.v2-app` never rendered and the `body:has(.v2-app)` suppression rule never matched.
 *
 * The locale-less `getTranslations()` call and the missing localized `<title>` are the same
 * recorded limitation `app/[locale]/not-found.tsx` documents — `not-found.tsx` receives no
 * `params`, and resolving the locale statically is not available. Unchanged here on purpose.
 */
export default async function V2NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">404</p>
          <h1 className="font-heading text-3xl font-bold text-foreground">{t("heading")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
      </div>
      <V2Footer />
    </div>
  );
}
```

Do not add a `<Link>` back to the homepage using `@/i18n/navigation` unless a manual check confirms it renders: this boundary runs without `params`, and a routing-aware link needs the locale the boundary cannot resolve. The header already carries a working home link.

- [ ] **Step 4: Implement `error.tsx`**

```tsx
// app/[locale]/v2/error.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { V2Header } from "@/components/v2/v2-header";
import { V2Footer } from "@/components/v2/v2-footer";

/**
 * V2's error boundary. `docs/design.md`'s a11y floor requires that a state change of this
 * kind announces itself: focus moves to the heading on mount, which is why the heading is
 * `tabIndex={-1}` (focusable programmatically, never in the tab order).
 */
export default function V2Error({ reset }: { error: Error; reset: () => void }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <V2Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-3xl font-bold text-foreground"
          >
            Bir şeyler ters gitti
          </h1>
          <p className="text-muted-foreground">
            Sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar deneyebilirsiniz.
          </p>
          <Button type="button" variant="primary" onClick={reset}>
            Tekrar dene
          </Button>
        </div>
      </div>
      <V2Footer />
    </div>
  );
}
```

The copy is hard-coded Turkish because an error boundary is a client component that cannot `await getTranslations`. If `useTranslations` works here against the mounted `NextIntlClientProvider`, prefer it and pull the strings from the `Common` namespace; verify by rendering the boundary before choosing.

Do not log the `error` argument to the console or render it; it can carry a server stack.

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run components/v2/v2-error-boundaries.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify against a real 404 and a real throw**

Run `pnpm build && pnpm start`, then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/v2/turkiye/bu-il-yok
```

Expected: `404`, and the rendered HTML carries V2 header markup, not `site-header`.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/v2/not-found.tsx app/[locale]/v2/error.tsx components/v2/v2-error-boundaries.test.ts
git commit -m "fix(v2): give V2 its own 404 and error boundaries"
```

## Task 9: EN work-in-progress notice, driven by `EN_CONTENT_READY`

V1 tells English readers the truth on seven pages through `EnWorkInProgressNotice`; V2 says nothing. Port it — but bind it to `EN_CONTENT_READY`, the flag that already decides EN indexability, instead of relying on seven call sites each remembering to render it. One flag flip then retires the notice and opens indexing together, and the two cannot drift.

**Files:**

- Create: `components/v2/v2-en-work-in-progress-notice.tsx`
- Create: `components/v2/v2-en-notice.test.ts`
- Modify: the V2 counterparts of the seven V1 surfaces (see Step 4)

**Interfaces:**

- Consumes: `EN_CONTENT_READY` from `@/lib/seo/indexing`; `Locale` from `@/i18n/routing`.
- Produces: `V2EnWorkInProgressNotice({ locale }: { locale: Locale }): Promise<JSX.Element | null>`

- [ ] **Step 1: Write the failing test**

```ts
// components/v2/v2-en-notice.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EN_CONTENT_READY } from "@/lib/seo/indexing";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SOURCE = read("./v2-en-work-in-progress-notice.tsx");

const SURFACES = [
  "../../app/[locale]/v2/araclar/page.tsx",
  "../../app/[locale]/v2/araclar/alan-hesaplama/page.tsx",
  "../../app/[locale]/v2/araclar/koordinat-bulma/page.tsx",
  "../../app/[locale]/v2/araclar/mesafe-olcme/page.tsx",
  "../../app/[locale]/v2/deniz/page.tsx",
  "../../app/[locale]/v2/dunya/[slug]/page.tsx",
  "../../app/[locale]/v2/turkiye/[slug]/page.tsx",
] as const;

describe("V2 EN work-in-progress notice", () => {
  it("is gated on EN_CONTENT_READY, not only on the locale", () => {
    expect(SOURCE).toContain("EN_CONTENT_READY");
  });

  it("renders nothing for Turkish readers", () => {
    expect(SOURCE).toMatch(/locale !== "en"/);
  });

  it("covers every surface V1 covered", () => {
    for (const surface of SURFACES) {
      expect(read(surface)).toContain("V2EnWorkInProgressNotice");
    }
  });

  it("positive control — the flag import is real and currently false", () => {
    // If someone flips the flag, this test tells them to delete the notice rather than
    // leaving a now-lying banner on seven pages.
    expect(EN_CONTENT_READY).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run components/v2/v2-en-notice.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Implement the notice**

```tsx
// components/v2/v2-en-work-in-progress-notice.tsx
import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { EN_CONTENT_READY } from "@/lib/seo/indexing";

/**
 * The honesty notice V1 shows English readers on its Turkish-substance pages, ported to V2.
 *
 * GATED ON `EN_CONTENT_READY`, not only on the locale. That flag already decides whether a
 * `trNarrative` surface is indexable in English (`lib/seo/indexing.ts`); binding the notice
 * to the same flag means the claim the page makes to a reader and the claim it makes to a
 * crawler cannot disagree, and flipping the flag retires the notice everywhere at once
 * instead of leaving seven call sites to be found by hand.
 *
 * `role` is deliberately absent: nothing has gone wrong and nothing changed dynamically, so
 * `alert` would interrupt assistive technology for a plain note. `lang` is not set either —
 * the surrounding document is already `lang="en"` on every page that renders this.
 *
 * Returns `null` on Turkish and once EN ships, so every call site stays one unconditional line.
 */
export async function V2EnWorkInProgressNotice({ locale }: { locale: Locale }) {
  if (locale !== "en" || EN_CONTENT_READY) return null;

  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t("enWorkInProgress")}</span>
    </p>
  );
}
```

The `Common.enWorkInProgress` key already exists (V1 uses it); reuse it, do not add a second string.

- [ ] **Step 4: Mount it on the seven V2 surfaces**

For each file in the `SURFACES` list above, add the import and render the notice as one line directly below the page's `<h1>` block — the same position V1 uses. The component takes `locale`, which every one of these pages already destructures from `params`.

`EN_CONTENT_READY` is `false`, so this is a real visible change in the EN locale only. Confirm with a screenshot of `/en/v2/araclar` that the notice appears once, and of `/v2/araclar` that it does not appear at all.

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run components/v2/v2-en-notice.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add components/v2/v2-en-work-in-progress-notice.tsx components/v2/v2-en-notice.test.ts "app/[locale]/v2"
git commit -m "feat(v2): port EN work-in-progress notice, gated on EN_CONTENT_READY"
```

## Tasks 10 and 11: CUT — degraded-state copy is deferred

An earlier draft of this plan had two tasks here: confirm the shared marine predicate reaches
the four sea sub-pages, then branch their copy (and `/deprem`'s) on it so an empty payload
never renders as a live-telemetry claim.

**Both are cut.** Task 11a switches the production flags on, so those pages carry real data.
The branch would then be dead code except during a Copernicus or AFAD outage — a state nobody
will see on an unannounced deployment with no audience. Writing it now is speculative work.

It stays worth doing eventually, because `getMarineOverviewSafe` and
`getEarthquakeListResilient` answer an outage with an empty payload rather than an error, so
without the branch an outage silently reproduces T-024's defect. **Deferred to T-033**, which
touches those pages anyway. This is a deferral, not an oversight.

Two facts worth keeping where the next person will find them:

- The predicate already exists and is already shared — `marineShowsValues(overview)` in
  `lib/marine/overview.ts`, built on `marinePublishableBlocks` and consumed by `/v2/deniz`.
  Do not write a second one. Its docblock records why it is `blocks.length > 0` rather than
  the `dataAvailable` flag alone.
- `lib/home/marine-summary.test.ts` already exercises it against both the values-present and
  values-absent payloads, so it needs no new unit test — only new callers.

The standing rule for whoever picks this up: a page may describe the geography it is about,
but it may not claim a reading it does not have, never fabricates a number, and never paints
an absent value with the magnitude ramp.

## Task 11a: Switch the production feature flags on — OPS, NOT A PR

**This task is not a code change and belongs to no PR.** `docker-compose.prod.yml` lives on
the Hetzner host, not in either repository: both `deploy.yml` workflows SSH in and run
`docker compose -f docker-compose.prod.yml` against the host's own copy. Editing the working
copy at the workspace root deploys nothing.

Run it independently of the four PRs. It is reversible in one line and needs no code.

- [ ] **Step 1: Place `ADS_API_KEY` in `.env.prod` FIRST**

This ordering is not a preference. `src/config/env.schema.ts` declares `ADS_API_KEY` as
`optional()` and then requires it through a `superRefine` cross-check whenever
`AIR_QUALITY_ENABLED` is true — the schema's own comment says "a keyless deployment with the
leg off must still boot". `.env.prod` currently holds eight keys and this is not one of them;
the local `.env` has it, which is why air quality works in development.

Setting the flag without the key **fails env validation at boot**. The API container
crashloops, and `web` depends on `api` in the compose file, so the whole site goes down —
not just the air-quality pages.

Copy the value from the local `.env`. Never print it, never commit it, never paste it into a
PR description or a commit message.

- [ ] **Step 2: Flip the three credential-free flags first**

On the host, in `docker-compose.prod.yml`:

```yaml
MARINE_ENABLED: "true"
EARTHQUAKE_ENABLED: "true"
ELEVATION_ENABLED: "true"
```

These three need nothing else. Every upstream URL they read has a schema default
(`CMEMS_STAC_BASE_URL`, `AFAD_EVENT_API_BASE_URL`, `ELEVATION_BASE_URL`), and the companion
ingest switches — `MARINE_WARMUP_ENABLED`, `EARTHQUAKE_INGEST_ENABLED`, `ECMWF_ENABLED` —
all default to `true`, so the leg flag alone starts ingest.

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml ps api
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

Expected: `api` healthy, no validation error in the logs. If it crashloops, revert the three
lines and restart before investigating — do not leave production down while reading logs.

- [ ] **Step 3: Flip `AIR_QUALITY_ENABLED` as a separate change**

Only after Step 2 is verified healthy, and only with the key already in place:

```yaml
AIR_QUALITY_ENABLED: "true"
```

Restart and check health exactly as in Step 2. Keeping it separate means a rollback is one
line and you know which flag caused a failure.

- [ ] **Step 4: Confirm data actually arrives**

Ingest is scheduled, not instant. Give it one interval, then:

```bash
curl -s http://localhost:3001/api/marine/overview | head -c 400
curl -s http://localhost:3001/api/earthquakes?limit=3 | head -c 400
```

Expected: real values, and `dataAvailable` true on the marine payload. Then load
`/deniz/karadeniz` and `/deprem` in a browser and confirm the pages render values rather than
an empty state. If the pages still render empty, the flag is on but ingest
has not completed or is failing — check the API logs before assuming the page is wrong.

- [ ] **Step 5: Watch the host for a day**

None of this has ever run in production. Marine warmup, AFAD ingest and the CAMS air-quality
tour all write to Postgres and call upstream on a timer. Check disk and memory the following
day:

```bash
df -h && free -m
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\l+" | head
```

- [ ] **Step 6: Record the outcome in `TASKS.md`**

Note which flags are on, the date, and anything the first day surfaced. The board is the only
place this is written down — the compose file is not in version control.

---

# PR3 — URL migration

Branch: `feature/t032-pr3-url-migration`. Depends on PR1 and PR2. Tasks 12–15 land as **one commit** — the prefix removal, the V1 route deletion and the redirect table only typecheck together, and a half-applied routing table is a miserable thing to bisect later. That is a working-comfort argument, not an uptime one; nothing is riding on the deployment.

## Task 12: Strip `/v2` from the routing table

**Files:**

- Modify: `i18n/routing.ts`
- Modify: `lib/auth/auth-metadata.ts`

- [ ] **Step 1: Delete the V1-only pathname entries**

Remove the `pathnames` entries for the V1 routes that are going away entirely: `/design-system` and the `/araclar/[...rest]` catch-all. Leave every other key — those are the paths V2 is about to inherit.

- [ ] **Step 2: Strip the prefix from the 99 V2 entries**

For each `"/v2/..."` key, remove the `/v2` prefix from the key and from both locale values. Where the result collides with an existing V1 entry of the same name (`/turkiye`, `/dunya`, `/giris`, `/kayit`, `/deniz`, `/deprem`, `/kitaplar`, `/araclar`, `/oyun`, `/hakkimizda`, `/sifre-sifirlama`, `/sifre-sifirlama/yeni`, `/e-posta-dogrulama`), delete the V1 entry and keep the V2 one — **preserving the V1 entry's localized EN segment**. For the three auth routes that is load-bearing: `cografya_api`'s `mail-copy.ts` hard-codes `/en/reset-password`, `/en/reset-password/new` and `/en/login`. For the rest it is simply the segment that already reads correctly in English; there is no SEO reason, since none of these URLs is indexed.

Verify none was lost:

```bash
grep -c '"/v2' i18n/routing.ts   # expect 0
```

- [ ] **Step 3: Strip the prefix in `AUTH_PATHNAMES`**

`/v2/profil` → `/profil`, `/v2/hesabim` → `/hesabim`, and the three added in Task 5 lose their prefix. The array then contains each auth route exactly once. Delete the D-4 note about `/v2/giris` and `/v2/kayit` being outside the array — the migration resolves it, since the V2 shells now serve `/giris` and `/kayit`, which are already members.

- [ ] **Step 4: Make the V2 login and register pages conform**

`app/[locale]/v2/giris/page.tsx` and `.../kayit/page.tsx` call `buildMetadata` directly with `surface: "noindex"`. Now that they serve `AUTH_PATHNAMES` members, the existing G1 gate in `lib/seo/auth-routes.test.ts` requires `buildAuthMetadata`. Convert both.

- [ ] **Step 5: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: type errors in every file still referencing a `/v2/...` href. That is the worklist for Task 13 — capture it:

```bash
pnpm typecheck 2>&1 | tee /tmp/v2-href-worklist.txt
```

- [ ] **Step 6: Do not commit yet**

This task is not independently shippable; it lands with Task 13.

## Task 13: Move the route files and fix every `/v2` reference

**Files:**

- Delete: the 26 V1 route directories under `app/[locale]/` (all except `v2/`)
- Move: `app/[locale]/v2/*` → `app/[locale]/*`
- Modify: every file in the Task 12 worklist (74 non-test files, 758 occurrences)

- [ ] **Step 1: Delete the V1 routes**

```bash
cd "app/[locale]"
git rm -r araclar deniz deprem design-system dunya e-posta-dogrulama giris hakkimizda \
  kayit kitaplar oyun sifre-sifirlama turkiye page.tsx
```

Keep `layout.tsx`, `error.tsx`, `not-found.tsx`, `opengraph-image.tsx` and `v2/` — those are handled in Tasks 14 and 15.

- [ ] **Step 2: Move the V2 routes up**

`v2/layout.tsx` must be deleted **before** the move loop runs, or the loop overwrites the root
layout with it. It carries exactly two things and both are superseded in Task 14: the
`.v2-app` wrapper div existed only to drive the `body:has(.v2-app)` V1-chrome suppression
rule, which goes away with V1, and the `V2AuthDialog` mount moves into the `(site)` layout.
Its `metadata.robots` noindex block is handled in Step 5.

```bash
cd "app/[locale]"
git rm v2/layout.tsx
for entry in v2/*; do git mv "$entry" "./$(basename "$entry")"; done
rmdir v2
```

Confirm the root layout survived before going further — if `app/[locale]/layout.tsx` no longer
contains `<html`, the loop clobbered it and the move must be reverted:

```bash
grep -c '<html' layout.tsx   # expect 1
```

- [ ] **Step 3: Rewrite every remaining `/v2` reference**

```bash
grep -rl '/v2' app components lib i18n tools --include='*.ts' --include='*.tsx'
```

For each hit, remove the `/v2` prefix from the href, the `pathPrefix`, or the string. Two call sites need judgement rather than a blind replace:

- `components/v2/v2-header.tsx` `pathPrefix="/v2"` → `pathPrefix="/"`; check how `SearchCombobox` composes it so the result is not `//turkiye`.
- `app/sitemap.ts`'s two `/v2/dunya/kita` entries become `/dunya/kita`, which means the continent hub now belongs in the sitemap on the same terms as every other hub — confirm its `ContentSurface` is right rather than leaving `"trOnly"` unexamined.

Then confirm nothing is left:

```bash
grep -rn '/v2' app components lib i18n tools --include='*.ts' --include='*.tsx' | grep -v '\.test\.'
```

Expected: no output.

- [ ] **Step 4: Update the tests that encode route shapes**

`components/route-urls.test.ts`, `lib/seo/routes.fixture.ts` (`ROUTE_FIXTURES`, `NOINDEX_ROUTE`) and the `lib/seo/*` route tests carry `/v2` paths. Update them to the new paths. `NOINDEX_ROUTE` in particular pointed at a V2 route that is no longer noindex — repoint it at a route that genuinely is (an `AUTH_PATHNAMES` member or an `/oyun` mode screen).

- [ ] **Step 5: Remove the blanket `noindex`**

Delete the `metadata.robots` block that the V2 layout carried. V2 is the public site now. Routes that must stay out of the index keep their own `surface: "noindex"` — that is `AUTH_PATHNAMES` and the `/oyun` mode screens, both already handled per-route.

- [ ] **Step 6: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green. Any remaining failure is a missed reference, not a flaky test.

- [ ] **Step 7: Do not commit yet** — lands with Task 14.

## Task 14: Consolidate chrome into `(site)` and `(play)` route groups

`V2Header` and `V2Footer` take no props and are copied into 30 and 28 page files. Three routes omit them deliberately (the fullscreen game surfaces); two omit the footer by apparent oversight; 13 render no `<main>` while the root layout already wraps `children` in one, so the 20 that do render `<main>` nest it. Fix all of that structurally.

**Files:**

- Create: `app/[locale]/(site)/layout.tsx`
- Create: `app/[locale]/(play)/layout.tsx`
- Modify: `app/[locale]/layout.tsx`
- Move: every route directory into one of the two groups
- Modify: all 33 page files (remove the per-page chrome)

- [ ] **Step 1: Slim the root layout**

Remove `SiteHeader`, `SiteFooter`, `AuthMount`, the skip link and the `<main>` wrapper. What remains is the document shell:

```tsx
export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${fraunces.variable} ${nunitoSans.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

`generateStaticParams`, `generateMetadata` and `viewport` stay exactly as they are.

- [ ] **Step 2: Create the `(site)` layout**

```tsx
// app/[locale]/(site)/layout.tsx
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { V2Header } from "@/components/v2/v2-header";
import { V2Footer } from "@/components/v2/v2-footer";
import { V2AuthDialog } from "@/components/v2/v2-auth-dialog";

interface SiteLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: Locale }>;
}

/**
 * The chrome every reading surface shares. Header, footer, the skip link and the single
 * `<main>` live here rather than in 30 page files, so a new page cannot ship without them
 * and the previous nested-`<main>` defect cannot recur.
 *
 * The fullscreen game screens opt out by living in the sibling `(play)` group — a
 * structural choice of directory, not an omitted import somebody has to remember.
 */
export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Common");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:font-semibold focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>
      <div>
        <V2Header />
        {/* tabIndex={-1} makes the skip-link target programmatically focusable so AT focus
            actually moves here on activation — Safari/VoiceOver do not focus a plain id
            target otherwise. Carried over from the V1 root layout unchanged. */}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <V2Footer />
      <V2AuthDialog />
    </div>
  );
}
```

- [ ] **Step 3: Create the `(play)` layout**

```tsx
// app/[locale]/(play)/layout.tsx
import type { ReactNode } from "react";

/**
 * Fullscreen play surfaces. No header, no footer, no shared `<main>`: T-015 gave these
 * screens a fullscreen mode and a best-effort landscape lock, and site chrome fights both.
 * The three routes below are the only members; anything else belongs in `(site)`.
 */
export default function PlayLayout({ children }: { readonly children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
```

- [ ] **Step 4: Move the routes into the groups**

```bash
cd "app/[locale]"
mkdir -p "(site)" "(play)"
git mv page.tsx turkiye dunya deniz deprem kitaplar araclar giris kayit profil hesabim \
  hakkimizda sifre-sifirlama e-posta-dogrulama not-found.tsx error.tsx "(site)/"
mkdir -p "(play)/oyun/bolge-bolge-il"
git mv oyun/bolge-bulma oyun/81-il "(play)/oyun/"
git mv "oyun/bolge-bolge-il/[bolge]" "(play)/oyun/bolge-bolge-il/"
git mv oyun "(site)/oyun"
```

Route groups do not appear in URLs, so every path is unchanged. Two groups may not resolve the _same_ path — `(site)/oyun/bolge-bolge-il/page.tsx` and `(play)/oyun/bolge-bolge-il/[bolge]/page.tsx` are different paths, which is allowed. If Next rejects the arrangement, put the whole `/oyun` subtree in `(play)` and have the two hub pages render `V2Header`/`V2Footer` themselves rather than fighting the router.

- [ ] **Step 5: Strip the per-page chrome**

In all 33 page files, delete the `V2Header`, `V2Footer` and `V2AuthDialog` renders and their imports, plus the outer `min-h-screen bg-background text-foreground flex flex-col justify-between` wrapper the layout now owns. In the 20 pages that render their own `<main>`, delete that element too — the layout supplies it. Keep `V2LiveTicker` where it is; it is a per-page element, not chrome.

```bash
grep -rn "V2Header\|V2Footer" "app/[locale]"   # expect only the two layouts
```

- [ ] **Step 6: Write the structure test**

```ts
// components/v2/v2-chrome-consolidation.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = fileURLToPath(new URL("../../app/[locale]", import.meta.url));

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

const PAGES = pageFiles(APP);

describe("T-032 chrome consolidation", () => {
  it("found a non-trivial number of pages — positive control", () => {
    expect(PAGES.length).toBeGreaterThan(25);
  });

  it("no page renders chrome itself; the group layouts own it", () => {
    for (const page of PAGES) {
      const source = readFileSync(page, "utf8");
      expect(source, page).not.toContain("<V2Header");
      expect(source, page).not.toContain("<V2Footer");
    }
  });

  it("no page renders its own <main>; the (site) layout owns the only one", () => {
    for (const page of PAGES) {
      expect(readFileSync(page, "utf8"), page).not.toContain("<main");
    }
  });

  it("exactly one skip-link target exists", () => {
    const site = readFileSync(join(APP, "(site)", "layout.tsx"), "utf8");
    expect(site).toContain('id="main-content"');
    expect(site).toContain("tabIndex={-1}");
  });
});
```

- [ ] **Step 7: Run everything**

Run: `pnpm vitest run components/v2/v2-chrome-consolidation.test.ts && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 8: Verify the play routes really have no chrome**

Screenshot `/oyun/81-il` and `/oyun/bolge-bulma` at 390 px landscape. No header, no footer, fullscreen behaviour and the landscape lock from T-015 still work. Then screenshot `/turkiye/[any-slug]` and confirm the footer now appears — it was missing before this task.

- [ ] **Step 9: Do not commit yet** — lands with Task 15.

## Task 15: Redirects, the cross-repo tripwire, and the single migration commit

**Files:**

- Modify: `next.config.ts`
- Modify: `lib/seo/redirects.test.ts`
- Modify: `lib/seo/auth-routes.test.ts`
- Modify: `app/[locale]/(site)/not-found.tsx`, `app/[locale]/(site)/error.tsx`, `app/global-error.tsx`

- [ ] **Step 1: Add the prefix-strip redirects**

```ts
  async redirects() {
    return [
      {
        source: "/dunya/kibris-cumhuriyeti",
        destination: "/dunya/guney-kibris-rum-yonetimi",
        permanent: true,
      },
      // T-032: the `/v2` prefix is retired. NOT an SEO migration — the deployment is a bare
      // IP with no domain, no Search Console property and no inbound links, so none of these
      // URLs is indexed. These two entries exist only so the bookmarks accumulated during the
      // V2 build keep working. Permanent (308, method-preserving) because the prefix is never
      // coming back.
      { source: "/v2/:path*", destination: "/:path*", permanent: true },
      { source: "/en/v2/:path*", destination: "/en/:path*", permanent: true },
    ];
  },
```

- [ ] **Step 2: Update the redirects guard**

In `lib/seo/redirects.test.ts`, change the entry-count assertion from `toHaveLength(1)` to `toHaveLength(3)`. Its docblock already anticipates this. Confirm the existing structural assertions still hold for wildcard entries — no self-redirect, no chain, root-relative destinations. If a wildcard entry trips an assertion written for literal paths, widen the assertion rather than exempting the entry.

- [ ] **Step 3: Write the cross-repo mail-path tripwire**

```ts
// append to lib/seo/auth-routes.test.ts
import { routing } from "@/i18n/routing";

/**
 * CROSS-REPO CONTRACT — `cografya_api/src/auth/mail/mail-copy.ts`.
 *
 * That file builds password-reset and verification links by joining these exact path
 * strings onto `WEB_ORIGIN`, and its own docblock says it mirrors this repo's `pathnames`
 * and that both sides must move together. Nothing in either CI enforces it: `openapi:check`
 * compares DTOs, not route names, so a rename here typechecks, lints, builds, and ships —
 * and the only symptom is that the link in a real user's password-reset mail 404s.
 *
 * T-032 preserved these paths deliberately while dropping the `/v2` prefix. This test is
 * what keeps that deliberate.
 */
describe("auth paths the API hard-codes in outbound mail", () => {
  const EXPECTED = {
    "/sifre-sifirlama": { tr: "/sifre-sifirlama", en: "/reset-password" },
    "/sifre-sifirlama/yeni": { tr: "/sifre-sifirlama/yeni", en: "/reset-password/new" },
    "/giris": { tr: "/giris", en: "/login" },
  } as const;

  it.each(Object.entries(EXPECTED))("%s keeps both localized segments", (key, segments) => {
    const entry = (routing.pathnames as Record<string, unknown>)[key];
    expect(entry, `${key} is missing from routing.pathnames`).toBeDefined();
    expect(entry).toEqual(segments);
  });

  it("positive control — a path the API does not use is not asserted here", () => {
    expect(Object.keys(EXPECTED)).not.toContain("/kayit");
  });
});
```

If `routing.pathnames` types resist the index access, read `i18n/routing.ts` with `readFileSync` and assert over the source text instead — the house form used elsewhere in this same file. Do not weaken the assertion to make the types happy.

- [ ] **Step 4: Restyle the shared boundaries**

`app/[locale]/(site)/not-found.tsx` and `error.tsx` still use `.container`, `.page`, `.lede`, `.btn` — classes PR4 deletes. Rewrite them in Tailwind. They now render inside the `(site)` layout, so they inherit header and footer and should render only their own content, not a second copy of the chrome. Delete `app/[locale]/v2/not-found.tsx` and `error.tsx` from Task 8, whose job these now do.

Strip any V1 import from `app/global-error.tsx`; it supplies its own `<html>/<body>` and must not reach for `components/site-*`.

- [ ] **Step 5: Verify redirects empirically**

Run `pnpm build && pnpm start`, then:

```bash
for u in /v2 /v2/turkiye /v2/oyun/81-il /en/v2/turkey; do
  printf '%s -> ' "$u"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "http://localhost:3000$u"
done
```

Expected: every line `308` with the prefix-free destination. Then confirm the destinations themselves are `200`:

```bash
for u in / /turkiye /oyun/81-il /en/turkey /sifre-sifirlama /hakkimizda; do
  printf '%s -> ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000$u"
done
```

- [ ] **Step 6: Diff the sitemap**

```bash
curl -s http://localhost:3000/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sort > /tmp/sitemap-after.txt
grep -c '/v2' /tmp/sitemap-after.txt   # expect 0
```

Check every URL in the file resolves `200`. A sitemap entry that 404s is worse than a missing one.

- [ ] **Step 7: Re-measure `--header-height`**

`app/globals.css` sets `--header-height: 3.5rem`, measured against the V1 sticky header. Three of its five documented readers are gone; the survivors are the marine and climate anchor offsets in adopted Group C modules, which must now clear `V2Header`.

```js
// in the Playwright MCP session, after document.fonts.ready
document.querySelector("header")?.getBoundingClientRect().height;
```

Measure at 320, 390 and desktop. If the value differs from 56 px, update the token and extend `components/anchor-offset-token.test.ts` to pin the new number. Then follow a real `#fragment` link on a province page and confirm the target lands below the header, not under it.

- [ ] **Step 8: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 9: Commit Tasks 12–15 as one commit**

```bash
git add -A
git commit -m "feat!: retire the /v2 prefix and delete V1 routes

V2 becomes the public indexed site. The /v2 prefix is dropped, V1's 26
routes are deleted, page chrome moves into (site)/(play) route groups,
and the blanket noindex is removed.

The three auth paths cografya_api hard-codes in outbound mail are
preserved unchanged and are now pinned by a test."
```

## Task 16: Update the freeze rules in the docs

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/design.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Rewrite the V2-only rule in `CLAUDE.md`**

The "V2 only — V1 routes, `components/site-*` and every `*.module.css` are frozen" rule describes a repo that no longer exists. Replace it with what is now true: there is one UI; six component directories (`air`, `book`, `climate`, `earthquake`, `marine`, `site-search`) still carry CSS modules and are awaiting the T-033 design port; new work is Tailwind + `components/ui`.

Keep `CLAUDE.md` under ~80 lines. If the rewrite pushes it over, move detail to `docs/architecture.md`.

- [ ] **Step 2: Update `docs/design.md`**

Its "Dark mode (current state)" section describes V1 staying light and V2 escaping tokens — both obsolete. Correct the factual claims. Do not write the new dark-mode design here; that is T-031b.

- [ ] **Step 3: Update `docs/architecture.md`**

The V1/V2 split section becomes a description of the route-group structure and the Group C backlog.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/design.md docs/architecture.md
git commit -m "docs: retire the V1/V2 split from the repo rules"
```

---

# PR4 — Dead-code removal

Branch: `feature/t032-pr4-dead-code`. Depends on PR3. Deliberately separate so PR3's diff stays reviewable.

## Task 17: Extract the three survivors from Group A

**Files:**

- Create: `lib/game/region-labels.ts` (moved)
- Create: `lib/home/featured-card-item.ts`
- Create: `lib/tools/province-area.ts`
- Modify: the 7 import sites

- [ ] **Step 1: Move `region-labels.ts`**

```bash
git mv components/game/region-labels.ts lib/game/region-labels.ts
```

It imports `getTranslations` and `@/lib/game/target` — it was never a component. Update the four importing pages under `/oyun` to `@/lib/game/region-labels`.

- [ ] **Step 2: Extract `FeaturedCardItem`**

Create `lib/home/featured-card-item.ts` containing only the interface, copied verbatim from `components/home/featured-cards.tsx:5`. Update the import in the home page.

- [ ] **Step 3: Extract `ProvinceArea`**

Create `lib/tools/province-area.ts` containing only the interface, copied verbatim from `components/tools/tool-island.tsx:68`. Update the two importers (`araclar/koordinat-bulma/page.tsx` and `components/v2/v2-tool-workbench.tsx`).

- [ ] **Step 4: Confirm nothing else reaches into those directories**

```bash
grep -rn "@/components/game/\|@/components/home/\|@/components/tools/" app components lib tools
```

Expected: no output.

- [ ] **Step 5: Delete the three directories**

```bash
git rm -r components/game components/home components/tools
```

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add -A
git commit -m "refactor: move surviving helpers to lib and delete Group A components"
```

## Task 18: Retire `components/map/`

**Files:**

- Modify: `app/[locale]/(site)/dunya/[slug]/page.tsx`
- Delete: `components/map/`, `components/marine/marine-map.tsx`, `components/tools/tool-map.tsx` (if not already gone with Task 17)

- [ ] **Step 1: Check what `LocatorMap` gives `/dunya/[slug]`**

Read `components/map/locator-map.tsx` (149 lines) and `components/v2/v2-continent-locator-map.tsx` (183 lines) side by side. The V2 component is the same idea rebuilt; confirm it can take the country's coordinates and render the same locator.

- [ ] **Step 2: Migrate the page**

Replace the `LocatorMap` render with the V2 locator. Keep the map attribution — `docs/design.md` requires "© OpenStreetMap katkıcıları, ODbL" beside every map, and `components/map/locator-attribution.test.ts` is the existing guard. If that test lives in the deleted directory, port its assertion to a V2 test rather than dropping it.

**If the V2 component genuinely cannot serve this page**, stop: adopt `locator-map.tsx` plus its module into `components/v2/`, note it for T-033, and delete the rest of `components/map/`. Do not expand this task into a rewrite.

- [ ] **Step 3: Confirm the directory is unreferenced**

```bash
grep -rn "@/components/map/" app components lib tools
```

Expected: no output.

- [ ] **Step 4: Delete it**

```bash
git rm -r components/map
```

- [ ] **Step 5: Screenshot `/dunya/[slug]`**

The locator must still render, still carry attribution, and still look right at 320 px.

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add -A
git commit -m "refactor(map): migrate the country locator to V2 and delete components/map"
```

## Task 19: Delete the remaining V1 components and CSS

**Files:**

- Delete: `components/site-header*`, `components/site-footer*`, `components/site-nav/`, `components/auth/`, `components/country/`, `components/entity-index/`, `components/favorites/`, `components/province/`, `components/breadcrumb.tsx`, `components/en-work-in-progress-notice*`, `components/card-arrow*`, `components/prose-note.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Check each directory is unreferenced first**

```bash
for d in site-header site-footer site-nav auth country entity-index favorites province breadcrumb en-work-in-progress-notice card-arrow prose-note; do
  printf '%s: ' "$d"
  grep -rn "@/components/$d" app components lib tools | grep -v '\.test\.' | wc -l
done
```

Every line must read `0`. A non-zero line is a missed migration, not a reason to force the delete.

`components/auth/` is the one to check most carefully: `lib/auth/**` stays (the three ported cards depend on it), only the component layer goes.

- [ ] **Step 2: Delete them**

```bash
git rm -r components/site-nav components/auth components/country components/entity-index \
  components/favorites components/province
git rm components/site-header.tsx components/site-header.module.css \
  components/site-footer.tsx components/site-footer.module.css \
  components/breadcrumb.tsx components/prose-note.tsx \
  components/card-arrow.tsx components/card-arrow.module.css \
  components/en-work-in-progress-notice.tsx components/en-work-in-progress-notice.module.css \
  components/en-work-in-progress-notice.test.ts components/nav-collapse-breakpoint.test.ts
```

- [ ] **Step 3: Delete the V1 utility classes from `app/globals.css`**

Remove `.container`, `.page`, `.section`, `.lede`, `.card`, `.chip`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.hero`, `.hero .lede`, `.hero h1`, the `max-width: 360px` hero media query, `.hero-actions`, `.province-grid`, `.province-grid > li`, `.province-card`, `.breadcrumb` and its children, `.placeholder-note`, `.wrap-long-tokens`, `.skip-link` and `.skip-link:focus`, the `--btn-sm-*` tokens, and the `body:has(.v2-app) > header, footer` suppression rule.

Keep: every `--color-*` and data token, `:focus-visible`, the `:where([tabindex="-1"])` exemption, the `prefers-reduced-motion` block, `@theme inline`, the `.dark` block, `.climate-dark-scope`, and the `@layer base`/`@layer utilities` blocks.

`.climate-dark-scope` stays because `components/climate/` is Group C and still ships its module. T-033 removes both together.

- [ ] **Step 4: Write the absence tripwire**

```ts
// components/v1-removal.test.ts
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const GLOBALS = readFileSync(at("../app/globals.css"), "utf8");

/**
 * T-032 removed V1. These assertions exist because a deleted thing can come back by
 * accident — a revert, a stale branch, a copy-paste from an old file — and nothing else in
 * the suite would notice. Same shape as `components/anchor-offset-token.test.ts`, which
 * asserts a retired token's ABSENCE for the same reason.
 */
describe("V1 stays removed", () => {
  it.each([
    "./site-header.tsx",
    "./site-footer.tsx",
    "./breadcrumb.tsx",
    "./site-nav",
    "./auth",
    "./country",
    "./entity-index",
    "./favorites",
    "./province",
    "./game",
    "./home",
    "./tools",
    "./map",
  ])("%s is gone", (rel) => {
    expect(existsSync(at(rel))).toBe(false);
  });

  it.each([
    ".container",
    ".lede",
    ".btn-primary",
    ".province-grid",
    ".placeholder-note",
    "--btn-sm-padding",
    "body:has(.v2-app)",
  ])("globals.css no longer defines %s", (token) => {
    expect(GLOBALS).not.toContain(token);
  });

  it("positive control — globals.css is a real, non-trivial read", () => {
    expect(GLOBALS).toContain("--color-primary");
    expect(GLOBALS.length).toBeGreaterThan(5000);
  });
});
```

- [ ] **Step 4a: Note on `.container`**

Tailwind has its own `container` utility, so assert on the literal CSS rule text rather than the bare word if the assertion above produces a false positive. Adjust to `expect(GLOBALS).not.toMatch(/^\.container\s*\{/m)` — but only after confirming the plain assertion actually fails.

- [ ] **Step 5: Run the test and the gate**

Run: `pnpm vitest run components/v1-removal.test.ts && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 6: Full-site visual sweep**

Screenshot every top-level route at 320 px and desktop. Nothing may show an unstyled element where a V1 class used to apply. Pay attention to the six Group C surfaces — `/turkiye/[slug]` (climate, air, earthquake, marine sections), `/kitaplar/[slug]` (book bench) and the header search — since those modules survive and may have leaned on a deleted global.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: delete the remaining V1 components and utility CSS"
```

## Task 20: Final verification and PR

- [ ] **Step 1: Confirm no `/v2` and no V1 import survives**

```bash
grep -rn '/v2' app components lib i18n tools --include='*.ts' --include='*.tsx'
grep -rn '@/components/\(site-\|auth/\|country/\|province/\|favorites/\|entity-index/\|game/\|home/\|tools/\|map/\)' app components lib tools
```

Expected: no output from either.

- [ ] **Step 2: Count what remains**

```bash
find components -name '*.module.css' | sort
```

Expected: only Group C's modules (`air`, `book`, `climate`, `earthquake`, `marine`, `site-search`). That list is T-033's worklist — paste it into the PR description.

- [ ] **Step 3: Full gate plus a production build**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

- [ ] **Step 4: Open the PR against `dev`**

Target `dev`, never `main`. Launch timing is the owner's separate call (2026-09-17) and
nothing in this task waits on it — but do not merge to `main` yourself, because that merge
_is_ the launch.

Carry one fact into the PR description so it is not rediscovered later: without TLS, `Secure`
cookies are not stored and `crypto.randomUUID` is unavailable, so login persistence,
favourites and every game mode remain broken until T-019 lands. That is equally true of V1
today, so it is a limitation the launch inherits, not a regression it introduces.

---

## Self-Review

**Spec coverage.** §3 route inventory → Tasks 5, 6, 12, 13. §4 URL migration → Tasks 12, 13, 15. §5 cross-repo contract → Task 15 Step 3. §6 Group A → Task 17; Group B → Task 18; Group C adoption → Task 16 Step 1 and Task 20 Step 2; "also deleted" → Task 19. §7 error boundaries → Tasks 7, 8, 15 Step 4. §8 layout consolidation → Task 14. §9 product work → Tasks 9, 10, 11; launch gating → Task 20 Step 4. §11 PR decomposition → the four PR headings. §12 verification → the gate steps plus Tasks 15 and 20. §13 risks: migration size → Task 13 Step 3 and Task 20 Step 1; mail paths → Task 15 Step 3; locator map → Task 18 Step 2's explicit stop condition; `--header-height` → Task 15 Step 7. No gap found.

**Placeholders.** None. Two steps carry deliberate conditional branches rather than placeholders — Task 18 Step 2 ("if the V2 component cannot serve this page, adopt and defer") and Task 19 Step 4a ("adjust only after confirming the plain assertion fails") — both state the condition and the action for each outcome.

**Type consistency.** `V2TextField` / `V2FormErrorRegion` are defined in Task 1 and consumed under those names in Tasks 2–4. `V2EnWorkInProgressNotice` is defined in Task 9 and asserted under that name in its own test. `AUTH_PATHNAMES` members added in Task 5 are stripped in Task 12 Step 3, consistently with the `buildAuthMetadata({ pathname })` calls written in Task 5 Step 3 and amended in Task 12 Step 4.

**Two corrections made during this review, both from checking the source rather than trusting the draft:**

1. The first draft had Task 10 _create_ `lib/marine/data-availability.ts`. That module would have been a duplicate: `marineShowsValues` already exists in `lib/marine/overview.ts`, is already consumed by `/v2/deniz` and V1 `/deniz`, and is already unit-tested through `lib/home/marine-summary.test.ts`. Both tasks were subsequently cut altogether (revision 4 below); the duplicate module was never written.
2. That draft also guessed `MarineOverviewPoint.seaSurfaceTemperatureC`. The real field is `seaSurfaceTemperature: MarineValueDto` (`lib/api/schema.ts:2226`), and the payload carries its own `dataAvailable` flag. The guess is gone with the module that held it.

**Owner revisions, 2026-09-17 (two rounds after the first review pass):**

1. **Feature flags go on in production.** New Task 11a covers the flip as an ops action, not
   a PR, since `docker-compose.prod.yml` lives on the host rather than in either repo. The
   `ADS_API_KEY`-before-`AIR_QUALITY_ENABLED` ordering there is load-bearing: the reverse
   order fails env validation at boot and crashloops the API.
2. **`/hakkimizda` gets a real V2 design pass** (Task 6 Step 2), not a transcription. Copy
   still moves verbatim.
3. **Launch timing is no longer a documented gate.**
4. **Nothing is riding on the current deployment.** The site is on a bare IP, unannounced,
   with no audience. Steps whose only justification was protecting live users are cut:
   - Tasks 10 and 11 (degraded-state copy) — deferred to T-033.
   - PR3's "must be atomic or the site breaks" framing — it is one commit for bisect sanity,
     not for uptime.
   - The `ADS_API_KEY` warning keeps the fact and drops the alarm.
5. **A premise correction.** Earlier drafts argued for preserving URLs because 26 of them
   were indexed. That was never checked and is almost certainly false: `app/robots.ts` allows
   crawling, but a bare IP with no domain has no Search Console property, no submitted
   sitemap and no inbound links. Paths are now preserved only where something concrete
   depends on them — in practice the three the API hard-codes (Task 15 Step 3).

**What survives the cut, and why** — these are quality, not caution. The cross-repo mail
tripwire (Task 15 Step 3): the failure is invisible and the test is four lines. The
`--header-height` re-measurement (Task 15 Step 7): silent breakage, no existing test catches
it. The root 404, the chrome consolidation and the flag-driven EN notice: each removes a
class of future mistake rather than guarding today's traffic.

**Verified against source, not assumed:** the `Button` API (Task 2), `Common.skipToContent` and `Common.enWorkInProgress` (Tasks 9, 14), the `NotFound` namespace keys `heading`/`body` (Tasks 7, 8), and `Auth.reset` / `Auth.verify` (Task 5). `Auth.breadcrumb.home` does **not** exist — Task 5 Step 3 says to add it to both message files rather than copy the hard-coded Turkish string that `v2/giris/page.tsx` currently inlines.
