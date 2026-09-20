# Member Account IA (T-061) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three doors to one half-built profile page with one activity hub and one settings page, give a signed-in member a real password-change path, and collect education data at registration instead of after it.

**Architecture:** The API widens `GET /auth/profile` to the whole personal block and gains two routes (`PUT /auth/account`, `POST /auth/password/change`); the password route is token-issuing, so it revokes other sessions via `tokenVersion` and hands the caller a fresh pair. The web consumes the regenerated contract through the existing BFF action table, then rebuilds the surfaces: a new `/hesabim/ayarlar` with four independent section cards, a hub stripped back to content, a two-step register wizard sharing one `EducationFieldset` with the settings page, and a single header account menu.

**Tech Stack:** NestJS 11 + TypeORM + class-validator + Swagger (api); Next.js 16 App Router, React 19, Tailwind v4, shadcn on Base UI, next-intl 4, vitest (web); jest + Testcontainers (api e2e).

**Spec:** `cografya_web/docs/superpowers/specs/2026-09-20-account-ia-design.md`

## Global Constraints

- Work on `dev` in both repos; each PR is `feature/*` → `dev`, squash-merged. Never push to `main`.
- Conventional Commits (commitlint hook is live in both repos).
- API: `synchronize` off. **The plan said "no migration is needed" and that was wrong.** Every
  COLUMN did already exist, but the signed-in password change needed an identity-axis rate-limit
  scope, and `auth_rate_limits.scope` is a DB-enforced closed set — widening
  `CHK_auth_rate_limits_scope` is a migration. It landed as
  `1789862400000-AddPasswordChangeRateLimitScope`, and it broke four e2e cases in suites that
  never mention it (see `cografya_api/CLAUDE.md`).
- API: every request DTO carries `class-validator` + `@nestjs/swagger` decorators; the global pipe is `whitelist + forbidNonWhitelisted + transform`.
- API: no user-facing prose. Error bodies carry i18n keys from `src/auth/auth-error-keys.ts`.
- API: auth is opt-in per route via `@UseGuards(AccessTokenGuard)`; PII routes also carry `@NoTrustedClientExemption()`. `AuthNoStoreMiddleware` is applied `.forRoutes(AuthController)`, so new controller routes inherit `no-store` with no extra registration.
- API: `GET /auth/session` stays the minimum-PII set (id, firstName, accountRole). Do not add fields to it.
- Web: one tree. New UI is Tailwind + `components/ui/*` under `app/[locale]/(site)/**` and `components/v2/**`. No `*.module.css` — `components/css-module-dark-safety.test.ts` enforces it.
- Web: `Button` has no `asChild`; a link that looks like a button is `<Link className={cn(buttonVariants({ variant, size }))}>`.
- Web: import `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation`.
- Web: every route needs a TR **and** EN entry in `i18n/routing.ts` `pathnames`.
- Web: colours come from bridge tokens only — no raw Tailwind palette class, no brand hex, no hand-written `dark:` (`components/ui/token-binding.test.ts`).
- Web: never hand-edit `lib/api/schema.ts`; regenerate with `pnpm codegen`.
- Web: new strings go to `messages/tr.json` **and** `messages/en.json` (`lib/auth/messages.test.ts` enforces parity).
- Web: a new component needs a `/design-system` specimen or `components/showcase/registry.test.ts` fails.
- Cross-repo: after any DTO/route change run `pnpm openapi:generate` in the api, copy `openapi/openapi.json` to the web repo by hand, then `pnpm codegen` there.
- Gates: api `pnpm typecheck && pnpm lint && pnpm test:unit` (+ `test:e2e` for touched modules); web `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm sweep:overflow` and a 320/360/390/desktop × light/dark Playwright pass for any visible change.

---

## PR 1 — API contract (repo: `cografya_api`, branch `feature/t061-account-api`)

### Task 1: Widen the profile read

**Files:**

- Modify: `src/auth/dto/profile.dto.ts`
- Modify: `src/auth/profile.service.ts:31-60` (`getProfile`)
- Modify: `src/auth/auth.controller.ts` (`@Get('profile')` description only)
- Test: `src/auth/profile.service.spec.ts` (create)

