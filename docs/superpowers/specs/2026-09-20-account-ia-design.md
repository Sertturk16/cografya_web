# Member account IA — design (T-061)

Status: approved by the owner 2026-09-20, ready for implementation planning.

Cross-repo: `cografya_api` owns three contract changes, `cografya_web` owns the surfaces.
This file is the single design record for both; the API PR links here.

## 1. Goal

Today a signed-in member reaches account management through three doors that all lead to
the same half-built room, and changing a password asks a signed-in user for their e-mail
address. The redesign replaces that with one dashboard and one settings page, and makes the
data a member can actually edit match the data the product collects.

Owner decisions taken 2026-09-20 (all four recorded here because they set the scope):

1. Settings live at their own route, `/hesabim/ayarlar`; the hub keeps only content.
2. Personal, location and education fields are all editable. E-mail stays read-only.
3. Registration becomes a two-step wizard and education is required for students.
4. Account deletion is out of scope; it is not a fifth section and not a stub.

## 2. What the measurements actually say

Measured on `cografya_web` @ `4cb4c6a` and `cografya_api` @ `origin/dev`, on the running
dev stack and against production (`cografyagurmesi.com`, teacher account), not assumed.

### 2.1 Three doors, one room

| Control              | Where                                       | Goes to    |
| -------------------- | ------------------------------------------- | ---------- |
| "Profili Düzenle"    | `/hesabim` hero (`v2-member-hub.tsx:405`)   | `/profil`  |
| "Profil Formuna Git" | `/hesabim` → "Hesap & Profil" tab (`:1106`) | `/profil`  |
| "Hesabım & Profil"   | mobile header menu (`v2-header.tsx:697`)    | `/hesabim` |

The "Hesap & Profil" tab renders the same four to six values the hero already summarises,
read-only, and adds no capability of its own.

### 2.2 The room

`/profil` is an onboarding step wearing a settings page's name:

- Its heading is `Auth.profile.heading` = "Profilini tamamla" and stays that way after the
  profile is complete — the page then reads "Profilini tamamla / Profilin tamam."
  simultaneously (observed on the dev stack after a successful save).
- For a `TEACHER` it renders one card whose entire body is
  `Auth.profile.teacherDescription` = "Öğretmen hesabın için ek bir profil alanı
  bulunmuyor." (confirmed in production with the owner's teacher account).
- It edits six education fields and nothing else.

### 2.3 Logout has three copies

`v2-header.tsx:430` (desktop), `v2-header.tsx:722` (mobile menu) and
`v2-member-hub.tsx:413` (hub hero). The hub's copy is the one with no reason to exist.

### 2.4 Password change is the forgot-password flow

`/hesabim` → "Şifre Değiştir" links to `/sifre-sifirlama`, which asks for an e-mail address
and sends a link. `auth.controller.ts` publishes `password-reset/request`,
`password-reset/confirm` and `password-reset/verify` and **no authenticated change route**.
With `MAIL_TRANSPORT` in SES sandbox this flow does not currently reach a mailbox at all,
so today a signed-in member cannot change their password by any path.

### 2.5 The data the product collects vs. the data a member can edit

`users` carries `firstName`, `lastName`, `phone`, `email`, `accountRole`, six education
columns, `districtId`, `createdAt`, `tokenVersion` (`user.entity.ts`).

| Field group            | Collected at register     | Readable via API         | Editable via API    |
| ---------------------- | ------------------------- | ------------------------ | ------------------- |
| firstName              | yes                       | `GET /auth/session` only | **no**              |
| lastName, phone, email | yes                       | **no**                   | **no**              |
| districtId, province   | yes                       | **no**                   | **no**              |
| six education fields   | **no** (form) / yes (DTO) | `GET /auth/profile`      | `PUT /auth/profile` |

Two consequences drive the design. First, "tidy it into one place" is only true if the
personal block becomes readable and writable — otherwise the settings page is a stub with
one working card. Second, `RegisterRequestDto` **already accepts all six education fields**
(`register-request.dto.ts`); the web form simply never sends them, so asking for education
at registration needs no API change at all.

### 2.6 What holds the current shape in place

- `components/v2/v2-member-hub.test.ts` asserts all five panels by trigger and content label.
- `components/v2/tablist-adoption.test.ts` forbids a hand-written tablist returning.
- `i18n/routing.ts` requires a TR and EN entry per route.
- `components/showcase/registry.test.ts` fails if a component has no `/design-system`
  specimen.
- `GET /auth/session` is documented as the minimum-PII set (§7.3): "id, firstName,
  accountRole ONLY. No e-posta, telefon, soyad or education fields."

## 3. Design

### 3.1 Routes

