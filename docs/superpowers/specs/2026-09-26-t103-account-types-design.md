# Account types at registration — design (T-103)

Status: approved by the owner 2026-09-26, ready for implementation planning.

Cross-repo: `cografya_api` owns the contract change (new role value, new columns, profile
replacement that can change the role); `cografya_web` owns the register wizard, settings, hub
and privacy copy. This file is the single design record for both; the API PR links here.

## 1. Goal

The account type is collected **so the owners (the two teachers who commissioned the site)
know who their audience is**: how many students, teachers, parents and general enthusiasts
sign up, which grade and stream the students (and the parents' children) are in, which
teachers teach geography and where, and which channel brought each member. The type does not
change what the site does for a member and grants no permission.

Consequences of that goal, all owner decisions taken 2026-09-26:

1. Four top-level types: **Öğrenci, Öğretmen, Veli, Coğrafya meraklısı**. Finer student
   distinctions (lise / lisans / lisansüstü, mezun, KPSS) stay in the student's second step,
   exactly as today. This mirrors Ferrum's signup, whose grade and stream lists ours already
   copy.
2. Second step per type, **required** for every type that has one:
   - Öğrenci: unchanged (education level, then grade + stream or university + department).
   - Veli: the **child's** grade and stream ("Çocuğun kaçıncı sınıfta?"). One child; a parent
     of several picks the one closest to an exam. No school name.
   - Öğretmen: branch (Coğrafya / Sosyal bilgiler / Diğer) and institution type (Devlet okulu
     / Özel okul / Dershane-kurs / Diğer). This reverses T-061's "no teacher fields" decision
     because the goal changed.
   - Coğrafya meraklısı: no second step.
3. Everyone gets an optional "Bizi nereden duydun?" question at registration.
4. The account type becomes changeable in Settings (today it is locked after registration).
5. Showing the collected data to the owners (admin page, report, e-mail) is **out of scope**;
   it becomes its own task on the board. Until then the data is read from the database.
6. Parent–child account linking is out of scope. "Veli" is a segment, not a relationship.

## 2. What exists today

Measured on `cografya_api` @ `a53384a` and `cografya_web` @ `d05c6ad`.

- `AccountRole` (`cografya_api/src/auth/account.types.ts`) has `STUDENT`, `TEACHER`,
  `PARENT`. Stored as `varchar(16)` with a CHECK (`CHK_users_account_role`,
  `CHK_pending_registrations_account_role`); the field-combination rule is a second CHECK
  (`CHK_users_profile_shape`, `CHK_pending_registrations_profile_shape`) mirrored exactly by
  `isProfileShapeValid` in `auth/dto/profile-shape.rule.ts`.
- `PARENT` shares every STUDENT education branch; nothing says whose education it describes.
- The web offers only Öğrenci and Öğretmen (`v2-register-card.tsx` `USER_ROLES`), so no parent
  account can be created from the site. The hub badge shows "Öğrenci" for a PARENT
  (`v2-member-hub.tsx`), and the "complete your education" prompt fires only for STUDENT.
- `PUT /auth/profile` replaces the six education fields and validates them against the role
  **read from the database, never from the request**, because the role was immutable.
- No age, birth date or parental-consent field anywhere; T-101 settled that a line in the
  privacy notice is enough for minors.

## 3. Registration flow

```
Step 1 (everyone)   name, surname, phone, e-mail, province/district, password
                    Hesap türü: [Öğrenci] [Öğretmen] [Veli] [Coğrafya meraklısı]
                    Bizi nereden duydun? (optional select)
                    Kullanım şartları (required) · Pazarlama izni (optional)
                    → "Devam Et" when a second step follows, "Kayıt Ol" otherwise
Step 2 (by type)    Öğrenci  → existing EducationFieldset, unchanged
                    Veli     → child's grade + stream, parent wording, no school name
                    Öğretmen → branch + institution type
                    Meraklı  → skipped
Step 3 (everyone)   e-mail code → /hesabim
```

- The type picker stays a radio group, now 2×2. Default selection stays Öğrenci.
- "Nereden duydun" sits in step 1 because the enthusiast has no step 2. It is never shown
  again (not in Settings): it records the first contact, which does not change.
- Copy follows `docs/copy.md`: "sen" address throughout ("Çocuğun kaçıncı sınıfta?",
  "Hangi alana hazırlanıyor?", "Branşın", "Çalıştığın kurum").

Option lists (label → stored value):

| Field                | Options                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Hesap türü           | Öğrenci `STUDENT` · Öğretmen `TEACHER` · Veli `PARENT` · Coğrafya meraklısı `ENTHUSIAST`                                                  |
| Branş (teacher)      | Coğrafya `COGRAFYA` · Sosyal bilgiler `SOSYAL_BILGILER` · Diğer `DIGER`                                                                   |
| Kurum türü (teacher) | Devlet okulu `DEVLET_OKULU` · Özel okul `OZEL_OKUL` · Dershane / kurs `DERSHANE_KURS` · Diğer `DIGER`                                     |
| Nereden duydun       | Öğretmenim `OGRETMEN` · Arkadaşım `ARKADAS` · YouTube `YOUTUBE` · Instagram `INSTAGRAM` · Google `GOOGLE` · Kitap `KITAP` · Diğer `DIGER` |
| Child grade / stream | the existing `GradeLevel` / `StudyStream` lists                                                                                           |

New closed sets use Turkish tokens like the existing `GradeLevel`/`StudyStream`; the role
value stays English like its siblings.

## 4. After registration

- **Hub (`/hesabim`):** the badge shows the real type (four labels). The "complete your
  profile" prompt fires whenever the API's `isComplete` is false, for any type, and its copy
  names what is missing (education for student, child's class for parent, branch for
  teacher).
- **Settings (`/hesabim/ayarlar`):** the education card becomes a **profile card shown to
  every type**: the type picker plus that type's second-step fields, saved together through
  `PUT /auth/profile`. Changing the type reveals the new type's fields in the same card;
  nothing is saved until the fields are valid, and saving clears the previous type's fields
  (a teacher who becomes a parent loses branch and institution). The account card stops
  showing the role read-only. The existing unsaved-changes guard covers the card.

## 5. API contract and data

### 5.1 Columns

| Column (users and pending_registrations) | Type                 | Notes                                                                 |
| ---------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| `account_role`                           | existing varchar(16) | CHECK gains `ENTHUSIAST`                                              |
| `teacher_subject`                        | varchar, nullable    | CHECK: `COGRAFYA`, `SOSYAL_BILGILER`, `DIGER`                         |
| `institution_type`                       | varchar, nullable    | CHECK: `DEVLET_OKULU`, `OZEL_OKUL`, `DERSHANE_KURS`, `DIGER`          |
| `referral_source`                        | varchar, nullable    | CHECK: the seven values above; copied pending → users on verification |

A parent's child data lives in the existing `grade_level` / `study_stream` columns. A separate
pair of `child_*` columns would double the shape rule for no reporting gain: every audience
query filters by `account_role` anyway. The entity and DTO docblocks state the meaning.

One new, hand-written migration alters both tables. `migration:generate` silently skips a
CHECK whose name is unchanged (recorded in `1789125265639-AddSchoolNameAndParentAccountRole.ts`),
so the CHECKs are dropped and re-created by hand. No existing migration is edited.

### 5.2 Profile shape rule (DTO and DB CHECK stay identical)

| Role       | Education fields                                                                                                         | Teacher fields                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| STUDENT    | unchanged: none (minimal), or SECONDARY / UNDERGRADUATE / GRADUATE branches                                              | both null                       |
| PARENT     | none (minimal), or SECONDARY with grade + stream; school, university, department null; UNDERGRADUATE / GRADUATE rejected | both null                       |
| TEACHER    | all null                                                                                                                 | both null (minimal) or both set |
| ENTHUSIAST | all null                                                                                                                 | both null                       |

`referral_source` is independent of role and always optional.

`isProfileComplete`: STUDENT and PARENT when `educationLevel` is set; TEACHER when both
teacher fields are set; ENTHUSIAST always.

The API keeps accepting a minimal (step-2-less) profile, as it does for students today; the
web enforces the required second step. This keeps the API's existing minimal-registration
decision intact.

### 5.3 Endpoints

- `POST /auth/register`: accepts `ENTHUSIAST`, `teacherSubject`, `institutionType`,
  `referralSource` (all optional except as the shape rule demands).
- `PUT /auth/profile`: gains required `accountRole` and required-but-nullable
  `teacherSubject`, `institutionType`, keeping full-replacement semantics. The shape is now
  validated against the **requested** role and the role column is written with the rest.
  Reading the role from the database was only needed while the role was immutable; the role
  is a declaration with no permission attached, so letting the member set it is safe.
  **Breaking** for the web client; both land in this task.
- `GET /auth/profile`: returns `teacherSubject` and `institutionType`. `referralSource` is not
  returned; no screen shows it.
- `GET /auth/session` is unchanged apart from the enum gaining a value.
- `PUT /auth/account` still does not touch the role.

## 6. Privacy notice

`messages/tr.json` privacy data list (today: "hesap türü (öğrenci, öğretmen, veli), eğitim
düzeyi, …") gains: the enthusiast type, the teacher's branch and institution type, the grade
and stream a parent declares for their child, and "bizi nereden duyduğun". The child data
identifies no one (no name, school or birth date), so, in line with Ferrum and Rehber
Matematik, disclosure in the notice is the whole treatment. The purpose sentence names
audience analysis. `en.json` keeps key parity (the EN site is switched off, not deleted).

## 7. Testing

- API unit: `isProfileShapeValid` / `isProfileComplete` table for all four roles, including
  the rejected PARENT + UNDERGRADUATE and TEACHER with one of two fields.
- API e2e: register each role; verify copies the new fields; `PUT /auth/profile` changes the
  role and clears the old type's fields; a DB-level insert that violates the new CHECK fails
  (the CHECK and the DTO rule must agree).
- API: `openapi:check` green after `openapi:generate`.
- Web: `codegen:check` green after copying the spec; form-rule tests for each role's payload;
  the register-card structure test and `profile-labels` key test updated to four types;
  settings and hub tests pin the role-agnostic completeness prompt.
- Visible change: `pnpm sweep:overflow` on `/kayit` and `/hesabim/ayarlar`; Playwright at
  320 / 360 / 390 px and desktop, light and dark.

## 8. Delivery

Two PRs into `dev`: API first (migration, enums, DTOs, shape rule, profile service, OpenAPI,
tests), then web (spec copy + codegen, register card, fieldsets, settings, hub, labels,
privacy copy, tests). A new READY task on the board records the reporting work
from §1.5.