**Interfaces:**

- Produces: `ProfileDto` gains `firstName: string`, `lastName: string`, `email: string`, `phone: string`, `provincePlateCode: string`, `provinceName: string`, `districtId: string`, `districtName: string`, `createdAt: string` (ISO 8601), alongside the existing `accountRole`, six education fields and `isComplete`.

- [ ] **Step 1: Write the failing test**

`src/auth/profile.service.spec.ts` — a unit spec with a stubbed repository. Assert `getProfile` returns the personal block joined from `districts`/`provinces`:

```ts
it("returns the personal block alongside the education block", async () => {
  const dto = await service.getProfile(USER_ID);
  expect(dto.firstName).toBe("Ayşe");
  expect(dto.lastName).toBe("Yılmaz");
  expect(dto.email).toBe("reader@example.test");
  expect(dto.phone).toBe("+905551234567");
  expect(dto.provincePlateCode).toBe("34");
  expect(dto.provinceName).toBe("İstanbul");
  expect(dto.districtName).toBe("Kadıköy");
  expect(dto.createdAt).toBe("2026-01-02T03:04:05.000Z");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test:unit -- profile.service.spec`
Expected: FAIL — the properties do not exist on `ProfileDto`.

- [ ] **Step 3: Add the DTO properties**

Nine `@ApiProperty` members on `ProfileDto`, each with a Turkish `description` matching the file's existing voice. `createdAt` is `@ApiProperty({ format: 'date-time' })` typed `string`.

- [ ] **Step 4: Join the province and district in `getProfile`**

Replace the narrow `findOne` with a query builder that joins `districts` on `users.district_id` and `provinces` on `districts.province_id`, selecting only the columns the DTO needs. Keep `passwordHash` unselected. Return `createdAt: user.createdAt.toISOString()`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:unit -- profile.service.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/auth/dto/profile.dto.ts src/auth/profile.service.ts src/auth/profile.service.spec.ts src/auth/auth.controller.ts
git commit -m "feat(auth): widen GET /auth/profile to the personal block"
```

### Task 2: `PUT /auth/account`

**Files:**

- Create: `src/auth/dto/update-account-request.dto.ts`
- Modify: `src/auth/profile.service.ts` (add `replaceAccount`)
- Modify: `src/auth/auth.controller.ts` (new route + `AUTH_ROUTE_THROTTLES.updateAccount`)
- Test: `src/auth/profile.service.spec.ts`

**Interfaces:**

- Consumes: `ProfileDto` from Task 1.
- Produces: `UpdateAccountRequestDto { firstName: string; lastName: string; phone: string; provincePlateCode: string; districtId: string }`; `ProfileService.replaceAccount(userId: string, dto: UpdateAccountRequestDto): Promise<ProfileDto>`.

- [ ] **Step 1: Write the failing tests**

Three cases: a valid replacement returns the updated `ProfileDto`; a `districtId` that does not belong to `provincePlateCode` throws `BadRequestException`; `phone` is canonicalised (`05551112233` → `+905551112233`) before it is stored.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test:unit -- profile.service.spec`
Expected: FAIL — `replaceAccount` is not a function.

- [ ] **Step 3: Write the DTO**

Mirror `RegisterRequestDto`'s decorators exactly for the five fields it shares — the same `@Transform` canonicalisers (`canonicalizePhone`), the same `TURKISH_MOBILE_E164` and `PROVINCE_PLATE_CODE` patterns, the same `@MaxLength(100)` on the names, `@IsUUID('4')` on `districtId`. Do not re-invent the rules; import the canonicalisers.

- [ ] **Step 4: Implement `replaceAccount`**

Validate district-belongs-to-province in one query the way `RegistrationService` does (D15), then `users.update` by explicit column name — never spread the DTO. Return the freshly read `ProfileDto` by delegating to `getProfile`.

- [ ] **Step 5: Wire the route**