| Route                                       | Change                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/hesabim` (`/en/account`)                  | Activity hub only. Four tabs; the fifth ("Hesap & Profil") is deleted. Hero action becomes a single secondary link to settings. Hero logout is removed.         |
| `/hesabim/ayarlar` (`/en/account/settings`) | New. Four sections, described below.                                                                                                                            |
| `/profil` (`/en/profile`)                   | Becomes a permanent redirect to `/hesabim/ayarlar`. The route keeps its `pathnames` entry so existing links and the post-verification return path do not break. |
| `/sifre-sifirlama`                          | Unchanged, and reachable only from the signed-out login card. No signed-in surface links to it any more.                                                        |

### 3.2 The settings page

Four independent cards, each with its own submit. Section-scoped saves mean a failure in
one block cannot discard edits in another.

1. **Profil bilgileri** (everyone) — firstName, lastName, phone, province, district.
2. **Eğitim bilgileri** (`STUDENT` and `PARENT` only) — the six-field education matrix.
3. **Güvenlik** (everyone) — current password, new password, confirm.
4. **Hesap** (everyone, read-only) — e-mail, account role, member since.

A `TEACHER` sees three populated cards and never an empty-room message; the education card
is simply not rendered. `PARENT` follows the `STUDENT` branch exactly, as the API's profile
matrix already does.

The education fields become one `EducationFieldset` component consumed by both this card
and step 2 of the registration wizard. They are spelled twice today
(`v2-profile-form.tsx`, and nowhere in register); this design would otherwise spell them a
third time.

### 3.3 Password change

New endpoint `POST /api/auth/password/change`, body `{ currentPassword, newPassword }`.

- Wrong current password → `errors.password.currentInvalid`.
- New password failing policy → the existing `errors.register.weakPassword`.
- New password equal to current → `errors.password.unchanged`.
- On success the service bumps `tokenVersion`, which revokes every other session, and
  returns a fresh token pair exactly as login does, so the caller's own session survives.
  The web BFF treats it as a third token-issuing action alongside `login` and
  `verify-email`.
- `@Throttle` at the login route's ceiling plus `@NoTrustedClientExemption()`, because the
  route accepts a password guess.

### 3.4 Registration wizard

`v2-register-card.tsx`'s `step` becomes `"identity" | "education" | "verify"`.

- Step 1 — firstName, lastName, phone, e-mail, password, account type, province, district.
- Step 2 — students only: `EducationFieldset`, required. A teacher never sees this step and
  the step counter reads 1/1 for them.
- Then the existing verification-code step, whose `returnTo` changes from `/profil` to
  `/hesabim`.

`buildRegisterPayload` gains the education fields. No API change.

Accounts that predate this change and have `isComplete: false` are not migrated; the hub
hero keeps one quiet prompt while the flag is false, and the settings page is where they
finish.

### 3.5 Header account menu

The desktop header's two controls ("Hesabım" link, "Çıkış Yap" button) become one account
menu: initial badge → Hesabım · Ayarlar · Çıkış yap. The mobile menu carries the same three
and its "Hesabım & Profil" label becomes "Hesabım". This is the only change that touches
every page, so it ships last and alone.

## 4. Contract changes

| Change                                                                                                                                              | Kind                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /auth/profile` gains `firstName`, `lastName`, `email`, `phone`, `provincePlateCode`, `provinceName`, `districtId`, `districtName`, `createdAt` | additive                                                                                    |
| `PUT /auth/account` — full replacement of the personal block                                                                                        | new route                                                                                   |
| `POST /auth/password/change`                                                                                                                        | new route                                                                                   |
| `GET /auth/session`                                                                                                                                 | **unchanged** — the minimum-PII rule stands; PII travels only on the no-store profile route |

No schema change: every column already exists, so there is no migration. Province is
resolved through `districts.province_id`, which the district entity already carries.

Sequence: `pnpm openapi:generate` in the API, copy `openapi/openapi.json` into the web
repo by hand, `pnpm codegen` there. Nothing automates the copy.

## 5. Out of scope, deliberately

Account deletion (owner's call), e-mail change (needs a verify-new-address flow and SES
production access), teacher-specific profile fields, and a wholesale i18n migration of the
hub's hardcoded Turkish. Only strings touched by this work move into `messages/*.json`.

## 6. Delivery

Five pull requests, each green on its repo's gate before the next starts.

1. **api** — profile read widened, `PUT /auth/account`, `POST /auth/password/change`, unit
   and e2e specs, `openapi.json` regenerated.
2. **web** — spec copy, codegen, BFF action table and transports. No visible change.
3. **web** — settings page, `EducationFieldset`, `/profil` redirect, hub cleanup (fifth tab
   and hero logout removed).
4. **web** — registration wizard and the post-verification target.
5. **web** — header account menu.

Every visible PR: 320/360/390 and desktop, light and dark, via Playwright;
`pnpm sweep:overflow`; a `/design-system` specimen for each new component.