`@Put('account')` with `@UseGuards(AccessTokenGuard)`, `@NoTrustedClientExemption()`, `@ApiBearerAuth('access-token')`, `@Throttle({ default: AUTH_ROUTE_THROTTLES.updateAccount })` (`{ limit: 30, ttl: 15 * 60 * 1000 }`), `@ApiOkResponse({ type: ProfileDto })`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`.

- [ ] **Step 6: Run the tests**

Run: `pnpm test:unit -- profile.service.spec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/auth/dto/update-account-request.dto.ts src/auth/profile.service.ts src/auth/profile.service.spec.ts src/auth/auth.controller.ts
git commit -m "feat(auth): add PUT /auth/account for the personal block"
```

### Task 3: `POST /auth/password/change`

**Files:**

- Create: `src/auth/dto/password-change-request.dto.ts`
- Create: `src/auth/password-change.service.ts`
- Create: `src/auth/password-change.service.spec.ts`
- Modify: `src/auth/auth-error-keys.ts`
- Modify: `src/auth/auth.controller.ts`
- Modify: `src/auth/auth.module.ts` (provider)

**Interfaces:**

- Produces: `PasswordChangeRequestDto { currentPassword: string; newPassword: string }`; `PasswordChangeService.change(userId: string, currentPassword: string, newPassword: string): Promise<AuthResultDto>`; two new keys `AUTH_ERROR_KEYS.passwordCurrentInvalid = 'errors.password.currentInvalid'` and `AUTH_ERROR_KEYS.passwordUnchanged = 'errors.password.unchanged'`.

- [ ] **Step 1: Write the failing tests**

```ts
it("rejects a wrong current password with errors.password.currentInvalid", async () => {
  await expect(service.change(USER_ID, "wrong", "NewPass1")).rejects.toMatchObject({
    response: "errors.password.currentInvalid",
  });
});

it("rejects a new password equal to the current one", async () => {
  await expect(service.change(USER_ID, "Current1", "Current1")).rejects.toMatchObject({
    response: "errors.password.unchanged",
  });
});

it("bumps tokenVersion, revokes live sessions and returns a fresh pair", async () => {
  const result = await service.change(USER_ID, "Current1", "NewPass1");
  expect(increment).toHaveBeenCalledWith(User, { id: USER_ID }, "tokenVersion", 1);
  expect(result.accessToken).toEqual(expect.any(String));
  expect(result.refreshToken).toEqual(expect.any(String));
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test:unit -- password-change.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the two error keys**

Extend `AUTH_ERROR_KEYS` and update its docblock's "ten keys, no more" count to twelve, naming why each new key exists.

- [ ] **Step 4: Write the DTO**

`currentPassword` is `@IsString() @IsNotEmpty()` and `writeOnly` — **not** `@IsPasswordPolicyCompliant()`, because a password set before a policy change must still be presentable. `newPassword` carries `@IsPasswordPolicyCompliant()`.

- [ ] **Step 5: Implement the service**

Read the user with `addSelect('user.passwordHash')` exactly as `SessionService.login` does. Verify with `PasswordHasherService.verify`, catching `PasswordHashVerificationError` into the same fail-closed branch with a `logger.warn('password-change.verify outcome=hash-integrity-failure')` line carrying no interpolation. Then, in one `dataSource.transaction`: `increment(User, …, 'tokenVersion', 1)`, `update(User, …, { passwordHash })`, and revoke live sessions with `revokedReason: SessionRevocationReason.PasswordReset`. After the transaction, mint a fresh pair for the caller. Reuse `SessionService`'s minting rather than duplicating it — inject `SessionService` and expose a narrow internal method for it.

- [ ] **Step 6: Wire the route and the provider**

`@Post('password/change')` with `@HttpCode(200)`, `@UseGuards(AccessTokenGuard)`, `@NoTrustedClientExemption()`, `@ApiBearerAuth('access-token')`, `@Throttle({ default: AUTH_ROUTE_THROTTLES.passwordChange })` (`{ limit: 10, ttl: 15 * 60 * 1000 }` — it accepts a password guess), `@ApiOkResponse({ type: AuthResultDto })`. Register `PasswordChangeService` in `AuthModule`.

- [ ] **Step 7: Run the tests**

Run: `pnpm test:unit -- password-change.service.spec`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/auth/dto/password-change-request.dto.ts src/auth/password-change.service.ts src/auth/password-change.service.spec.ts src/auth/auth-error-keys.ts src/auth/auth.controller.ts src/auth/auth.module.ts
git commit -m "feat(auth): add POST /auth/password/change for signed-in members"
```

### Task 4: e2e coverage and the regenerated contract

**Files:**

- Modify: `test/auth-security.e2e-spec.ts` (or a new `test/account.e2e-spec.ts` if the former is already long)
- Modify: `openapi/openapi.json` (generated)

- [ ] **Step 1: Write the e2e cases**

Against a real Postgres: (a) `PUT /auth/account` without a bearer token is 401; (b) a member cannot write another member's row — the route ignores any id in the body because it takes the id from the token; (c) after `POST /auth/password/change`, the caller's **old** access token is rejected while the returned one works; (d) the old password no longer logs in and the new one does.

- [ ] **Step 2: Run the e2e lane**

Run: `pnpm test:e2e -- auth`
Expected: PASS (Docker must be running).

- [ ] **Step 3: Regenerate the contract**

Run: `pnpm openapi:generate`
Expected: `openapi/openapi.json` gains the two paths and the nine profile properties.

- [ ] **Step 4: Full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit`
Expected: all green.

- [ ] **Step 5: Commit and open the PR**

```bash
git add test openapi/openapi.json
git commit -m "test(auth): cover the account and password-change routes end to end"
gh pr create --base dev --title "T-061 PR1: account and password-change contract" --body "…"
```

---

## PR 2 — Web contract sync and BFF (repo: `cografya_web`, branch `feature/t061-account-bff`)

### Task 5: Copy the spec and regenerate

**Files:**

- Modify: `openapi/openapi.json`, `lib/api/schema.ts` (both generated)
- Modify: `lib/api/types.ts`

- [ ] **Step 1: Copy and codegen**

```bash
cp ../cografya_api/openapi/openapi.json openapi/openapi.json
pnpm codegen
pnpm codegen:check
```

- [ ] **Step 2: Alias the new types once**

In `lib/api/types.ts`, add `UpdateAccountRequest` and `PasswordChangeRequest` aliases next to the existing `Profile` / `UpdateProfileRequest`.

- [ ] **Step 3: Commit**

```bash
git add openapi/openapi.json lib/api/schema.ts lib/api/types.ts docs/superpowers
git commit -m "chore(api): sync the account contract and regenerate the client"
```

### Task 6: BFF transports

**Files:**

- Modify: `lib/auth/transport.server.ts` (action table, error-code union, token-issuing branch)
- Modify: `lib/auth/submit.client.ts` (`AuthAction` union)
- Modify: `lib/profile/transport.server.ts`, `lib/profile/client.ts`
- Create: `app/api/account/route.ts`
- Test: `lib/auth/transport.server.test.ts`, `lib/profile/client.test.ts`

**Interfaces:**

- Produces: auth action `"password/change"` → `POST /api/auth/password/change`, token-issuing like `login`; `handleReplaceAccount(request: Request)` in `lib/profile/transport.server.ts`; `PUT /api/account` BFF route.

- [ ] **Step 1: Write the failing tests**

Assert the action table contains `password/change` and maps to the api path; assert the two new api error keys are members of the closed `API_ERROR_CODES` array; assert `password/change` goes through the token-issuing branch so the response can carry `Set-Cookie`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test -- transport.server`
Expected: FAIL.

- [ ] **Step 3: Extend the tables**

Add the action, add `"errors.password.currentInvalid"` and `"errors.password.unchanged"` to `API_ERROR_CODES`, and add the action to the token-issuing handler's union alongside `login` and `verify-email`. Update the "closed set of ten actions" comment to the new count — the comment is load-bearing documentation here.

- [ ] **Step 4: Add the account BFF route**

`app/api/account/route.ts` exporting `PUT`, delegating to `handleReplaceAccount`, with `dynamic = "force-dynamic"`, `fetchCache = "force-no-store"`, `runtime = "nodejs"` — mirroring `app/api/profile/route.ts` exactly.

- [ ] **Step 5: Run the gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit and open the PR**

```bash
git add lib app/api docs/superpowers
git commit -m "feat(auth): route the account and password-change calls through the BFF"
gh pr create --base dev --title "T-061 PR2: contract sync and BFF" --body "…"
```

---

## PR 3 — Settings page and hub cleanup (repo: `cografya_web`, branch `feature/t061-settings`)

### Task 7: `EducationFieldset`

**Files:**

- Create: `components/v2/education-fieldset.tsx`
- Test: `components/v2/education-fieldset.test.tsx`
- Modify: `components/showcase/registry.ts` + a specimen

**Interfaces:**

- Produces: `EducationFieldset` taking `{ value: EducationSelection; onChange: (next: EducationSelection) => void; errors: Partial<Record<EducationFieldKey, string>>; idPrefix: string; universities: string[]; departments: string[] }` where `EducationSelection = { educationLevel: EducationLevel | ""; gradeLevel: GradeLevel | ""; studyStream: StudyStream | ""; schoolName: string; universityName: string; departmentName: string }`.

- [ ] **Step 1: Write the failing test** — assert the dependent-field matrix: `SECONDARY` shows grade + stream + optional school and hides university/department; `UNDERGRADUATE` and `GRADUATE` show university/department and hide the secondary trio; changing level clears the fields the new branch does not use.
- [ ] **Step 2: Run it and watch it fail.** Run: `pnpm test -- education-fieldset`
- [ ] **Step 3: Extract the component** from `components/v2/v2-profile-form.tsx:120-200`'s field logic, parameterising the element ids by `idPrefix` so two mounts on one page never collide.
- [ ] **Step 4: Run the test to verify it passes.**
- [ ] **Step 5: Add the `/design-system` specimen** and run `pnpm test -- registry`.
- [ ] **Step 6: Commit.** `git commit -m "refactor(profile): extract EducationFieldset for reuse"`

### Task 8: The settings page

**Files:**

- Create: `app/[locale]/(site)/hesabim/ayarlar/page.tsx`
- Create: `components/v2/v2-account-settings.tsx` (shell + section nav)
- Create: `components/v2/v2-settings-personal-card.tsx`
- Create: `components/v2/v2-settings-education-card.tsx`
- Create: `components/v2/v2-settings-password-card.tsx`
- Create: `components/v2/v2-settings-account-card.tsx`
- Modify: `i18n/routing.ts`, `messages/tr.json`, `messages/en.json`
- Test: `components/v2/v2-account-settings.test.ts`

- [ ] **Step 1: Write the failing test** — assert all four sections are present for a `STUDENT`, that a `TEACHER` gets exactly three (no education card), and that no section renders a logout control.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Add the route entry** — `"/hesabim/ayarlar": { tr: "/hesabim/ayarlar", en: "/account/settings" }`.
- [ ] **Step 4: Build the four cards**, each with its own submit and its own `role="status"` result line. The password card posts through `submitAuth("password/change", …)`; the personal card `PUT /api/account`; the education card the existing `PUT /api/profile`.
- [ ] **Step 5: Build the page** — server component, `getSession()` + `readProfileForPage()`, redirect to `/giris` when unauthenticated, `PageContainer` + `Breadcrumbs`, `force-dynamic`.
- [ ] **Step 6: Add every string to both message files** and run `pnpm test -- messages`.
- [ ] **Step 7: Run the gate and the visual pass** — `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm sweep:overflow --filter=hesabim` and Playwright at 320/360/390/desktop × light/dark.
- [ ] **Step 8: Commit.**

### Task 9: Redirect `/profil` and strip the hub

**Files:**

- Modify: `app/[locale]/(site)/profil/page.tsx` (becomes a redirect)
- Delete: `components/v2/v2-profile-form.tsx` (its fields now live in `EducationFieldset` and the education card)
- Modify: `components/v2/v2-member-hub.tsx` (remove hero logout, remove the fifth tab, retarget the hero CTA)
- Modify: `components/v2/v2-member-hub.test.ts`

- [ ] **Step 1: Update the hub test first** — four panels, not five; assert the hub source contains no logout handler and that the hero links to `/hesabim/ayarlar`.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Strip the hub** — delete the `profile` `TabsContent` and its `TabsTrigger`, delete `handleSignOut` and the `Güvenli Çıkış` button, replace `Profili Düzenle` with a single `Ayarlar` link built from `buttonVariants`.
- [ ] **Step 4: Turn `/profil` into a redirect** — keep the `pathnames` entry, replace the page body with `redirect(getPathname({ locale, href: "/hesabim/ayarlar" }))`.
- [ ] **Step 5: Delete `v2-profile-form.tsx`** and any now-orphaned test; run `pnpm test -- orphan` to confirm nothing dangles.
- [ ] **Step 6: Run the gate and the visual pass.**
- [ ] **Step 7: Commit and open the PR.**

---

## PR 4 — Registration wizard (repo: `cografya_web`, branch `feature/t061-register-wizard`)

### Task 10: Two steps and education at registration

**Files:**

- Modify: `components/v2/v2-register-card.tsx`
- Modify: `components/v2/v2-register-card.structure.test.ts`
- Modify: `lib/auth/form-rules.ts` (`buildRegisterPayload`)
- Test: `lib/auth/form-rules.contract.test.ts`

- [ ] **Step 1: Write the failing tests** — `buildRegisterPayload` carries the six education fields for a student and **omits every one of them** for a teacher (the api's profile matrix rejects a teacher carrying any education field); the card exposes three steps and a teacher never reaches the education one.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Extend `buildRegisterPayload`** with the education block, branching on `userType`.
- [ ] **Step 4: Split the card into `"identity" | "education" | "verify"`**, mounting `EducationFieldset` in step 2 with `idPrefix="v2-register"`, and skipping straight from identity to verify for a teacher. The step counter reads 1/1 for a teacher and 1/2, 2/2 for a student.
- [ ] **Step 5: Retarget the post-verification return** from `/profil` to `/hesabim` (`v2-register-card.tsx:280`).
- [ ] **Step 6: Run the gate and the visual pass.**
- [ ] **Step 7: Walk the real flow** — register a student and a teacher against the dev stack, verify with the dev code, and confirm each lands on `/hesabim` with a complete profile.
- [ ] **Step 8: Commit and open the PR.**

---

## PR 5 — Header account menu (repo: `cografya_web`, branch `feature/t061-header-menu`)

### Task 11: One menu instead of two buttons

**Files:**

- Modify: `components/v2/v2-header.tsx` (desktop controls ~`:416-440`, mobile menu ~`:697-730`)
- Test: `components/v2/v2-header.test.ts` (or the existing header suite)

- [ ] **Step 1: Write the failing test** — the signed-in desktop header exposes one account trigger whose menu holds exactly three items (Hesabım, Ayarlar, Çıkış yap), and the mobile menu holds the same three.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Build the menu** on the same Base UI primitive the header already uses for its nav dropdowns — do not introduce a second menu primitive.
- [ ] **Step 4: Keep the logout handler** exactly where it is; only its trigger moves.
- [ ] **Step 5: Verify keyboard behaviour** — arrow keys move through the three items, Escape closes and returns focus to the trigger, and the focus ring is the site's global 3px `var(--ring)` (T-053).
- [ ] **Step 6: Run the gate and the visual pass at all four widths in both themes.**
- [ ] **Step 7: Commit and open the PR.**

---

## Self-review notes

- Spec §3.1 routes → Tasks 8, 9. §3.2 settings → Tasks 7, 8. §3.3 password → Tasks 3, 6, 8. §3.4 register → Task 10. §3.5 header → Task 11. §4 contract → Tasks 1–5. §5 out-of-scope is honoured: no task touches deletion, e-mail change, or the hub's untouched Turkish strings.
- Naming is consistent across tasks: `ProfileDto`, `UpdateAccountRequestDto`, `PasswordChangeRequestDto`, `replaceAccount`, `PasswordChangeService.change`, `EducationFieldset`, `EducationSelection`.
- The one risk the plan carries knowingly: Task 3 reuses `SessionService`'s private minting. If exposing it cleanly proves ugly, the fallback is to move `mintTokenPairAndSession` into a small shared provider both services inject — decided at implementation time, not left vague in the code.
