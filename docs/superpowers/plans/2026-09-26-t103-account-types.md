# Account types at registration (T-103) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four declared account types (Öğrenci, Öğretmen, Veli, Coğrafya meraklısı), a required per-type second registration step, an optional "Bizi nereden duydun?" answer, and an account type a member can change in Settings, so the owners can later read their audience from the database.

**Architecture:** The API owns the contract: a new `ENTHUSIAST` role value, three new nullable closed-set columns (`teacher_subject`, `institution_type`, `referral_source`) on `users` and `pending_registrations`, a rewritten profile-shape rule (TypeScript + identical DB CHECK), and `PUT /auth/profile` that now carries and writes `accountRole`. The web copies the spec, regenerates the types, and routes both the register wizard and the settings card through one shared "declared profile" model: a role picker plus a role-specific fieldset.

**Tech Stack:** NestJS 11, TypeORM, PostgreSQL 16, class-validator, Jest + Testcontainers (API); Next.js 16, React 19, next-intl 4, zod, vitest, Playwright MCP (web).

**Spec:** `cografya_web/docs/superpowers/specs/2026-09-26-t103-account-types-design.md`

## Global Constraints

- Two repos, two branches, both named `feature/t-103-account-types`, each PR into `dev`. API PR first; the web PR depends on its spec. Never push to `main`, never force-push, never amend.
- Conventional Commits; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Stored values (exact): role `STUDENT` `TEACHER` `PARENT` `ENTHUSIAST`; teacher subject `COGRAFYA` `SOSYAL_BILGILER` `DIGER`; institution type `DEVLET_OKULU` `OZEL_OKUL` `DERSHANE_KURS` `DIGER`; referral source `OGRETMEN` `ARKADAS` `YOUTUBE` `INSTAGRAM` `GOOGLE` `KITAP` `DIGER`.
- Labels (exact TR): Öğrenci · Öğretmen · Veli · Coğrafya meraklısı; Coğrafya · Sosyal bilgiler · Diğer; Devlet okulu · Özel okul · Dershane / kurs · Diğer; Öğretmenim · Arkadaşım · YouTube · Instagram · Google · Kitap · Diğer.
- Copy addresses the reader as "sen" (`cografya_web/docs/copy.md`). No new hardcoded string in a file that already uses `useTranslations`.
- Never hand-edit `cografya_web/lib/api/schema.ts` or `cografya_api/openapi/openapi.json`; regenerate them.
- Never edit an existing migration. The new migration is hand-written (TypeORM's generator skips CHECKs whose name is unchanged).
- API gate before each commit: `pnpm typecheck && pnpm lint` plus the touched unit specs. Web gate: `pnpm typecheck && pnpm lint && pnpm test`.
- The profile-shape rule in `profile-shape.rule.ts` and the `..._profile_shape` CHECKs must express the same matrix (spec §5.2).

## Review Focus

1. **Role change in Settings leaves the old type's data behind.** A teacher who becomes a parent must end with `teacher_subject`/`institution_type` NULL; a student who becomes a teacher must end with every education column NULL. Pinned by the API e2e in Task A3 and by the web payload tests in Task W3.
2. **A PARENT row the old rule accepted but the new CHECK rejects** (PARENT + UNDERGRADUATE/GRADUATE, or PARENT + `school_name`). The web never offered PARENT, so none should exist, but `up()` would then fail on deploy. Task A2 adds a preflight query to the PR description and pins the rejections in the schema e2e.
3. **Switching roles back and forth in the register wizard.** Student → Veli → Student must not carry the child's grade into the student's answer or the reverse. The wizard keeps three separate selections (`education`, `childEducation`, `teacher`) and only the selected role's one reaches the payload (Task W3 test, Task W5).
4. **Teacher with one of two fields.** DTO, CHECK and web must all refuse `teacherSubject` without `institutionType` (Task A1 unit, Task A2 schema e2e, Task W4 `missingTeacherFields`).
5. **Referral source on non-register surfaces.** It must never appear in `GET /auth/profile` or in the `PUT /auth/profile` body (Task A3 asserts the absence; `forbidNonWhitelisted` would 400 an attempt).

---

# Part A — `cografya_api`

Work in `/home/sertturk16/cografya_v4/cografya_api`.

- [ ] **A0: Branch**

```bash
cd /home/sertturk16/cografya_v4/cografya_api
git status --short            # must be empty
git fetch origin && git switch -c feature/t-103-account-types origin/dev
```

### Task A1: Enums and the profile-shape rule

**Files:**

- Modify: `src/auth/account.types.ts`
- Modify: `src/auth/dto/profile-shape.rule.ts`
- Test: `src/auth/dto/profile-shape.rule.spec.ts`

**Interfaces:**

- Produces: `AccountRole.Enthusiast = 'ENTHUSIAST'`; `enum TeacherSubject`, `enum InstitutionType`, `enum ReferralSource` (values in Global Constraints); `ProfileShapeCandidate` gains `teacherSubject?: unknown; institutionType?: unknown`; `isProfileComplete(profile: { accountRole: AccountRole; educationLevel: EducationLevel | null; teacherSubject: TeacherSubject | null; institutionType: InstitutionType | null }): boolean` (object argument, replaces the two-argument form).

- [ ] **Step 1: Add the enums**

In `src/auth/account.types.ts`, replace the `AccountRole` enum and add three enums after `StudyStream`:

```ts
/**
 * The declared account profile. This is not an authorization role: no value grants a
 * permission. Collected so the owners can read their audience (T-103).
 */
export enum AccountRole {
  Student = "STUDENT",
  Teacher = "TEACHER",
  /**
   * "Veli". The education columns of a PARENT describe their CHILD: one secondary-school grade
   * and stream, never a university or a school name (T-103).
   */
  Parent = "PARENT",
  /** "Coğrafya meraklısı": carries no education or teacher field (T-103). */
  Enthusiast = "ENTHUSIAST",
}
```

```ts
/** Teacher's branch (T-103). Present only on a TEACHER, together with `InstitutionType`. */
export enum TeacherSubject {
  Cografya = "COGRAFYA",
  SosyalBilgiler = "SOSYAL_BILGILER",
  Diger = "DIGER",
}

/** Where a teacher works (T-103). Present only on a TEACHER, together with `TeacherSubject`. */
export enum InstitutionType {
  DevletOkulu = "DEVLET_OKULU",
  OzelOkul = "OZEL_OKUL",
  DershaneKurs = "DERSHANE_KURS",
  Diger = "DIGER",
}

/** "Bizi nereden duydun?" (T-103). Optional for every role, collected at registration only. */
export enum ReferralSource {
  Ogretmen = "OGRETMEN",
  Arkadas = "ARKADAS",
  Youtube = "YOUTUBE",
  Instagram = "INSTAGRAM",
  Google = "GOOGLE",
  Kitap = "KITAP",
  Diger = "DIGER",
}
```

- [ ] **Step 2: Rewrite the rule spec to the new matrix (failing)**

In `src/auth/dto/profile-shape.rule.spec.ts`:

1. Update the import to `import { AccountRole, EducationLevel, GradeLevel, InstitutionType, StudyStream, TeacherSubject } from '../account.types';`.
2. Replace the file docblock's PARENT sentence with: "`PARENT` (T-103) is its own branch: minimal, or SECONDARY with grade + stream and no school; UNDERGRADUATE/GRADUATE are rejected. TEACHER carries both teacher fields or neither; ENTHUSIAST carries nothing."
3. Replace the whole `describe('TEACHER', …)` block with:

```ts
describe("TEACHER", () => {
  const base: ProfileShapeCandidate = { accountRole: AccountRole.Teacher };
  const full: ProfileShapeCandidate = {
    ...base,
    teacherSubject: TeacherSubject.Cografya,
    institutionType: InstitutionType.DevletOkulu,
  };

  it("accepts a minimal teacher (no teacher field, no education field)", () => {
    expect(isProfileShapeValid(base)).toBe(true);
  });

  it("accepts a teacher with both teacher fields", () => {
    expect(isProfileShapeValid(full)).toBe(true);
  });

  it("rejects a teacher with only one of the two teacher fields", () => {
    expect(isProfileShapeValid({ ...base, teacherSubject: TeacherSubject.Diger })).toBe(false);
    expect(isProfileShapeValid({ ...base, institutionType: InstitutionType.OzelOkul })).toBe(false);
  });

  it("rejects a teacher carrying any education field", () => {
    expect(isProfileShapeValid({ ...full, educationLevel: EducationLevel.Secondary })).toBe(false);
    expect(isProfileShapeValid({ ...full, gradeLevel: GradeLevel.Grade9 })).toBe(false);
    expect(isProfileShapeValid({ ...full, studyStream: StudyStream.Sayisal })).toBe(false);
    expect(isProfileShapeValid({ ...full, universityName: "Boğaziçi Üniversitesi" })).toBe(false);
    expect(isProfileShapeValid({ ...full, departmentName: "Coğrafya Öğretmenliği" })).toBe(false);
    expect(isProfileShapeValid({ ...full, schoolName: "Synthetic Lisesi" })).toBe(false);
  });
});

describe("ENTHUSIAST", () => {
  const base: ProfileShapeCandidate = { accountRole: AccountRole.Enthusiast };

  it("accepts an enthusiast with no field at all", () => {
    expect(isProfileShapeValid(base)).toBe(true);
  });

  it("rejects an enthusiast carrying any education or teacher field", () => {
    expect(isProfileShapeValid({ ...base, educationLevel: EducationLevel.Secondary })).toBe(false);
    expect(isProfileShapeValid({ ...base, gradeLevel: GradeLevel.Grade9 })).toBe(false);
    expect(isProfileShapeValid({ ...base, schoolName: "Synthetic Lisesi" })).toBe(false);
    expect(isProfileShapeValid({ ...base, teacherSubject: TeacherSubject.Cografya })).toBe(false);
    expect(isProfileShapeValid({ ...base, institutionType: InstitutionType.Diger })).toBe(false);
  });
});
```

4. Replace the `describe('PARENT + SECONDARY …')` block with:

```ts
describe("PARENT + SECONDARY (the child, T-103)", () => {
  const base: ProfileShapeCandidate = {
    accountRole: AccountRole.Parent,
    educationLevel: EducationLevel.Secondary,
    gradeLevel: GradeLevel.Grade12,
    studyStream: StudyStream.EsitAgirlik,
  };

  it("accepts the child's grade + stream", () => {
    expect(isProfileShapeValid(base)).toBe(true);
  });

  it("rejects a school name: the child is not identified", () => {
    expect(isProfileShapeValid({ ...base, schoolName: "Synthetic Lisesi" })).toBe(false);
  });

  it("rejects a missing gradeLevel or studyStream", () => {
    expect(isProfileShapeValid({ ...base, gradeLevel: undefined })).toBe(false);
    expect(isProfileShapeValid({ ...base, studyStream: undefined })).toBe(false);
  });

  it("rejects university, department or teacher fields", () => {
    expect(isProfileShapeValid({ ...base, universityName: "Boğaziçi Üniversitesi" })).toBe(false);
    expect(isProfileShapeValid({ ...base, departmentName: "Coğrafya Öğretmenliği" })).toBe(false);
    expect(isProfileShapeValid({ ...base, teacherSubject: TeacherSubject.Cografya })).toBe(false);
  });
});
```

5. Replace every other `describe('PARENT + UNDERGRADUATE …')` / `describe('PARENT + GRADUATE …')` block with one block:

```ts
describe("PARENT + UNDERGRADUATE / GRADUATE (T-103: rejected)", () => {
  it("rejects a parent declaring a higher-education level", () => {
    expect(
      isProfileShapeValid({
        accountRole: AccountRole.Parent,
        educationLevel: EducationLevel.Undergraduate,
        universityName: "Boğaziçi Üniversitesi",
        departmentName: "Coğrafya Öğretmenliği",
      }),
    ).toBe(false);
    expect(
      isProfileShapeValid({
        accountRole: AccountRole.Parent,
        educationLevel: EducationLevel.Graduate,
        universityName: "Boğaziçi Üniversitesi",
      }),
    ).toBe(false);
  });
});
```

6. Any minimal-PARENT case stays (minimal parent is still accepted). Add to the minimal STUDENT describe block (whatever its name is):

```ts
it("rejects a student carrying a teacher field", () => {
  expect(
    isProfileShapeValid({ accountRole: AccountRole.Student, teacherSubject: TeacherSubject.Diger }),
  ).toBe(false);
});
```

7. Replace the `isProfileComplete` describe block with:

```ts
describe("isProfileComplete (T-103)", () => {
  const none = { educationLevel: null, teacherSubject: null, institutionType: null };

  it("STUDENT and PARENT are complete once an education level is declared", () => {
    for (const accountRole of [AccountRole.Student, AccountRole.Parent]) {
      expect(isProfileComplete({ ...none, accountRole })).toBe(false);
      expect(
        isProfileComplete({ ...none, accountRole, educationLevel: EducationLevel.Secondary }),
      ).toBe(true);
    }
  });

  it("TEACHER is complete only with both teacher fields", () => {
    expect(isProfileComplete({ ...none, accountRole: AccountRole.Teacher })).toBe(false);
    expect(
      isProfileComplete({
        ...none,
        accountRole: AccountRole.Teacher,
        teacherSubject: TeacherSubject.Cografya,
        institutionType: InstitutionType.DershaneKurs,
      }),
    ).toBe(true);
  });

  it("ENTHUSIAST is always complete", () => {
    expect(isProfileComplete({ ...none, accountRole: AccountRole.Enthusiast })).toBe(true);
  });
});
```

- [ ] **Step 3: Run the spec, expect failures**

Run: `pnpm test:unit src/auth/dto/profile-shape.rule.spec.ts`
Expected: FAIL (TypeScript errors on `isProfileComplete`'s object argument and on `teacherSubject`, plus the ENTHUSIAST and PARENT assertions).

- [ ] **Step 4: Implement the rule**

In `src/auth/dto/profile-shape.rule.ts`:

- Import `InstitutionType, TeacherSubject` alongside `AccountRole, EducationLevel`.
- Add `readonly teacherSubject?: unknown;` and `readonly institutionType?: unknown;` to `ProfileShapeCandidate`.
- Replace the docblock above `isProfileShapeValid` with a four-role list matching spec §5.2, and replace the function body, `PROFILE_SHAPE_MESSAGE` and `isProfileComplete` with:

```ts
export function isProfileShapeValid(candidate: ProfileShapeCandidate): boolean {
  const {
    accountRole,
    educationLevel,
    gradeLevel,
    studyStream,
    universityName,
    departmentName,
    schoolName,
    teacherSubject,
    institutionType,
  } = candidate;

  const noEducation =
    isNil(educationLevel) &&
    isNil(gradeLevel) &&
    isNil(studyStream) &&
    isNil(universityName) &&
    isNil(departmentName) &&
    isNil(schoolName);
  const noTeacherFields = isNil(teacherSubject) && isNil(institutionType);

  switch (accountRole) {
    case AccountRole.Teacher:
      // Both or neither: a minimal teacher is accepted the way a minimal student is.
      return (
        noEducation && (noTeacherFields || (!isNil(teacherSubject) && !isNil(institutionType)))
      );
    case AccountRole.Enthusiast:
      return noEducation && noTeacherFields;
    case AccountRole.Parent:
      // The education columns describe the child: one secondary grade + stream, no school.
      if (!noTeacherFields) return false;
      if (isNil(educationLevel)) return noEducation;
      return (
        educationLevel === EducationLevel.Secondary &&
        !isNil(gradeLevel) &&
        !isNil(studyStream) &&
        isNil(universityName) &&
        isNil(departmentName) &&
        isNil(schoolName)
      );
    case AccountRole.Student:
      if (!noTeacherFields) return false;
      if (isNil(educationLevel)) return noEducation;
      if (educationLevel === EducationLevel.Secondary) {
        // `schoolName` is optional here and only here.
        return (
          !isNil(gradeLevel) &&
          !isNil(studyStream) &&
          isNil(universityName) &&
          isNil(departmentName)
        );
      }
      if (educationLevel === EducationLevel.Undergraduate) {
        return (
          isNil(gradeLevel) &&
          isNil(studyStream) &&
          !isNil(universityName) &&
          !isNil(departmentName) &&
          isNil(schoolName)
        );
      }
      if (educationLevel === EducationLevel.Graduate) {
        return (
          isNil(gradeLevel) && isNil(studyStream) && !isNil(universityName) && isNil(schoolName)
        );
      }
      return false;
    default:
      return false;
  }
}

export const PROFILE_SHAPE_MESSAGE =
  "profile fields do not match the required combination for the declared accountRole " +
  "(teacher: no education field, teacherSubject and institutionType both or neither; " +
  "enthusiast: no field; parent: none, or secondary gradeLevel+studyStream without school; " +
  "student: none, secondary gradeLevel+studyStream with optional schoolName, undergraduate " +
  "university+department, graduate university with optional department; teacher fields only " +
  "on a teacher)";

/** Whether the declared profile is complete for its role (spec §5.2). */
export function isProfileComplete(profile: {
  accountRole: AccountRole;
  educationLevel: EducationLevel | null;
  teacherSubject: TeacherSubject | null;
  institutionType: InstitutionType | null;
}): boolean {
  switch (profile.accountRole) {
    case AccountRole.Teacher:
      return profile.teacherSubject !== null && profile.institutionType !== null;
    case AccountRole.Enthusiast:
      return true;
    default:
      return profile.educationLevel !== null;
  }
}
```

- [ ] **Step 5: Run the spec, expect green**

Run: `pnpm test:unit src/auth/dto/profile-shape.rule.spec.ts`
Expected: PASS. `pnpm typecheck` will still fail in `profile.service.ts` (old `isProfileComplete` call); Task A3 fixes it. Do not commit yet: A1 and A2 land in one commit together with A3's service fix, because the tree has to typecheck at every commit.

### Task A2: Columns, CHECKs and the migration

**Files:**

- Create: `src/auth/entities/profile-shape-check.ts`
- Modify: `src/auth/entities/user.entity.ts`, `src/auth/entities/pending-registration.entity.ts`
- Create: `src/database/migrations/1790380800000-AddAccountTypesAndAudienceFields.ts`
- Modify: `src/database/data-source-options.ts`
- Modify: `test/province.e2e-spec.ts`, `test/country.e2e-spec.ts` (migration lists), `test/auth-schema.e2e-spec.ts`

**Interfaces:**

- Produces: `User.teacherSubject: TeacherSubject | null`, `User.institutionType: InstitutionType | null`, `User.referralSource: ReferralSource | null`, and the same three on `PendingRegistration`; DB columns `teacher_subject`, `institution_type`, `referral_source` (varchar(16), nullable) on both tables.

- [ ] **Step 1: One shared CHECK expression for both entities**

Create `src/auth/entities/profile-shape-check.ts`:

```ts
/**
 * The profile-shape matrix as SQL (spec §5.2, T-103), shared by the `users` and
 * `pending_registrations` entities so the two declarations cannot drift from each other.
 * `isProfileShapeValid` (`../dto/profile-shape.rule.ts`) is the same rule in TypeScript; the
 * migration `1790380800000-AddAccountTypesAndAudienceFields` holds its own frozen copy.
 *
 * The outer `IS TRUE` folds UNKNOWN to FALSE: with `education_level` NULL a comparison such as
 * `"education_level" = 'SECONDARY'` is UNKNOWN, and a Postgres CHECK accepts UNKNOWN.
 */
const NO_EDUCATION =
  `"education_level" IS NULL AND "grade_level" IS NULL AND "study_stream" IS NULL AND ` +
  `"university_name" IS NULL AND "department_name" IS NULL AND "school_name" IS NULL`;
const NO_TEACHER = `"teacher_subject" IS NULL AND "institution_type" IS NULL`;

export const PROFILE_SHAPE_CHECK =
  `((` +
  `("account_role" = 'TEACHER' AND ${NO_EDUCATION} AND (` +
  `(${NO_TEACHER}) OR ("teacher_subject" IS NOT NULL AND "institution_type" IS NOT NULL)` +
  `)) OR ` +
  `("account_role" = 'ENTHUSIAST' AND ${NO_EDUCATION} AND ${NO_TEACHER}) OR ` +
  `("account_role" = 'PARENT' AND ${NO_TEACHER} AND (` +
  `(${NO_EDUCATION}) OR (` +
  `"education_level" = 'SECONDARY' AND "grade_level" IS NOT NULL AND ` +
  `"study_stream" IS NOT NULL AND "university_name" IS NULL AND ` +
  `"department_name" IS NULL AND "school_name" IS NULL` +
  `))) OR ` +
  `("account_role" = 'STUDENT' AND ${NO_TEACHER} AND (` +
  `(${NO_EDUCATION}) OR (` +
  `"education_level" = 'SECONDARY' AND "grade_level" IS NOT NULL AND ` +
  `"study_stream" IS NOT NULL AND "university_name" IS NULL AND "department_name" IS NULL` +
  `) OR (` +
  `"education_level" = 'UNDERGRADUATE' AND "grade_level" IS NULL AND ` +
  `"study_stream" IS NULL AND "university_name" IS NOT NULL AND ` +
  `"department_name" IS NOT NULL AND "school_name" IS NULL` +
  `) OR (` +
  `"education_level" = 'GRADUATE' AND "grade_level" IS NULL AND ` +
  `"study_stream" IS NULL AND "university_name" IS NOT NULL AND "school_name" IS NULL` +
  `)))` +
  `)) IS TRUE`;

export const TEACHER_SUBJECT_VALUES = `'COGRAFYA', 'SOSYAL_BILGILER', 'DIGER'`;
export const INSTITUTION_TYPE_VALUES = `'DEVLET_OKULU', 'OZEL_OKUL', 'DERSHANE_KURS', 'DIGER'`;
export const REFERRAL_SOURCE_VALUES = `'OGRETMEN', 'ARKADAS', 'YOUTUBE', 'INSTAGRAM', 'GOOGLE', 'KITAP', 'DIGER'`;
export const ACCOUNT_ROLE_VALUES = `'STUDENT', 'TEACHER', 'PARENT', 'ENTHUSIAST'`;
```

- [ ] **Step 2: Update `user.entity.ts`**

- Import `InstitutionType, ReferralSource, TeacherSubject` from `../account.types` and `ACCOUNT_ROLE_VALUES, INSTITUTION_TYPE_VALUES, PROFILE_SHAPE_CHECK, REFERRAL_SOURCE_VALUES, TEACHER_SUBJECT_VALUES` from `./profile-shape-check`.
- `@Check('CHK_users_account_role', …)` becomes ``@Check('CHK_users_account_role', `"account_role" IN (${ACCOUNT_ROLE_VALUES})`)``.
- Replace the whole `@Check('CHK_users_profile_shape', …)` decorator and the comment above it with:

```ts
// Spec §5.2 (T-103); the expression is shared with `pending_registrations`.
@Check('CHK_users_profile_shape', PROFILE_SHAPE_CHECK)
@Check(
  'CHK_users_teacher_subject',
  `"teacher_subject" IS NULL OR "teacher_subject" IN (${TEACHER_SUBJECT_VALUES})`,
)
@Check(
  'CHK_users_institution_type',
  `"institution_type" IS NULL OR "institution_type" IN (${INSTITUTION_TYPE_VALUES})`,
)
@Check(
  'CHK_users_referral_source',
  `"referral_source" IS NULL OR "referral_source" IN (${REFERRAL_SOURCE_VALUES})`,
)
```

- Add after the `departmentName` column:

```ts
  /** Teacher's branch (T-103); set together with `institutionType`, NULL on every other role. */
  @Column({ name: 'teacher_subject', type: 'varchar', length: 16, nullable: true })
  teacherSubject!: TeacherSubject | null;

  /** Where a teacher works (T-103); set together with `teacherSubject`. */
  @Column({ name: 'institution_type', type: 'varchar', length: 16, nullable: true })
  institutionType!: InstitutionType | null;

  /**
   * "Bizi nereden duydun?" (T-103). Answered once at registration, never edited and never
   * returned by any endpoint: it exists for the owners' audience reports.
   */
  @Column({ name: 'referral_source', type: 'varchar', length: 16, nullable: true })
  referralSource!: ReferralSource | null;
```

- Update the `schoolName` docblock: "Meaningful only for a STUDENT on `education_level = SECONDARY`; NULL everywhere else, including a PARENT (T-103)."

- [ ] **Step 3: Update `pending-registration.entity.ts` the same way**

Same imports; `CHK_pending_registrations_account_role` uses `ACCOUNT_ROLE_VALUES`; `CHK_pending_registrations_profile_shape` uses `PROFILE_SHAPE_CHECK` (replace the decorator and its comment); add `CHK_pending_registrations_teacher_subject`, `CHK_pending_registrations_institution_type`, `CHK_pending_registrations_referral_source` with the same expressions; add the three columns after `departmentName` with one-line docblocks ("Copied verbatim to `users` on verification (T-103).").

- [ ] **Step 4: Write the migration**

Create `src/database/migrations/1790380800000-AddAccountTypesAndAudienceFields.ts`:

```ts
import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * T-103: account types for audience data. On `users` and `pending_registrations` alike:
 *
 *  1. Three nullable closed-set columns: `teacher_subject`, `institution_type`,
 *     `referral_source`, each with its own CHECK.
 *  2. `account_role` admits `ENTHUSIAST`.
 *  3. `..._profile_shape` is rewritten to spec §5.2: TEACHER carries both teacher fields or
 *     neither; ENTHUSIAST carries nothing; PARENT is minimal or SECONDARY without a school
 *     (the columns describe the child); STUDENT keeps its four branches; teacher fields only on
 *     a TEACHER.
 *
 * Hand-written: `migration:generate` does not replace a CHECK whose name is unchanged
 * (recorded in `1789125265639-AddSchoolNameAndParentAccountRole`).
 *
 * ## `up()` can fail, on purpose
 * The rewritten CHECK is narrower for PARENT: a PARENT row with UNDERGRADUATE/GRADUATE or a
 * `school_name` violates it and Postgres refuses the `ADD CONSTRAINT` (SQLSTATE 23514), which
 * rolls the whole migration back. The web never offered PARENT, so no such row is expected;
 * the PR description carries the preflight count. Every other existing row satisfies the new
 * CHECK because the three new columns are NULL.
 *
 * ## `down()` refuses to destroy data
 * It raises if any row carries a new column value or the `ENTHUSIAST` role, then restores the
 * `1789125265639` CHECKs and drops the columns.
 */
const NO_EDUCATION =
  `"education_level" IS NULL AND "grade_level" IS NULL AND "study_stream" IS NULL AND ` +
  `"university_name" IS NULL AND "department_name" IS NULL AND "school_name" IS NULL`;
const NO_TEACHER = `"teacher_subject" IS NULL AND "institution_type" IS NULL`;

const PROFILE_SHAPE_T103 = `((
  ("account_role" = 'TEACHER' AND ${NO_EDUCATION} AND (
    (${NO_TEACHER}) OR ("teacher_subject" IS NOT NULL AND "institution_type" IS NOT NULL)
  )) OR
  ("account_role" = 'ENTHUSIAST' AND ${NO_EDUCATION} AND ${NO_TEACHER}) OR
  ("account_role" = 'PARENT' AND ${NO_TEACHER} AND (
    (${NO_EDUCATION}) OR (
      "education_level" = 'SECONDARY' AND "grade_level" IS NOT NULL AND
      "study_stream" IS NOT NULL AND "university_name" IS NULL AND
      "department_name" IS NULL AND "school_name" IS NULL
    )
  )) OR
  ("account_role" = 'STUDENT' AND ${NO_TEACHER} AND (
    (${NO_EDUCATION}) OR (
      "education_level" = 'SECONDARY' AND "grade_level" IS NOT NULL AND
      "study_stream" IS NOT NULL AND "university_name" IS NULL AND "department_name" IS NULL
    ) OR (
      "education_level" = 'UNDERGRADUATE' AND "grade_level" IS NULL AND
      "study_stream" IS NULL AND "university_name" IS NOT NULL AND
      "department_name" IS NOT NULL AND "school_name" IS NULL
    ) OR (
      "education_level" = 'GRADUATE' AND "grade_level" IS NULL AND
      "study_stream" IS NULL AND "university_name" IS NOT NULL AND "school_name" IS NULL
    )
  ))
)) IS TRUE`;

/** `1789125265639-AddSchoolNameAndParentAccountRole`'s CHECK, restored by `down()`. */
const PROFILE_SHAPE_P1E = `((
  "account_role" = 'TEACHER' AND ${NO_EDUCATION}
) OR (
  "account_role" IN ('STUDENT', 'PARENT') AND (
    (${NO_EDUCATION}) OR (
      "education_level" = 'SECONDARY' AND "grade_level" IS NOT NULL AND
      "study_stream" IS NOT NULL AND "university_name" IS NULL AND "department_name" IS NULL
    ) OR (
      "education_level" = 'UNDERGRADUATE' AND "grade_level" IS NULL AND
      "study_stream" IS NULL AND "university_name" IS NOT NULL AND
      "department_name" IS NOT NULL AND "school_name" IS NULL
    ) OR (
      "education_level" = 'GRADUATE' AND "grade_level" IS NULL AND
      "study_stream" IS NULL AND "university_name" IS NOT NULL AND "school_name" IS NULL
    )
  )
)) IS TRUE`;

const TABLES = [
  { table: "users", prefix: "CHK_users" },
  { table: "pending_registrations", prefix: "CHK_pending_registrations" },
] as const;

export class AddAccountTypesAndAudienceFields1790380800000 implements MigrationInterface {
  name = "AddAccountTypesAndAudienceFields1790380800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, prefix } of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "teacher_subject" character varying(16)`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "institution_type" character varying(16)`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" ADD "referral_source" character varying(16)`);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_teacher_subject"
          CHECK ("teacher_subject" IS NULL OR "teacher_subject" IN ('COGRAFYA', 'SOSYAL_BILGILER', 'DIGER'))
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_institution_type"
          CHECK ("institution_type" IS NULL OR "institution_type" IN ('DEVLET_OKULU', 'OZEL_OKUL', 'DERSHANE_KURS', 'DIGER'))
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_referral_source"
          CHECK ("referral_source" IS NULL OR "referral_source" IN ('OGRETMEN', 'ARKADAS', 'YOUTUBE', 'INSTAGRAM', 'GOOGLE', 'KITAP', 'DIGER'))
      `);

      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_account_role"`);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_account_role"
          CHECK ("account_role" IN ('STUDENT', 'TEACHER', 'PARENT', 'ENTHUSIAST'))
      `);

      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_profile_shape"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_profile_shape" CHECK (${PROFILE_SHAPE_T103})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE stray integer;
      BEGIN
        SELECT
          (SELECT count(*) FROM "users" WHERE "teacher_subject" IS NOT NULL
             OR "institution_type" IS NOT NULL OR "referral_source" IS NOT NULL
             OR "account_role" = 'ENTHUSIAST') +
          (SELECT count(*) FROM "pending_registrations" WHERE "teacher_subject" IS NOT NULL
             OR "institution_type" IS NOT NULL OR "referral_source" IS NOT NULL
             OR "account_role" = 'ENTHUSIAST')
        INTO stray;
        IF stray > 0 THEN
          RAISE EXCEPTION
            'AddAccountTypesAndAudienceFields.down() refuses: % row(s) carry T-103 data that DROP COLUMN would destroy. Roll forward instead.', stray;
        END IF;
      END $$;
    `);

    for (const { table, prefix } of TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_profile_shape"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_profile_shape" CHECK (${PROFILE_SHAPE_P1E})`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_account_role"`);
      await queryRunner.query(`
        ALTER TABLE "${table}" ADD CONSTRAINT "${prefix}_account_role"
          CHECK ("account_role" IN ('STUDENT', 'TEACHER', 'PARENT'))
      `);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_referral_source"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_institution_type"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${prefix}_teacher_subject"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "referral_source"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "institution_type"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "teacher_subject"`);
    }
  }
}
```

- [ ] **Step 5: Register the migration and pin it in the ordered lists**

- `src/database/data-source-options.ts`: import `AddAccountTypesAndAudienceFields1790380800000` next to `AddMarketingConsent1790294400000` and append it to the `migrations` array right after `AddMarketingConsent1790294400000`.
- `test/province.e2e-spec.ts` and `test/country.e2e-spec.ts`: append `'AddAccountTypesAndAudienceFields1790380800000',` after `'AddMarketingConsent1790294400000',` in each ordered list.

- [ ] **Step 6: Schema e2e — columns and CHECKs (failing first)**

In `test/auth-schema.e2e-spec.ts`:

1. In E2E-SC1's `pending_registrations` column list, append after `'marketing_consent_at',`:

```ts
      'teacher_subject',
      'institution_type',
      'referral_source',
```

2. At the end of E2E-SC3 (before its closing `});`), add:

```ts
// T-103: the new closed sets and the rewritten matrix, on the pending mirror.
await expect(insertPendingRegistration({ teacherSubject: "MATEMATIK" })).rejects.toThrow(
  /CHK_pending_registrations_teacher_subject/,
);
await expect(insertPendingRegistration({ referralSource: "TIKTOK" })).rejects.toThrow(
  /CHK_pending_registrations_referral_source/,
);
await expect(
  insertPendingRegistration({ accountRole: "TEACHER", teacherSubject: "COGRAFYA" }),
).rejects.toThrow(/CHK_pending_registrations_profile_shape/);
await expect(
  insertPendingRegistration({
    accountRole: "PARENT",
    educationLevel: "SECONDARY",
    gradeLevel: "GRADE_9",
    studyStream: "SAYISAL",
    schoolName: "Synthetic Lisesi",
  }),
).rejects.toThrow(/CHK_pending_registrations_profile_shape/);
await expect(
  insertPendingRegistration({ accountRole: "ENTHUSIAST", gradeLevel: "GRADE_9" }),
).rejects.toThrow(/CHK_pending_registrations_profile_shape/);
await expect(
  insertPendingRegistration({
    accountRole: "TEACHER",
    teacherSubject: "COGRAFYA",
    institutionType: "DERSHANE_KURS",
    referralSource: "YOUTUBE",
  }),
).resolves.toBeDefined();
await expect(insertPendingRegistration({ accountRole: "ENTHUSIAST" })).resolves.toBeDefined();
```

3. The helper builds raw SQL and today writes neither `school_name` nor the new columns. Add four keys to `interface PendingRegistrationInsert`:

```ts
schoolName: string | null;
teacherSubject: string | null;
institutionType: string | null;
referralSource: string | null;
```

default them to `null` in `insertPendingRegistration`'s `input` object (after `departmentName: null,`), and extend the INSERT:

```ts
      `
        INSERT INTO pending_registrations (
          email, password_hash, first_name, last_name, phone, account_role, education_level,
          grade_level, study_stream, university_name, department_name, district_id, locale,
          code_hash, expires_at, attempt_count, school_name, teacher_subject, institution_type,
          referral_source
        ) VALUES ($1, $2, 'Synthetic', 'Pending', '+905000000000', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `,
```

appending `input.schoolName, input.teacherSubject, input.institutionType, input.referralSource,` after `input.attemptCount,` in the parameter array.

Run: `pnpm test:e2e test/auth-schema.e2e-spec.ts`
Expected before Steps 1–5 are built: FAIL; after: PASS. (The e2e lane runs the compiled migrations through `buildDataSourceOptions`, so it exercises the new migration's `up()`.)

- [ ] **Step 7: Migration revert/reapply stays green**

`test/auth-core.e2e-spec.ts` rewinds migrations until `AddSchoolNameAndParentAccountRole` is next, so it runs the new `down()` on empty synthetic tables. Update the comment that says its target "is now the latest" to note that `AddMarketingConsent` and `AddAccountTypesAndAudienceFields` sit after it and are rewound first. No assertion changes.

Run: `pnpm test:e2e test/auth-core.e2e-spec.ts`
Expected: PASS.

### Task A3: DTOs, services and the e2e contract

**Files:**

- Modify: `src/auth/dto/register-request.dto.ts`, `src/auth/dto/update-profile-request.dto.ts`, `src/auth/dto/profile.dto.ts`
- Modify: `src/auth/registration.service.ts`, `src/auth/email-verification.service.ts`, `src/auth/profile.service.ts`
- Test: `src/auth/profile.service.spec.ts`, `src/auth/auth.contract.spec.ts`, `test/auth-profile.e2e-spec.ts`, `test/auth-endpoints.e2e-spec.ts`
- Create: `test/auth-account-types.e2e-spec.ts`

**Interfaces:**

- Consumes: A1's enums and `isProfileComplete(profile)`, A2's entity columns.
- Produces (published contract the web codegens from): `RegisterRequestDto` + `teacherSubject?`, `institutionType?`, `referralSource?`; `UpdateProfileRequestDto` + required `accountRole`, required-nullable `teacherSubject`, `institutionType`; `ProfileDto` + `teacherSubject: TeacherSubject | null`, `institutionType: InstitutionType | null`; `accountRole` enums everywhere gain `ENTHUSIAST`.

- [ ] **Step 1: Register DTO**

In `register-request.dto.ts`, import `InstitutionType, ReferralSource, TeacherSubject`. Change the `educationLevel` description to `'Yalnız STUDENT ve PARENT gönderir. PARENT için yalnız SECONDARY: alanlar çocuğun sınıfını ve alanını anlatır (T-103).'` and the `schoolName` description's "(öğrenci veya veli)" to "(yalnız öğrenci)". Add after `departmentName`:

```ts
  @ApiPropertyOptional({
    enum: TeacherSubject,
    example: TeacherSubject.Cografya,
    description: 'Öğretmenin branşı. Yalnız TEACHER gönderir, institutionType ile birlikte (T-103).',
  })
  @IsOptional()
  @IsEnum(TeacherSubject)
  teacherSubject?: TeacherSubject;

  @ApiPropertyOptional({
    enum: InstitutionType,
    example: InstitutionType.DevletOkulu,
    description: 'Öğretmenin çalıştığı kurum türü. Yalnız TEACHER gönderir, teacherSubject ile birlikte (T-103).',
  })
  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @ApiPropertyOptional({
    enum: ReferralSource,
    example: ReferralSource.Youtube,
    description:
      '"Bizi nereden duydun?" İsteğe bağlı, her rol için. Yalnız kayıtta alınır, hiçbir yanıtta dönmez (T-103).',
  })
  @IsOptional()
  @IsEnum(ReferralSource)
  referralSource?: ReferralSource;
```

- [ ] **Step 2: Carry the three fields from register to `users`**

- `registration.service.ts` `issueCandidateCode({...})`: add `teacherSubject: dto.teacherSubject ?? null, institutionType: dto.institutionType ?? null, referralSource: dto.referralSource ?? null,` after `schoolName`.
- `email-verification.service.ts`: add `| 'teacherSubject' | 'institutionType' | 'referralSource'` to `PendingRegistrationDraft`; in `verify`'s `manager.insert(User, {...})` add `teacherSubject: matched.teacherSubject, institutionType: matched.institutionType, referralSource: matched.referralSource,`; in the resend clone draft add `teacherSubject: newest.teacherSubject, institutionType: newest.institutionType, referralSource: newest.referralSource,`.

- [ ] **Step 3: Profile DTOs**

`profile.dto.ts`: import `InstitutionType, TeacherSubject`; change "All eighteen properties" to "All twenty properties"; add after `departmentName`:

```ts
  @ApiProperty({
    enum: TeacherSubject,
    nullable: true,
    example: TeacherSubject.Cografya,
    description: 'Öğretmenin branşı — yalnız TEACHER için, aksi halde null (T-103).',
  })
  teacherSubject!: TeacherSubject | null;

  @ApiProperty({
    enum: InstitutionType,
    nullable: true,
    example: InstitutionType.DevletOkulu,
    description: 'Öğretmenin kurum türü — yalnız TEACHER için, aksi halde null (T-103).',
  })
  institutionType!: InstitutionType | null;
```

and change `isComplete`'s description to `'Profilin tamamlanma durumu — STUDENT/PARENT: educationLevel !== null; TEACHER: branş ve kurum dolu; ENTHUSIAST: her zaman true (T-103).'`.

`update-profile-request.dto.ts`: import `AccountRole, InstitutionType, TeacherSubject`; the class docblock says "all nine properties are REQUIRED-but-nullable, except `accountRole`, which is required and never null. The role is a declaration with no permission attached, so the member may change it here (T-103)." Add as the first properties:

```ts
  @ApiProperty({
    enum: AccountRole,
    description: 'Beyan edilen hesap türü; bu uçla değiştirilebilir. Yetki değildir (T-103).',
  })
  @IsEnum(AccountRole)
  accountRole!: AccountRole;

  @ApiProperty({
    enum: TeacherSubject,
    nullable: true,
    description: 'Öğretmenin branşı (TEACHER için). null değeri alanı temizlemek için kullanılır.',
  })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsEnum(TeacherSubject)
  teacherSubject!: TeacherSubject | null;

  @ApiProperty({
    enum: InstitutionType,
    nullable: true,
    description: 'Öğretmenin kurum türü (TEACHER için). null değeri alanı temizlemek için kullanılır.',
  })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsEnum(InstitutionType)
  institutionType!: InstitutionType | null;
```

- [ ] **Step 4: Service unit spec (failing first)**

In `src/auth/profile.service.spec.ts`:

- The `row()` fixture builder gains `teacher_subject: null, institution_type: null`.
- `replaceProfile` no longer reads the persisted role, so its `harness([...])` calls lose their first entry: `harness([[{ account_role: AccountRole.Student }], [studentRow]])` becomes `harness([[studentRow]])`.
- Rename the describe to `'ProfileService.replaceProfile (declared profile, T-103)'`. The existing "writes the six education columns" test sends `accountRole: AccountRole.Student, teacherSubject: null, institutionType: null` in addition and expects them in the update patch (first key `accountRole`).
- Replace the test `'validates the shape against the PERSISTED role, never the request'` with:

```ts
it("validates against the REQUESTED role and writes the role with the fields (T-103)", async () => {
  const { service, updateMock } = harness([[row()]]);
  await service.replaceProfile(USER_ID, {
    accountRole: AccountRole.Teacher,
    educationLevel: null,
    gradeLevel: null,
    studyStream: null,
    schoolName: null,
    universityName: null,
    departmentName: null,
    teacherSubject: TeacherSubject.Cografya,
    institutionType: InstitutionType.OzelOkul,
  });
  expect(updateMock).toHaveBeenCalledWith(
    { id: USER_ID },
    {
      accountRole: AccountRole.Teacher,
      educationLevel: null,
      gradeLevel: null,
      studyStream: null,
      universityName: null,
      departmentName: null,
      schoolName: null,
      teacherSubject: TeacherSubject.Cografya,
      institutionType: InstitutionType.OzelOkul,
    },
  );
});

it("rejects a shape that does not fit the requested role, and writes nothing", async () => {
  const { service, updateMock } = harness([]);
  await expect(
    service.replaceProfile(USER_ID, {
      accountRole: AccountRole.Enthusiast,
      educationLevel: EducationLevel.Secondary,
      gradeLevel: GradeLevel.Grade9,
      studyStream: StudyStream.Sayisal,
      schoolName: null,
      universityName: null,
      departmentName: null,
      teacherSubject: null,
      institutionType: null,
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(updateMock).not.toHaveBeenCalled();
});
```

Import `InstitutionType, TeacherSubject` in the spec. Add a `getProfile` test: a row with `account_role: 'TEACHER', teacher_subject: 'COGRAFYA', institution_type: null` maps to `teacherSubject: 'COGRAFYA', institutionType: null, isComplete: false`.

Run: `pnpm test:unit src/auth/profile.service.spec.ts` — Expected: FAIL.

- [ ] **Step 5: Service implementation**

In `profile.service.ts`:

- `ProfileRow` gains `teacher_subject: TeacherSubject | null; institution_type: InstitutionType | null;` (import the enums).
- `readProfileRow`'s SELECT adds `u.teacher_subject,` and `u.institution_type,` after `u.department_name,`.
- `toDto` adds `teacherSubject: row.teacher_subject, institutionType: row.institution_type,` and `isComplete: isProfileComplete({ accountRole: row.account_role, educationLevel: row.education_level, teacherSubject: row.teacher_subject, institutionType: row.institution_type }),`.
- Replace `replaceProfile` with:

```ts
  /**
   * Replaces the caller's declared profile: the role and every role-dependent field, in one
   * idempotent write (T-103). The shape is validated against the REQUESTED role; the role is
   * a declaration with no permission attached, so the member may change it. Fields the new
   * role does not use arrive as `null` and are written as `null`, which is what clears a
   * previous role's data.
   */
  async replaceProfile(userId: string, dto: UpdateProfileRequestDto): Promise<ProfileDto> {
    const fields = {
      accountRole: dto.accountRole,
      educationLevel: dto.educationLevel ?? null,
      gradeLevel: dto.gradeLevel ?? null,
      studyStream: dto.studyStream ?? null,
      universityName: dto.universityName ?? null,
      departmentName: dto.departmentName ?? null,
      schoolName: dto.schoolName ?? null,
      teacherSubject: dto.teacherSubject ?? null,
      institutionType: dto.institutionType ?? null,
    };

    if (!isProfileShapeValid(fields)) {
      throw new BadRequestException(PROFILE_SHAPE_MESSAGE);
    }

    const result = await this.users.update({ id: userId }, fields);
    if (!result.affected) {
      throw new UnauthorizedException(AUTH_ERROR_KEYS.unauthenticated);
    }

    return this.getProfile(userId);
  }
```

Remove the now-unused `AccountRole` import only if nothing else uses it. Run: `pnpm test:unit src/auth/profile.service.spec.ts src/auth/dto/profile-shape.rule.spec.ts` — Expected: PASS. Run `pnpm typecheck && pnpm lint` — Expected: clean.

- [ ] **Step 6: OpenAPI and the contract spec**

Run `pnpm openapi:generate` (on EACCES see the `chown` note in `cografya_api/CLAUDE.md`). In `src/auth/auth.contract.spec.ts`'s "publishes all four registration enums" test, set `accountRole: ['STUDENT', 'TEACHER', 'PARENT', 'ENTHUSIAST']`, add `teacherSubject: ['COGRAFYA', 'SOSYAL_BILGILER', 'DIGER']`, `institutionType: ['DEVLET_OKULU', 'OZEL_OKUL', 'DERSHANE_KURS', 'DIGER']`, `referralSource: ['OGRETMEN', 'ARKADAS', 'YOUTUBE', 'INSTAGRAM', 'GOOGLE', 'KITAP', 'DIGER']`, rename it "publishes all seven registration enums …", and add `'TeacherSubject', 'InstitutionType', 'ReferralSource'` to the "no named enum schema" list. Add one case:

```ts
it("never publishes referralSource on a response (T-103)", () => {
  expect(document.components.schemas.ProfileDto?.properties?.referralSource).toBeUndefined();
  expect(
    document.components.schemas.UpdateProfileRequestDto?.properties?.referralSource,
  ).toBeUndefined();
});
```

Run: `pnpm test:unit src/auth/auth.contract.spec.ts && pnpm openapi:check` — Expected: PASS.

- [ ] **Step 7: Existing e2e suites follow the new contract**

- `test/auth-profile.e2e-spec.ts`: `AxisPayload` gains `accountRole: AccountRole; teacherSubject: TeacherSubject | null; institutionType: InstitutionType | null`; `CLEARED_AXIS` stays without a role, and `axis` becomes `const axis = (accountRole: AccountRole, overrides: Partial<AxisPayload> = {}): AxisPayload => ({ ...CLEARED_AXIS, teacherSubject: null, institutionType: null, accountRole, ...overrides });`. Every call passes the caller's role: `axis(AccountRole.Student, {...})` for studentA/studentB/studentLegacy and `axis(AccountRole.Teacher, ...)` for the teacher. P-B2 becomes: "teacher GET reports isComplete: false until branch and institution are set": GET expects `isComplete: false, teacherSubject: null, institutionType: null`; `axis(AccountRole.Teacher)` PUT returns 200 with `isComplete: false`; `axis(AccountRole.Teacher, { teacherSubject: 'COGRAFYA', institutionType: 'DEVLET_OKULU' })` returns 200 with `isComplete: true`; the education-fields PUT still expects 400. P-A5's "partial payload" case must still be a 400 (it omits `accountRole` now too).
- `test/auth-endpoints.e2e-spec.ts` `'registers a PARENT/SECONDARY with schoolName …'`: rename to `'refuses a PARENT carrying a schoolName (T-103: the child is not identified)'`, expect `HttpStatus.BAD_REQUEST`, and delete its verify/assert lines. Add right after it the positive twin without `schoolName` that expects 202, verifies, and asserts `accountRole: 'PARENT', gradeLevel: 'GRADE_9', studyStream: 'SAYISAL', schoolName: null`.

- [ ] **Step 8: New e2e for the four types and the role switch**

Create `test/auth-account-types.e2e-spec.ts`. Copy the whole scaffolding of `test/auth-account-lifecycle.e2e-spec.ts` (imports it uses, container, `RecordingMailer`, `payload`, `registerAndVerify`, `bearer`, `beforeAll`, `afterAll`) and replace its describe body with the tests below. Budget: six register calls, under the per-IP limit the copied header comment states.

```ts
describe("Account types (e2e, T-103)", () => {
  // …scaffolding copied from auth-account-lifecycle.e2e-spec.ts…

  const profileOf = async (token: string) =>
    (await request(app.getHttpServer()).get("/api/auth/profile").set(bearer(token)).expect(200))
      .body as Record<string, unknown>;

  it("registers an ENTHUSIAST with a referral source; the source is stored, never returned", async () => {
    const token = await registerAndVerify("enthusiast@example.test", {
      accountRole: "ENTHUSIAST",
      referralSource: "YOUTUBE",
    });
    const profile = await profileOf(token);
    expect(profile).toMatchObject({ accountRole: "ENTHUSIAST", isComplete: true });
    expect(profile).not.toHaveProperty("referralSource");
    const row = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: "enthusiast@example.test" });
    expect(row.referralSource).toBe("YOUTUBE");
  });

  it("registers a TEACHER with branch and institution", async () => {
    const token = await registerAndVerify("teacher-t103@example.test", {
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "DERSHANE_KURS",
    });
    expect(await profileOf(token)).toMatchObject({
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "DERSHANE_KURS",
      isComplete: true,
    });
  });

  it("refuses a TEACHER with only one of the two teacher fields", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send(
        payload("teacher-half@example.test", { accountRole: "TEACHER", teacherSubject: "DIGER" }),
      )
      .expect(HttpStatus.BAD_REQUEST);
  });

  it("switching TEACHER → PARENT in PUT /auth/profile clears the teacher fields", async () => {
    const token = await registerAndVerify("switch@example.test", {
      accountRole: "TEACHER",
      teacherSubject: "SOSYAL_BILGILER",
      institutionType: "OZEL_OKUL",
    });
    const res = await request(app.getHttpServer())
      .put("/api/auth/profile")
      .set(bearer(token))
      .send({
        accountRole: "PARENT",
        educationLevel: "SECONDARY",
        gradeLevel: "GRADE_12",
        studyStream: "ESIT_AGIRLIK",
        schoolName: null,
        universityName: null,
        departmentName: null,
        teacherSubject: null,
        institutionType: null,
      })
      .expect(200);
    expect(res.body).toMatchObject({
      accountRole: "PARENT",
      gradeLevel: "GRADE_12",
      teacherSubject: null,
      institutionType: null,
      isComplete: true,
    });
    const session = await request(app.getHttpServer())
      .get("/api/auth/session")
      .set(bearer(token))
      .expect(200);
    expect(session.body.accountRole).toBe("PARENT");
  });

  it("refuses a role switch whose fields belong to the old role, and changes nothing", async () => {
    const token = await registerAndVerify("switch-bad@example.test", {
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "DEVLET_OKULU",
    });
    await request(app.getHttpServer())
      .put("/api/auth/profile")
      .set(bearer(token))
      .send({
        accountRole: "ENTHUSIAST",
        educationLevel: null,
        gradeLevel: null,
        studyStream: null,
        schoolName: null,
        universityName: null,
        departmentName: null,
        teacherSubject: "COGRAFYA",
        institutionType: "DEVLET_OKULU",
      })
      .expect(HttpStatus.BAD_REQUEST);
    expect(await profileOf(token)).toMatchObject({
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
    });
  });

  it("refuses referralSource on PUT /auth/profile (not a declared property)", async () => {
    const token = await registerAndVerify("ref-put@example.test", { accountRole: "ENTHUSIAST" });
    await request(app.getHttpServer())
      .put("/api/auth/profile")
      .set(bearer(token))
      .send({
        accountRole: "ENTHUSIAST",
        educationLevel: null,
        gradeLevel: null,
        studyStream: null,
        schoolName: null,
        universityName: null,
        departmentName: null,
        teacherSubject: null,
        institutionType: null,
        referralSource: "GOOGLE",
      })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
```

If the per-IP register budget is below six, reuse the ENTHUSIAST test's token in the last test instead of registering a new account.

- [ ] **Step 9: Whole e2e lane, docs, commit**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:e2e` (CI has no `.env`; if a local `.env` sets `*_ENABLED=true`, the six upstream suites named in `CLAUDE.md` fail for that reason alone; say so rather than ignoring other failures).
Expected: all green; report exact counts.

`docs/architecture.md`: if its auth section names the roles or the profile fields, update that line to the four roles and the three new columns; if it does not, add nothing.

```bash
git add -A
git commit -m "feat(auth): account types, teacher and referral fields, role change on profile (T-103)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Push and open the API PR**

```bash
git push -u origin feature/t-103-account-types
gh pr create --base dev --title "feat(auth): account types, teacher and referral fields (T-103)" --body "$(cat <<'EOF'
Spec: cografya_web/docs/superpowers/specs/2026-09-26-t103-account-types-design.md

- `AccountRole` gains `ENTHUSIAST`. New nullable closed-set columns on `users` and `pending_registrations`: `teacher_subject`, `institution_type`, `referral_source` (migration `AddAccountTypesAndAudienceFields1790380800000`, hand-written).
- Profile-shape rule rewritten (TS + CHECK): TEACHER both teacher fields or neither; ENTHUSIAST nothing; PARENT minimal or SECONDARY without a school (the child); STUDENT unchanged.
- `PUT /auth/profile` now takes `accountRole` and the teacher fields and validates against the requested role. **Breaking** for the web client; the web PR follows.
- `referralSource` is stored at registration and returned by no endpoint.

Deploy preflight (must be 0, or `up()` rolls back):
`SELECT count(*) FROM users WHERE account_role = 'PARENT' AND (education_level IN ('UNDERGRADUATE','GRADUATE') OR school_name IS NOT NULL);`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Part B — `cografya_web`

Work in `/home/sertturk16/cografya_v4/cografya_web`, on the existing `feature/t-103-account-types` branch (it already carries the spec and this plan). Read `docs/copy.md` and `docs/design.md` before Task W4.

### Task W1: Contract sync

**Files:**

- Modify: `openapi/openapi.json` (copied), `lib/api/schema.ts` (generated), `lib/api/types.ts`
- Modify: `lib/auth/session.ts`, `lib/auth/transport.server.ts`, `lib/profile/transport.server.ts`, `lib/profile/client.ts`

**Interfaces:**

- Produces: `TeacherSubject`, `InstitutionType`, `ReferralSource` type aliases in `lib/api/types.ts`; `AccountRole` includes `"ENTHUSIAST"`; `Profile` has `teacherSubject`, `institutionType`; `UpdateProfileRequest` has `accountRole`, `teacherSubject`, `institutionType`.

- [ ] **Step 1: Copy and generate**

```bash
cp ../cografya_api/openapi/openapi.json openapi/openapi.json
pnpm codegen
pnpm typecheck   # expected: FAIL at the drift gates and at buildProfileReplacementPayload
```

- [ ] **Step 2: Aliases**

In `lib/api/types.ts`, next to `GradeLevel`/`StudyStream`/`EducationLevel`:

```ts
export type TeacherSubject = NonNullable<RegisterRequest["teacherSubject"]>;
export type InstitutionType = NonNullable<RegisterRequest["institutionType"]>;
export type ReferralSource = NonNullable<RegisterRequest["referralSource"]>;
```

and change the `AccountRole` docblock's "The two declared account roles" to "The four declared account roles (T-103)".

- [ ] **Step 3: Runtime guards follow the contract**

- `lib/auth/session.ts` and `lib/auth/transport.server.ts` `sessionSchema`: `accountRole: z.enum(["STUDENT", "TEACHER", "PARENT", "ENTHUSIAST"])`.
- `lib/profile/transport.server.ts` `profileSchema`: same role enum; add `teacherSubject: z.enum(["COGRAFYA", "SOSYAL_BILGILER", "DIGER"]).nullable(), institutionType: z.enum(["DEVLET_OKULU", "OZEL_OKUL", "DERSHANE_KURS", "DIGER"]).nullable(),`. `updateProfileRequestSchema` gains `accountRole: z.enum(["STUDENT", "TEACHER", "PARENT", "ENTHUSIAST"]),` and the same two nullable enums.
- `lib/profile/client.ts` `isProfileLike`: `isValidRole` adds `|| p.accountRole === "ENTHUSIAST"`; add

```ts
const isValidTeacherSubject =
  p.teacherSubject === null ||
  (typeof p.teacherSubject === "string" && Object.hasOwn(TEACHER_SUBJECT_LABELS, p.teacherSubject));
const isValidInstitutionType =
  p.institutionType === null ||
  (typeof p.institutionType === "string" &&
    Object.hasOwn(INSTITUTION_TYPE_LABELS, p.institutionType));
```

and `&& isValidTeacherSubject && isValidInstitutionType` in the return. (The two label tables arrive in W2; do W1 Step 3's `client.ts` part after W2 Step 3, or import them in W2.) Extend `lib/profile/client.test.ts`'s valid fixture with `teacherSubject: null, institutionType: null` and add one case: `isProfileLike({ ...valid, teacherSubject: "MATEMATIK" })` is `false`.

- [ ] **Step 4: Gate**

Run: `pnpm typecheck` — remaining errors may only be in `lib/auth/form-rules.ts` and its callers (fixed in W3). No commit yet; W1–W3 commit together once typecheck is green.

### Task W2: Label tables

**Files:**

- Modify: `lib/auth/profile-labels.ts`, `lib/auth/profile-labels.test.ts`

**Interfaces:**

- Produces: `ACCOUNT_ROLE_ORDER: readonly AccountRole[]` (`["STUDENT", "TEACHER", "PARENT", "ENTHUSIAST"]`), `ACCOUNT_ROLE_LABELS: Record<AccountRole, ProfileLabel>`, `TEACHER_SUBJECT_LABELS: Record<TeacherSubject, ProfileLabel>`, `INSTITUTION_TYPE_LABELS: Record<InstitutionType, ProfileLabel>`, `REFERRAL_SOURCE_LABELS: Record<ReferralSource, ProfileLabel>`. `USER_TYPE_LABELS` is deleted.

- [ ] **Step 1: Failing tests**

In `profile-labels.test.ts` replace the `USER_TYPE_LABELS` describe block (and its import) with:

```ts
describe("ACCOUNT_ROLE_LABELS (T-103)", () => {
  it("labels the four roles in the ruled order", () => {
    expect(ACCOUNT_ROLE_ORDER).toEqual(["STUDENT", "TEACHER", "PARENT", "ENTHUSIAST"]);
    expect(ACCOUNT_ROLE_ORDER.map((role) => ACCOUNT_ROLE_LABELS[role].tr)).toEqual([
      "Öğrenci",
      "Öğretmen",
      "Veli",
      "Coğrafya meraklısı",
    ]);
    for (const label of Object.values(ACCOUNT_ROLE_LABELS)) expect(label.en).toBeTruthy();
  });
});

describe("teacher and referral tables (T-103)", () => {
  it("carry exactly the contract's values, in the ruled order", () => {
    expect(Object.values(TEACHER_SUBJECT_LABELS).map((l) => l.tr)).toEqual([
      "Coğrafya",
      "Sosyal bilgiler",
      "Diğer",
    ]);
    expect(Object.values(INSTITUTION_TYPE_LABELS).map((l) => l.tr)).toEqual([
      "Devlet okulu",
      "Özel okul",
      "Dershane / kurs",
      "Diğer",
    ]);
    expect(Object.values(REFERRAL_SOURCE_LABELS).map((l) => l.tr)).toEqual([
      "Öğretmenim",
      "Arkadaşım",
      "YouTube",
      "Instagram",
      "Google",
      "Kitap",
      "Diğer",
    ]);
  });
});
```

and change the test at the old line 100 to `expect(renderLabel("en", ACCOUNT_ROLE_LABELS.TEACHER)).toEqual({ text: "Teacher" });`.

Run: `pnpm vitest run lib/auth/profile-labels.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement**

In `profile-labels.ts`: change the type import to `import type { AccountRole, EducationLevel, GradeLevel, InstitutionType, ReferralSource, StudyStream, TeacherSubject, UniversityType } from "@/lib/api/types";`, drop `import type { UserType }`, delete `USER_TYPE_LABELS` and its docblock, and add:

```ts
/** The four declared account types, in the order the picker shows them (T-103). */
export const ACCOUNT_ROLE_ORDER: readonly AccountRole[] = [
  "STUDENT",
  "TEACHER",
  "PARENT",
  "ENTHUSIAST",
];

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, ProfileLabel> = {
  STUDENT: { tr: "Öğrenci", en: "Student" },
  TEACHER: { tr: "Öğretmen", en: "Teacher" },
  PARENT: { tr: "Veli", en: "Parent" },
  ENTHUSIAST: { tr: "Coğrafya meraklısı", en: "Geography enthusiast" },
};

/** A teacher's branch (T-103). Key order is display order. */
export const TEACHER_SUBJECT_LABELS: Record<TeacherSubject, ProfileLabel> = {
  COGRAFYA: { tr: "Coğrafya", en: "Geography" },
  SOSYAL_BILGILER: { tr: "Sosyal bilgiler", en: "Social studies" },
  DIGER: { tr: "Diğer", en: "Other" },
};

/** Where a teacher works (T-103). Key order is display order. */
export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, ProfileLabel> = {
  DEVLET_OKULU: { tr: "Devlet okulu", en: "State school" },
  OZEL_OKUL: { tr: "Özel okul", en: "Private school" },
  DERSHANE_KURS: { tr: "Dershane / kurs", en: "Tutoring centre" },
  DIGER: { tr: "Diğer", en: "Other" },
};

/** "Bizi nereden duydun?" (T-103). Key order is display order. */
export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, ProfileLabel> = {
  OGRETMEN: { tr: "Öğretmenim", en: "My teacher" },
  ARKADAS: { tr: "Arkadaşım", en: "A friend" },
  YOUTUBE: { tr: "YouTube", en: "YouTube" },
  INSTAGRAM: { tr: "Instagram", en: "Instagram" },
  GOOGLE: { tr: "Google", en: "Google" },
  KITAP: { tr: "Kitap", en: "A book" },
  DIGER: { tr: "Diğer", en: "Other" },
};
```

Rewrite the `EDUCATION_LEVEL_LABELS` docblock's paragraph that contrasts it with `USER_TYPE_LABELS` into one sentence: "Answers 'what is your education level' for a member who declared Öğrenci."

Run: `pnpm vitest run lib/auth/profile-labels.test.ts` — Expected: PASS.

### Task W3: Payload builders

**Files:**

- Modify: `lib/auth/form-rules.ts`
- Test: `lib/auth/form-rules.contract.test.ts`, create `lib/auth/form-rules.account-types.test.ts`

**Interfaces:**

- Consumes: W1 aliases.
- Produces:
  - `type UserType = "student" | "secondary" | "undergraduate" | "graduate" | "teacher" | "parent" | "enthusiast"`
  - `RegisterFormState` + `teacherSubject?: TeacherSubject | ""`, `institutionType?: InstitutionType | ""`, `referralSource?: ReferralSource | ""`
  - `interface TeacherFormState { readonly teacherSubject: TeacherSubject | ""; readonly institutionType: InstitutionType | "" }`
  - `interface DeclaredProfileFormState { readonly accountRole: AccountRole; readonly education: ProfileAxisFormState; readonly childEducation: ProfileAxisFormState; readonly teacher: TeacherFormState }`
  - `buildProfileReplacementPayload(state: DeclaredProfileFormState): UpdateProfileRequest` (signature changed)

- [ ] **Step 1: Failing tests**

Create `lib/auth/form-rules.account-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildProfileReplacementPayload,
  buildRegisterPayload,
  type DeclaredProfileFormState,
  type ProfileAxisFormState,
  type RegisterFormState,
} from "./form-rules";

const EMPTY_AXIS: ProfileAxisFormState = {
  educationLevel: "",
  gradeLevel: "",
  studyStream: "",
  schoolName: "",
  universityName: "",
  departmentName: "",
};

const BASE: RegisterFormState = {
  firstName: "Ayşe",
  lastName: "Yılmaz",
  phone: "+905321112233",
  email: "ayse@example.test",
  password: "Synthetic-Pass1",
  passwordConfirm: "Synthetic-Pass1",
  userType: "student",
  provincePlateCode: "34",
  districtId: "6b3f6f5a-6f5a-4f5a-8f5a-6f5a6f5a6f5a",
  termsAccepted: true,
  marketingConsent: false,
};

describe("buildRegisterPayload — T-103 types", () => {
  it("a parent sends the child's grade and stream as SECONDARY, and never a school", () => {
    const body = buildRegisterPayload(
      {
        ...BASE,
        userType: "parent",
        gradeLevel: "GRADE_12",
        studyStream: "SAYISAL",
        schoolName: "X Lisesi",
      },
      "tr",
    );
    expect(body).toMatchObject({
      accountRole: "PARENT",
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_12",
      studyStream: "SAYISAL",
    });
    expect(body).not.toHaveProperty("schoolName");
  });

  it("a teacher sends both teacher fields and no education field", () => {
    const body = buildRegisterPayload(
      {
        ...BASE,
        userType: "teacher",
        teacherSubject: "COGRAFYA",
        institutionType: "OZEL_OKUL",
        gradeLevel: "GRADE_9",
      },
      "tr",
    );
    expect(body).toMatchObject({
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "OZEL_OKUL",
    });
    expect(body).not.toHaveProperty("educationLevel");
    expect(body).not.toHaveProperty("gradeLevel");
  });

  it("an enthusiast sends the role alone", () => {
    const body = buildRegisterPayload(
      { ...BASE, userType: "enthusiast", gradeLevel: "GRADE_9", teacherSubject: "DIGER" },
      "tr",
    );
    expect(body.accountRole).toBe("ENTHUSIAST");
    for (const key of [
      "educationLevel",
      "gradeLevel",
      "studyStream",
      "teacherSubject",
      "institutionType",
    ]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("sends referralSource only when one was chosen", () => {
    expect(buildRegisterPayload({ ...BASE, referralSource: "YOUTUBE" }, "tr")).toMatchObject({
      referralSource: "YOUTUBE",
    });
    expect(buildRegisterPayload({ ...BASE, referralSource: "" }, "tr")).not.toHaveProperty(
      "referralSource",
    );
  });
});

describe("buildProfileReplacementPayload — role switch (T-103)", () => {
  const state = (over: Partial<DeclaredProfileFormState>): DeclaredProfileFormState => ({
    accountRole: "STUDENT",
    education: {
      ...EMPTY_AXIS,
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_11",
      studyStream: "SOZEL",
    },
    childEducation: {
      ...EMPTY_AXIS,
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
    },
    teacher: { teacherSubject: "COGRAFYA", institutionType: "DEVLET_OKULU" },
    ...over,
  });

  it("always sends all nine keys", () => {
    expect(Object.keys(buildProfileReplacementPayload(state({}))).sort()).toEqual(
      [
        "accountRole",
        "departmentName",
        "educationLevel",
        "gradeLevel",
        "institutionType",
        "schoolName",
        "studyStream",
        "teacherSubject",
        "universityName",
      ].sort(),
    );
  });

  it("a student sends only the student's education, never the child's or the teacher's", () => {
    expect(buildProfileReplacementPayload(state({}))).toMatchObject({
      accountRole: "STUDENT",
      gradeLevel: "GRADE_11",
      studyStream: "SOZEL",
      teacherSubject: null,
      institutionType: null,
    });
  });

  it("a parent sends only the child's grade and stream", () => {
    expect(buildProfileReplacementPayload(state({ accountRole: "PARENT" }))).toEqual({
      accountRole: "PARENT",
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
      schoolName: null,
      universityName: null,
      departmentName: null,
      teacherSubject: null,
      institutionType: null,
    });
  });

  it("a teacher clears every education field", () => {
    expect(buildProfileReplacementPayload(state({ accountRole: "TEACHER" }))).toEqual({
      accountRole: "TEACHER",
      educationLevel: null,
      gradeLevel: null,
      studyStream: null,
      schoolName: null,
      universityName: null,
      departmentName: null,
      teacherSubject: "COGRAFYA",
      institutionType: "DEVLET_OKULU",
    });
  });

  it("an enthusiast clears everything", () => {
    const body = buildProfileReplacementPayload(state({ accountRole: "ENTHUSIAST" }));
    expect(body.accountRole).toBe("ENTHUSIAST");
    for (const [key, value] of Object.entries(body)) {
      if (key !== "accountRole") expect(value, key).toBeNull();
    }
  });
});
```

In `form-rules.contract.test.ts`, every `buildProfileReplacementPayload(x)` call becomes `buildProfileReplacementPayload({ accountRole: "STUDENT", education: x, childEducation: EMPTY_AXIS_FOR_TEST, teacher: { teacherSubject: "", institutionType: "" } })` (define the empty axis once in that file), and every expected object gains `accountRole: "STUDENT", teacherSubject: null, institutionType: null`.

Run: `pnpm vitest run lib/auth/form-rules.account-types.test.ts lib/auth/form-rules.contract.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement**

In `form-rules.ts`:

- Import `AccountRole, InstitutionType, ReferralSource, TeacherSubject` types from `@/lib/api/types` alongside the existing ones.
- `UserType` adds `| "parent" | "enthusiast"`; add one line to its docblock: "`parent` and `enthusiast` are T-103's; `parent` carries the child's secondary grade and stream."
- `RegisterFormState` adds the three optional fields with a one-line docblock each.
- In `buildRegisterPayload`, `common` gains `...(formState.referralSource ? { referralSource: formState.referralSource } : {}),`; replace the `teacher` case and add two cases:

```ts
    case "parent":
      // The child's grade and stream; a school name is never sent for a parent (spec §5.2).
      return {
        ...common,
        accountRole: "PARENT",
        ...(formState.gradeLevel && formState.studyStream
          ? {
              educationLevel: "SECONDARY",
              gradeLevel: formState.gradeLevel as GradeLevel,
              studyStream: formState.studyStream as StudyStream,
            }
          : {}),
      };
    case "teacher":
      return {
        ...common,
        accountRole: "TEACHER",
        ...(formState.teacherSubject && formState.institutionType
          ? { teacherSubject: formState.teacherSubject, institutionType: formState.institutionType }
          : {}),
      };
    case "enthusiast":
      return { ...common, accountRole: "ENTHUSIAST" };
```

- Update the profile-matrix table in the `buildRegisterPayload` docblock with three rows: `parent | PARENT | SECONDARY or absent | gradeLevel + studyStream | school, university, department, teacher fields`, `teacher | TEACHER | absent | teacherSubject + institutionType (or neither) | every education field`, `enthusiast | ENTHUSIAST | absent | — | everything`.
- Rename the existing `buildProfileReplacementPayload` to a private `educationAxisPayload(formState: ProfileAxisFormState)` returning the six education keys (body unchanged), and add:

```ts
/** The teacher block as a form holds it (T-103). */
export interface TeacherFormState {
  readonly teacherSubject: TeacherSubject | "";
  readonly institutionType: InstitutionType | "";
}

/**
 * Everything the settings card and the register wizard hold about a member's declared
 * profile (T-103). Three separate selections, so switching role back and forth never carries
 * one role's answers into another's payload; only the selected role's selection is read.
 */
export interface DeclaredProfileFormState {
  readonly accountRole: AccountRole;
  readonly education: ProfileAxisFormState;
  readonly childEducation: ProfileAxisFormState;
  readonly teacher: TeacherFormState;
}

const NO_EDUCATION = {
  educationLevel: null,
  gradeLevel: null,
  studyStream: null,
  schoolName: null,
  universityName: null,
  departmentName: null,
} as const;

const NO_TEACHER = { teacherSubject: null, institutionType: null } as const;

/**
 * Builds the COMPLETE nine-key body for `PUT /api/auth/profile`: the role plus every field,
 * with each field the role does not use as an explicit `null`. The nulls are what clear a
 * previous role's data when the role changes.
 */
export function buildProfileReplacementPayload(
  state: DeclaredProfileFormState,
): UpdateProfileRequest {
  switch (state.accountRole) {
    case "STUDENT":
      return { accountRole: "STUDENT", ...educationAxisPayload(state.education), ...NO_TEACHER };
    case "PARENT": {
      const { gradeLevel, studyStream } = state.childEducation;
      return gradeLevel && studyStream
        ? {
            accountRole: "PARENT",
            ...NO_EDUCATION,
            educationLevel: "SECONDARY",
            gradeLevel,
            studyStream,
            ...NO_TEACHER,
          }
        : { accountRole: "PARENT", ...NO_EDUCATION, ...NO_TEACHER };
    }
    case "TEACHER":
      return {
        accountRole: "TEACHER",
        ...NO_EDUCATION,
        teacherSubject: state.teacher.teacherSubject || null,
        institutionType: state.teacher.institutionType || null,
      };
    case "ENTHUSIAST":
      return { accountRole: "ENTHUSIAST", ...NO_EDUCATION, ...NO_TEACHER };
    default: {
      const exhaustive: never = state.accountRole;
      throw new Error(`buildProfileReplacementPayload: unreachable role ${String(exhaustive)}`);
    }
  }
}
```

Delete the `ProfileAxisFormState` docblock sentence claiming `accountRole` is not part of the request; replace it with "The education axis as a form holds it."

Run: `pnpm vitest run lib/auth` — Expected: PASS. `pnpm typecheck` now fails only in `v2-settings-education-card.tsx` and `v2-register-card.tsx` (fixed in W5/W6).

### Task W4: Shared UI — role picker, teacher fieldset, child variant, declared-profile fields

**Files:**

- Create: `components/v2/account-role-picker.tsx`, `components/v2/teacher-fieldset.tsx`, `components/v2/declared-profile-fields.tsx`, `components/v2/declared-profile-fields.test.ts`
- Modify: `components/v2/education-fieldset.tsx`, `messages/tr.json`, `messages/en.json`

**Interfaces:**

- Consumes: W2 labels, W3 `DeclaredProfileFormState`, `TeacherFormState`.
- Produces:
  - `AccountRolePicker({ locale, idPrefix, value, onChange, disabled? })`
  - `EducationFieldset` + prop `variant?: "student" | "child"`; `EMPTY_CHILD_EDUCATION_SELECTION`
  - `TeacherFieldset({ locale, value, onChange, errors, idPrefix, disabled? })`, `EMPTY_TEACHER_SELECTION`, `missingTeacherFields(v): TeacherFieldKey[]`, `type TeacherFieldKey = "teacherSubject" | "institutionType"`
  - `DeclaredProfileFields({ locale, value, onChange, errors, idPrefix, disabled? })`, `type DeclaredProfileSelection = DeclaredProfileFormState`, `type DeclaredFieldKey = EducationFieldKey | TeacherFieldKey`, `roleHasDetails(role): boolean`, `emptyDeclaredProfile(role): DeclaredProfileSelection`, `declaredProfileFromProfile(profile: Profile): DeclaredProfileSelection`, `missingDeclaredFields(v): DeclaredFieldKey[]`, `declaredFieldElementId(idPrefix, key): string`

- [ ] **Step 1: Messages**

`messages/tr.json` → `Auth.fields` add:

```json
"accountRole": "Hesap türü",
"childGrade": "Çocuğun kaçıncı sınıfta?",
"childStream": "Hangi alana hazırlanıyor?",
"groupChild": "Çocuğunun bilgileri",
"teacherSubject": "Branşın",
"institutionType": "Çalıştığın kurum"
```

`messages/en.json` → `Auth.fields` add:

```json
"accountRole": "Account type",
"childGrade": "Your child's grade",
"childStream": "Their track",
"groupChild": "Your child's details",
"teacherSubject": "Your subject",
"institutionType": "Where you teach"
```

- [ ] **Step 2: Failing logic tests**

Create `components/v2/declared-profile-fields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/api/types";
import {
  declaredFieldElementId,
  declaredProfileFromProfile,
  emptyDeclaredProfile,
  missingDeclaredFields,
  roleHasDetails,
} from "./declared-profile-fields";

const PROFILE_BASE = {
  educationLevel: null,
  gradeLevel: null,
  studyStream: null,
  schoolName: null,
  universityName: null,
  departmentName: null,
  teacherSubject: null,
  institutionType: null,
} as const;

describe("declared profile rules (T-103)", () => {
  it("only the enthusiast has no second step", () => {
    expect(roleHasDetails("STUDENT")).toBe(true);
    expect(roleHasDetails("PARENT")).toBe(true);
    expect(roleHasDetails("TEACHER")).toBe(true);
    expect(roleHasDetails("ENTHUSIAST")).toBe(false);
  });

  it("names the missing fields of the selected role only", () => {
    expect(missingDeclaredFields(emptyDeclaredProfile("STUDENT"))).toEqual(["educationLevel"]);
    expect(missingDeclaredFields(emptyDeclaredProfile("PARENT"))).toEqual([
      "gradeLevel",
      "studyStream",
    ]);
    expect(missingDeclaredFields(emptyDeclaredProfile("TEACHER"))).toEqual([
      "teacherSubject",
      "institutionType",
    ]);
    expect(missingDeclaredFields(emptyDeclaredProfile("ENTHUSIAST"))).toEqual([]);
  });

  it("a parent's stored education becomes the child selection, not the student one", () => {
    const value = declaredProfileFromProfile({
      ...PROFILE_BASE,
      accountRole: "PARENT",
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
    } as Profile);
    expect(value.childEducation).toMatchObject({
      educationLevel: "SECONDARY",
      gradeLevel: "GRADE_8",
      studyStream: "LGS",
    });
    expect(value.education.educationLevel).toBe("");
  });

  it("a teacher's stored fields become the teacher selection", () => {
    const value = declaredProfileFromProfile({
      ...PROFILE_BASE,
      accountRole: "TEACHER",
      teacherSubject: "COGRAFYA",
      institutionType: "DERSHANE_KURS",
    } as Profile);
    expect(value.teacher).toEqual({ teacherSubject: "COGRAFYA", institutionType: "DERSHANE_KURS" });
  });

  it("element ids follow the fieldsets' kebab spelling", () => {
    expect(declaredFieldElementId("settings-profile", "gradeLevel")).toBe(
      "settings-profile-grade-level",
    );
    expect(declaredFieldElementId("v2-register-details", "institutionType")).toBe(
      "v2-register-details-institution-type",
    );
  });
});
```

Run: `pnpm vitest run components/v2/declared-profile-fields.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Child variant of `EducationFieldset`**

In `components/v2/education-fieldset.tsx`:

- Add to `EducationFieldsetProps`:

```ts
  /**
   * `child` (T-103) is a parent describing their child: the level is fixed to SECONDARY and
   * not shown, the labels speak about the child, and no school name is asked.
   */
  readonly variant?: "student" | "child";
```

- Export after `EMPTY_EDUCATION_SELECTION`:

```ts
/** A parent's starting point: the child is always on the secondary branch (T-103). */
export const EMPTY_CHILD_EDUCATION_SELECTION: EducationSelection = {
  ...EMPTY_EDUCATION_SELECTION,
  educationLevel: "SECONDARY",
};
```

- Destructure `variant = "student"`. Wrap the education-level `<div className="space-y-1.5">…</div>` block in `{variant === "student" && (…)}`. In the SECONDARY fieldset: the legend text becomes `{variant === "child" ? t("fields.groupChild") : t("fields.groupSecondary")}`, the grade label `{variant === "child" ? t("fields.childGrade") : t("fields.grade")}`, the stream label `{variant === "child" ? t("fields.childStream") : t("fields.stream")}`, and the school-name `<div>` is wrapped in `{variant === "student" && (…)}`.
- Add a sentence to the component docblock: "`variant=\"child\"` is the parent's step (T-103)."

- [ ] **Step 4: `TeacherFieldset`**

Create `components/v2/teacher-fieldset.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { InstitutionType, TeacherSubject } from "@/lib/api/types";
import type { TeacherFormState } from "@/lib/auth/form-rules";
import {
  INSTITUTION_TYPE_LABELS,
  TEACHER_SUBJECT_LABELS,
  renderLabel,
} from "@/lib/auth/profile-labels";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type TeacherSelection = TeacherFormState;
export type TeacherFieldKey = keyof TeacherSelection;

export const EMPTY_TEACHER_SELECTION: TeacherSelection = {
  teacherSubject: "",
  institutionType: "",
};

export interface TeacherFieldsetProps {
  readonly locale: Locale;
  readonly value: TeacherSelection;
  readonly onChange: (next: TeacherSelection) => void;
  readonly errors: Partial<Record<TeacherFieldKey, string>>;
  readonly idPrefix: string;
  readonly disabled?: boolean;
}

/** A teacher's second step (T-103): branch and institution type, both required. */
export function TeacherFieldset({
  locale,
  value,
  onChange,
  errors,
  idPrefix,
  disabled = false,
}: TeacherFieldsetProps) {
  const t = useTranslations("Auth");
  const ids = {
    teacherSubject: `${idPrefix}-teacher-subject`,
    institutionType: `${idPrefix}-institution-type`,
  } as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={ids.teacherSubject} className="text-xs font-bold text-foreground">
          {t("fields.teacherSubject")}
        </Label>
        <Select
          id={ids.teacherSubject}
          value={value.teacherSubject}
          onChange={(e) =>
            onChange({ ...value, teacherSubject: e.target.value as TeacherSubject | "" })
          }
          disabled={disabled}
          aria-invalid={Boolean(errors.teacherSubject)}
          aria-describedby={errors.teacherSubject ? `${ids.teacherSubject}-error` : undefined}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {(Object.keys(TEACHER_SUBJECT_LABELS) as TeacherSubject[]).map((key) => {
            const label = renderLabel(locale, TEACHER_SUBJECT_LABELS[key]);
            return (
              <option key={key} value={key} lang={label.lang}>
                {label.text}
              </option>
            );
          })}
        </Select>
        <FieldError id={`${ids.teacherSubject}-error`} message={errors.teacherSubject} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={ids.institutionType} className="text-xs font-bold text-foreground">
          {t("fields.institutionType")}
        </Label>
        <Select
          id={ids.institutionType}
          value={value.institutionType}
          onChange={(e) =>
            onChange({ ...value, institutionType: e.target.value as InstitutionType | "" })
          }
          disabled={disabled}
          aria-invalid={Boolean(errors.institutionType)}
          aria-describedby={errors.institutionType ? `${ids.institutionType}-error` : undefined}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {(Object.keys(INSTITUTION_TYPE_LABELS) as InstitutionType[]).map((key) => {
            const label = renderLabel(locale, INSTITUTION_TYPE_LABELS[key]);
            return (
              <option key={key} value={key} lang={label.lang}>
                {label.text}
              </option>
            );
          })}
        </Select>
        <FieldError id={`${ids.institutionType}-error`} message={errors.institutionType} />
      </div>
    </div>
  );
}

export function missingTeacherFields(value: TeacherSelection): TeacherFieldKey[] {
  const missing: TeacherFieldKey[] = [];
  if (!value.teacherSubject) missing.push("teacherSubject");
  if (!value.institutionType) missing.push("institutionType");
  return missing;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[11px] font-medium text-destructive">
      {message}
    </p>
  );
}
```

- [ ] **Step 5: `DeclaredProfileFields`**

Create `components/v2/declared-profile-fields.tsx`:

```tsx
"use client";

import type { Locale } from "@/i18n/routing";
import type { AccountRole, Profile } from "@/lib/api/types";
import type { DeclaredProfileFormState } from "@/lib/auth/form-rules";
import {
  EducationFieldset,
  EMPTY_CHILD_EDUCATION_SELECTION,
  EMPTY_EDUCATION_SELECTION,
  educationSelectionFromProfile,
  missingEducationFields,
  type EducationFieldKey,
} from "./education-fieldset";
import {
  EMPTY_TEACHER_SELECTION,
  TeacherFieldset,
  missingTeacherFields,
  type TeacherFieldKey,
} from "./teacher-fieldset";

export type DeclaredProfileSelection = DeclaredProfileFormState;
export type DeclaredFieldKey = EducationFieldKey | TeacherFieldKey;

/** Every role but the enthusiast has a second step (spec §1.2). */
export function roleHasDetails(role: AccountRole): boolean {
  return role !== "ENTHUSIAST";
}

export function emptyDeclaredProfile(role: AccountRole): DeclaredProfileSelection {
  return {
    accountRole: role,
    education: EMPTY_EDUCATION_SELECTION,
    childEducation: EMPTY_CHILD_EDUCATION_SELECTION,
    teacher: EMPTY_TEACHER_SELECTION,
  };
}

/** A stored profile, split into the selection its own role uses. */
export function declaredProfileFromProfile(profile: Profile): DeclaredProfileSelection {
  const stored = educationSelectionFromProfile(profile);
  return {
    accountRole: profile.accountRole,
    education: profile.accountRole === "STUDENT" ? stored : EMPTY_EDUCATION_SELECTION,
    childEducation:
      profile.accountRole === "PARENT"
        ? {
            ...EMPTY_CHILD_EDUCATION_SELECTION,
            gradeLevel: stored.gradeLevel,
            studyStream: stored.studyStream,
          }
        : EMPTY_CHILD_EDUCATION_SELECTION,
    teacher: {
      teacherSubject: profile.teacherSubject ?? "",
      institutionType: profile.institutionType ?? "",
    },
  };
}

/** The selected role's missing required fields, in display order. */
export function missingDeclaredFields(value: DeclaredProfileSelection): DeclaredFieldKey[] {
  switch (value.accountRole) {
    case "STUDENT":
      return missingEducationFields(value.education);
    case "PARENT":
      return missingEducationFields(value.childEducation);
    case "TEACHER":
      return missingTeacherFields(value.teacher);
    case "ENTHUSIAST":
      return [];
  }
}

/** The element id a fieldset gives `key` under `idPrefix` (`gradeLevel` → `…-grade-level`). */
export function declaredFieldElementId(idPrefix: string, key: DeclaredFieldKey): string {
  return `${idPrefix}-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export interface DeclaredProfileFieldsProps {
  readonly locale: Locale;
  readonly value: DeclaredProfileSelection;
  readonly onChange: (next: DeclaredProfileSelection) => void;
  readonly errors: Partial<Record<DeclaredFieldKey, string>>;
  readonly idPrefix: string;
  readonly disabled?: boolean;
}

/**
 * The second step for the selected role (T-103), shared by the register wizard and the
 * settings card so both ask the same questions with the same rules.
 */
export function DeclaredProfileFields({
  locale,
  value,
  onChange,
  errors,
  idPrefix,
  disabled = false,
}: DeclaredProfileFieldsProps) {
  switch (value.accountRole) {
    case "STUDENT":
      return (
        <EducationFieldset
          locale={locale}
          value={value.education}
          onChange={(education) => onChange({ ...value, education })}
          errors={errors}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      );
    case "PARENT":
      return (
        <EducationFieldset
          variant="child"
          locale={locale}
          value={value.childEducation}
          onChange={(childEducation) => onChange({ ...value, childEducation })}
          errors={errors}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      );
    case "TEACHER":
      return (
        <TeacherFieldset
          locale={locale}
          value={value.teacher}
          onChange={(teacher) => onChange({ ...value, teacher })}
          errors={errors}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      );
    case "ENTHUSIAST":
      return null;
  }
}
```

- [ ] **Step 6: `AccountRolePicker`**

Create `components/v2/account-role-picker.tsx`:

```tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Compass, GraduationCap, Users } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { AccountRole } from "@/lib/api/types";
import { ACCOUNT_ROLE_LABELS, ACCOUNT_ROLE_ORDER, renderLabel } from "@/lib/auth/profile-labels";

const ROLE_ICONS: Record<AccountRole, React.ReactNode> = {
  STUDENT: <GraduationCap className="size-3.5 shrink-0" />,
  TEACHER: <Briefcase className="size-3.5 shrink-0" />,
  PARENT: <Users className="size-3.5 shrink-0" />,
  ENTHUSIAST: <Compass className="size-3.5 shrink-0" />,
};

export interface AccountRolePickerProps {
  readonly locale: Locale;
  readonly idPrefix: string;
  readonly value: AccountRole;
  readonly onChange: (role: AccountRole) => void;
  readonly disabled?: boolean;
}

/**
 * The four account types as one radio group (T-103), used by registration step 1 and the
 * settings card. Roving tabindex with arrow keys, as the register card's two-option group had.
 * Labels wrap instead of truncating: "Coğrafya meraklısı" does not fit half a 320 px card.
 */
export function AccountRolePicker({
  locale,
  idPrefix,
  value,
  onChange,
  disabled = false,
}: AccountRolePickerProps) {
  const t = useTranslations("Auth");
  const labelId = `${idPrefix}-label`;

  const move = (from: number, delta: number, group: HTMLElement | null) => {
    const count = ACCOUNT_ROLE_ORDER.length;
    const index = (from + delta + count) % count;
    const next = ACCOUNT_ROLE_ORDER[index];
    if (next) onChange(next);
    (group?.children[index] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block text-xs font-bold text-foreground">
        {t("fields.accountRole")}
      </span>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-labelledby={labelId}>
        {ACCOUNT_ROLE_ORDER.map((role, idx) => {
          const checked = value === role;
          const label = renderLabel(locale, ACCOUNT_ROLE_LABELS[role]);
          return (
            <button
              key={role}
              id={`${idPrefix}-${role.toLowerCase()}`}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(role)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  move(idx, 1, e.currentTarget.parentElement);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  move(idx, -1, e.currentTarget.parentElement);
                }
              }}
              className={`min-h-10 p-2 rounded-xl border text-xs font-medium flex items-center gap-2 text-left transition-all ${
                checked
                  ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                  : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {ROLE_ICONS[role]}
              <span className="text-[11px] leading-tight" lang={label.lang}>
                {label.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Gate**

Run: `pnpm vitest run components/v2/declared-profile-fields.test.ts components/v2/education-fieldset.test.ts lib/auth/messages.test.ts` — Expected: PASS (if `education-fieldset.test.ts` pins the level select's unconditional presence, extend its assertion to `variant === "student" &&`, do not delete it).

### Task W5: Register wizard

**Files:**

- Modify: `components/v2/v2-register-card.tsx`, `components/v2/v2-register-card.structure.test.ts`

**Interfaces:**

- Consumes: W3 `UserType`, `RegisterFormState`; W4 `AccountRolePicker`, `DeclaredProfileFields`, `emptyDeclaredProfile`, `missingDeclaredFields`, `roleHasDetails`, `declaredFieldElementId`; W2 `REFERRAL_SOURCE_LABELS`.

- [ ] **Step 1: Structure test first**

In `v2-register-card.structure.test.ts`:

- First test: expect an import of `AccountRolePicker` from `"./account-role-picker"` instead of `USER_TYPE_LABELS` from `@/lib/auth/profile-labels` (rename the test accordingly).
- Replace "derives role labels from canonical USER_TYPE_LABELS" with:

```ts
it("draws the four account types through the shared picker, not a local list (T-103)", () => {
  expect(source).toContain("<AccountRolePicker");
  expect(source).not.toContain("USER_TYPE_LABELS");
  expect(source).not.toContain("USER_ROLES");
});
```

- The T-061 test: expect `from "./declared-profile-fields"` and `idPrefix="v2-register-details"` instead of the education-fieldset import and id prefix; keep its negative assertions.
- Replace "never shows the education step to a teacher …" with:

```ts
it("opens the details step for every role that has one, and skips it only for the enthusiast", () => {
  expect(source).toContain(
    'if (roleHasDetails(declared.accountRole)) {\n      setStep("details");',
  );
  // Only the selected role's selection reaches the payload.
  expect(source).toContain("userType: userTypeFor(declared)");
  expect(source).toContain("...roleFieldsFor(declared)");
});

it("asks where the member heard of us, optionally, in step 1 (T-103)", () => {
  expect(source).toContain('id="v2-register-referral"');
  expect(source).toContain("REFERRAL_SOURCE_LABELS");
  expect(source).toContain("isteğe bağlı");
  expect(source).toContain("referralSource,");
});
```

Run: `pnpm vitest run components/v2/v2-register-card.structure.test.ts` — Expected: FAIL.

- [ ] **Step 2: Rewire the card**

In `v2-register-card.tsx`:

1. Imports: remove `USER_TYPE_LABELS`, the `EducationFieldset` group import, `GraduationCap` and `Briefcase` (if now unused); add

```tsx
import type { AccountRole, ReferralSource } from "@/lib/api/types";
import { REFERRAL_SOURCE_LABELS } from "@/lib/auth/profile-labels";
import { AccountRolePicker } from "./account-role-picker";
import {
  DeclaredProfileFields,
  declaredFieldElementId,
  emptyDeclaredProfile,
  missingDeclaredFields,
  roleHasDetails,
  type DeclaredFieldKey,
  type DeclaredProfileSelection,
} from "./declared-profile-fields";
```

2. Delete `USER_ROLES`. `type RegisterStep = "identity" | "details" | "verify";` and update its docblock ("`details` is the selected role's second step; the enthusiast has none").
3. Replace `userTypeFor` with:

```tsx
/** The payload branch for the selected role; a student's also depends on their level. */
function userTypeFor(declared: DeclaredProfileSelection): UserType {
  switch (declared.accountRole) {
    case "TEACHER":
      return "teacher";
    case "PARENT":
      return "parent";
    case "ENTHUSIAST":
      return "enthusiast";
    case "STUDENT":
      switch (declared.education.educationLevel) {
        case "SECONDARY":
          return "secondary";
        case "UNDERGRADUATE":
          return "undergraduate";
        case "GRADUATE":
          return "graduate";
        default:
          return "student";
      }
  }
}

/** Only the selected role's answers go into the form state (spec Review Focus 3). */
function roleFieldsFor(
  declared: DeclaredProfileSelection,
): Pick<
  RegisterFormState,
  | "gradeLevel"
  | "studyStream"
  | "schoolName"
  | "universityName"
  | "departmentName"
  | "teacherSubject"
  | "institutionType"
> {
  switch (declared.accountRole) {
    case "STUDENT":
      return {
        gradeLevel: declared.education.gradeLevel,
        studyStream: declared.education.studyStream,
        schoolName: declared.education.schoolName,
        universityName: declared.education.universityName,
        departmentName: declared.education.departmentName,
      };
    case "PARENT":
      return {
        gradeLevel: declared.childEducation.gradeLevel,
        studyStream: declared.childEducation.studyStream,
      };
    case "TEACHER":
      return {
        teacherSubject: declared.teacher.teacherSubject,
        institutionType: declared.teacher.institutionType,
      };
    case "ENTHUSIAST":
      return {};
  }
}

/** Step 2's subtitle, per role. The enthusiast never reaches step 2. */
const DETAILS_SUBTITLE: Record<Exclude<AccountRole, "ENTHUSIAST">, string> = {
  STUDENT: "Son bir adım: ne okuduğunu söyle, içerikleri ona göre gösterelim.",
  PARENT: "Son bir adım: çocuğunun sınıfını ve hazırlandığı alanı söyle.",
  TEACHER: "Son bir adım: branşını ve çalıştığın kurumu söyle.",
};
```

4. State: replace `education`/`educationErrors`/`selectedRole` with

```tsx
const [declared, setDeclared] = React.useState<DeclaredProfileSelection>(() =>
  emptyDeclaredProfile("STUDENT"),
);
const [detailsErrors, setDetailsErrors] = React.useState<Partial<Record<DeclaredFieldKey, string>>>(
  {},
);
const [referralSource, setReferralSource] = React.useState<ReferralSource | "">("");
```

and in `useUnsavedChanges(...)` replace the `education` clause with `JSON.stringify(declared) !== JSON.stringify(emptyDeclaredProfile(declared.accountRole)) || referralSource !== ""`. Update the docblock sentence about `selectedRole` to "The role itself is excluded: it has a default and an untouched form must not read as dirty."

5. `handleRegisterSubmit`: replace the teacher branch with

```tsx
// Every role but the enthusiast declares something before the account is created.
if (roleHasDetails(declared.accountRole)) {
  setStep("details");
  return;
}
```

6. `sendRegistration`'s `formState`: `userType: userTypeFor(declared),`, add `referralSource,`, and replace the `...(selectedRole === "teacher" ? {} : {...})` spread with `...roleFieldsFor(declared),`.
7. Rename `handleEducationSubmit` → `handleDetailsSubmit`:

```tsx
const handleDetailsSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setGeneralError(null);

  const missing = missingDeclaredFields(declared);
  if (missing.length > 0) {
    const next: Partial<Record<DeclaredFieldKey, string>> = {};
    for (const key of missing) next[key] = "Bu alan zorunlu.";
    setDetailsErrors(next);
    const first = missing[0];
    if (first)
      document.getElementById(declaredFieldElementId("v2-register-details", first))?.focus();
    return;
  }

  setDetailsErrors({});
  await sendRegistration({
    cleanFirst: firstName.trim(),
    cleanLast: lastName.trim(),
    cleanPhone: canonicalizePhone(phone) as string,
    cleanEmail: email.trim(),
  });
};
```

8. Header subtitle: the `step === "education"` branch becomes `step === "details" ? DETAILS_SUBTITLE[declared.accountRole as Exclude<AccountRole, "ENTHUSIAST">]`.
9. Step 1: replace the whole "User Role Selector" block with

```tsx
<AccountRolePicker
  locale={locale}
  idPrefix="v2-register-role"
  value={declared.accountRole}
  onChange={(accountRole) => setDeclared({ ...declared, accountRole })}
  disabled={loading}
/>
```

10. Step 1: directly above the T-101 consent block, add the referral select, styled exactly like the İl `<select>` (same wrapper `div.relative`, same `className` string, same chevron element if the İl select renders one):

```tsx
<div className="space-y-1.5">
  <Label htmlFor="v2-register-referral" className="text-xs font-bold text-foreground">
    Bizi nereden duydun? <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
  </Label>
  <div className="relative">
    <select
      id="v2-register-referral"
      value={referralSource}
      onChange={(e) => setReferralSource(e.target.value as ReferralSource | "")}
      disabled={loading}
      className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs text-foreground appearance-none hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 transition-all duration-150"
    >
      <option value="">Seç...</option>
      {(Object.keys(REFERRAL_SOURCE_LABELS) as ReferralSource[]).map((key) => (
        <option key={key} value={key}>
          {REFERRAL_SOURCE_LABELS[key].tr}
        </option>
      ))}
    </select>
  </div>
</div>
```

11. Step 1 submit button: `{roleHasDetails(declared.accountRole) ? "Devam Et" : "Ücretsiz Kayıt Ol"}`; update the comment above it.
12. Step 2: `{step === "details" && (` … `onSubmit={handleDetailsSubmit}`; the sr-only status uses `detailsErrors` and reads `` `İkinci adımda ${Object.keys(detailsErrors).length} adet düzeltilmesi gereken alan var.` ``; replace `<EducationFieldset …/>` with

```tsx
<DeclaredProfileFields
  locale={locale}
  value={declared}
  onChange={(next) => {
    setDeclared(next);
    setDetailsErrors({});
    setGeneralError(null);
  }}
  errors={detailsErrors}
  idPrefix="v2-register-details"
  disabled={loading}
/>
```

and its comment becomes `{/* STEP 2: the selected role's details */}`.

Run: `pnpm vitest run components/v2/v2-register-card.structure.test.ts` — Expected: PASS.

### Task W6: Settings — the account-type card

**Files:**

- Create: `components/v2/v2-settings-profile-card.tsx`
- Delete: `components/v2/v2-settings-education-card.tsx`
- Modify: `components/v2/v2-account-settings.tsx`, `components/v2/v2-settings-account-card.tsx`, `components/v2/v2-account-settings.test.ts`, `messages/tr.json`, `messages/en.json`

**Interfaces:**

- Consumes: W3 `buildProfileReplacementPayload(DeclaredProfileFormState)`, W4 exports.
- Produces: section anchor `#hesap-turu` (the hub links to it in W7).

- [ ] **Step 1: Messages**

In both catalogues, rename `Settings.education` to `Settings.profile` and set its values. TR:

```json
"profile": {
  "title": "Hesap Türü",
  "description": "Kim olduğun ve buna bağlı bilgilerin. Hesap türünü buradan değiştirebilirsin.",
  "complete": "Tamam",
  "incomplete": "Eksik alanlar var",
  "roleChangeNotice": "Hesap türünü değiştirip kaydedersen önceki türe ait bilgiler silinir."
}
```

EN (keep the old `complete`/`incomplete` EN values if they differ from these):

```json
"profile": {
  "title": "Account type",
  "description": "Who you are and the details that go with it. You can change your account type here.",
  "complete": "Complete",
  "incomplete": "Missing details",
  "roleChangeNotice": "If you change your account type and save, the previous type's details are removed."
}
```

Delete `Settings.account.role`, `roleStudent`, `roleTeacher`, `roleParent` from both files. Verify with `grep -rn "account.role" components app lib` that nothing else reads the deleted keys.

- [ ] **Step 2: Tests first**

In `v2-account-settings.test.ts`:

- Wherever the file reads `v2-settings-education-card.tsx` into `EDUCATION`, read `v2-settings-profile-card.tsx` into `PROFILE` and rename every use.
- Replace "shows the education section to a STUDENT and a PARENT only" and "drops the section from the jump list when it is not rendered" with:

```ts
it("shows the account-type section to every role (T-103)", () => {
  expect(SHELL).toContain("<V2SettingsProfileCard");
  expect(SHELL).not.toContain("showsEducation");
  expect(SHELL).toContain('{ id: "hesap-turu", label: t("profile.title") }');
});

it("changes the role and its fields in one save, and warns before a role change", () => {
  expect(PROFILE).toContain("<AccountRolePicker");
  expect(PROFILE).toContain("<DeclaredProfileFields");
  expect(PROFILE).toContain("submitProfileReplacement(buildProfileReplacementPayload(value))");
  expect(PROFILE).toContain('t("profile.roleChangeNotice")');
});
```

- The "renders all five for a student, in the ruled order" test: its card list uses `V2SettingsProfileCard` in the education card's position.
- "gives a teacher three populated sections" becomes "renders every section unconditionally": the list of mounts now includes the profile card, and none contains `&&`.
- In the "account section is read-only" describe add `expect(ACCOUNT).not.toContain("account.role");`.

Run: `pnpm vitest run components/v2/v2-account-settings.test.ts` — Expected: FAIL.

- [ ] **Step 3: The card**

Create `components/v2/v2-settings-profile-card.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useUnsavedChanges } from "@/lib/forms/use-unsaved-changes.client";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/api/types";
import { buildProfileReplacementPayload } from "@/lib/auth/form-rules";
import { PROFILE_ERROR_MESSAGE_KEYS, submitProfileReplacement } from "@/lib/profile/client";
import type { ProfileBffCode } from "@/lib/profile/transport.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountRolePicker } from "./account-role-picker";
import {
  DeclaredProfileFields,
  declaredFieldElementId,
  declaredProfileFromProfile,
  missingDeclaredFields,
  type DeclaredFieldKey,
  type DeclaredProfileSelection,
} from "./declared-profile-fields";
import { SettingsCard, SettingsResult } from "./v2-settings-card";

const ID_PREFIX = "settings-profile";

export interface V2SettingsProfileCardProps {
  readonly locale: Locale;
  readonly profile: Profile;
}

/**
 * "Hesap Türü" (T-103): the declared role and that role's fields, for every member.
 *
 * The role and its fields save together through `PUT /api/profile`, because a role without
 * its fields (or fields of another role) is a shape the API refuses. Switching the role shows
 * the new role's fields in place and a one-line notice; nothing is written until the member
 * saves, and the save clears the previous role's data.
 */
export function V2SettingsProfileCard({ locale, profile }: V2SettingsProfileCardProps) {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const router = useRouter();

  const [value, setValue] = React.useState<DeclaredProfileSelection>(() =>
    declaredProfileFromProfile(profile),
  );
  const [savedRole, setSavedRole] = React.useState(profile.accountRole);
  const [isComplete, setIsComplete] = React.useState(profile.isComplete);
  const [errors, setErrors] = React.useState<Partial<Record<DeclaredFieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<ProfileBffCode | null>(null);
  const [baseline, setBaseline] = React.useState(() =>
    JSON.stringify(declaredProfileFromProfile(profile)),
  );

  useUnsavedChanges(JSON.stringify(value) !== baseline);

  const handleChange = (next: DeclaredProfileSelection) => {
    setValue(next);
    setErrors({});
    setSaved(false);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);

    const missing = missingDeclaredFields(value);
    if (missing.length > 0) {
      const next: Partial<Record<DeclaredFieldKey, string>> = {};
      for (const key of missing) next[key] = tAuth("fieldErrors.required");
      setErrors(next);
      const first = missing[0];
      if (first) document.getElementById(declaredFieldElementId(ID_PREFIX, first))?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitProfileReplacement(buildProfileReplacementPayload(value));
      if (res.ok) {
        const next = declaredProfileFromProfile(res.profile);
        setSaved(true);
        setIsComplete(res.profile.isComplete);
        setSavedRole(res.profile.accountRole);
        setValue(next);
        setBaseline(JSON.stringify(next));
        router.refresh();
      } else {
        setSubmitError(res.code);
      }
    } catch {
      setSubmitError("errors.transport.unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsCard
      id="hesap-turu"
      icon={<UserRound className="size-5" />}
      title={t("profile.title")}
      description={t("profile.description")}
      headerAside={
        isComplete ? (
          <Badge variant="success" size="default" dot>
            {t("profile.complete")}
          </Badge>
        ) : (
          <Badge variant="warning" size="default">
            {t("profile.incomplete")}
          </Badge>
        )
      }
    >
      <SettingsResult
        saved={saved}
        savedMessage={t("saved")}
        errorMessage={submitError ? tAuth(PROFILE_ERROR_MESSAGE_KEYS[submitError]) : null}
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AccountRolePicker
          locale={locale}
          idPrefix={`${ID_PREFIX}-role`}
          value={value.accountRole}
          onChange={(accountRole) => handleChange({ ...value, accountRole })}
          disabled={submitting}
        />

        {value.accountRole !== savedRole && (
          <p role="status" className="text-[11px] text-muted-foreground leading-relaxed">
            {t("profile.roleChangeNotice")}
          </p>
        )}

        <DeclaredProfileFields
          locale={locale}
          value={value}
          onChange={handleChange}
          errors={errors}
          idPrefix={ID_PREFIX}
          disabled={submitting}
        />

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={submitting}
            className="w-full sm:w-auto min-w-32 text-xs font-bold"
          >
            {t("save")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
```

`git rm components/v2/v2-settings-education-card.tsx`.

- [ ] **Step 4: Shell and account card**

`v2-account-settings.tsx`: import `V2SettingsProfileCard` instead of the education card; delete `showsEducation`; `sections` becomes

```tsx
const sections = [
  { id: "profil-bilgileri", label: t("personal.title") },
  { id: "hesap-turu", label: t("profile.title") },
  { id: "guvenlik", label: t("password.title") },
  { id: "hesap", label: t("account.title") },
  { id: "hesabi-sil", label: t("delete.title") },
];
```

render `<V2SettingsProfileCard locale={locale} profile={profile} />` unconditionally in the education card's position, and replace the docblock paragraph about teachers with "Every member gets the account-type section (T-103): it is where the role itself is changed."

`v2-settings-account-card.tsx`: delete `roleLabel` and the role `SettingsReadOnlyField`; the grid becomes `grid grid-cols-1 sm:grid-cols-2 gap-3`; docblock "the three facts" → "the two facts".

Run: `pnpm typecheck && pnpm vitest run components/v2/v2-account-settings.test.ts` — Expected: PASS.

### Task W7: Hub badge and completion prompt

**Files:**

- Modify: `components/v2/v2-member-hub.tsx`, `components/v2/v2-member-hub.test.ts`

- [ ] **Step 1: Test first**

Add to `v2-member-hub.test.ts` (inside the describe that reads the hub source):

```ts
it("labels every role and prompts any incomplete profile toward the account-type section (T-103)", () => {
  expect(source).toContain("ACCOUNT_ROLE_LABELS[session.accountRole]");
  expect(source).toContain("profile && !profile.isComplete");
  expect(source).toContain('hash: "hesap-turu"');
  expect(source).not.toContain('session.accountRole === "STUDENT" && !profile?.isComplete');
});
```

(Use the variable name the file already uses for the hub source.) Run it — Expected: FAIL.

- [ ] **Step 2: Implement**

In `v2-member-hub.tsx`: import `ACCOUNT_ROLE_LABELS` from `@/lib/auth/profile-labels`, `type AccountRole` from `@/lib/api/types`, and `Compass, Users` from `lucide-react` next to the existing icons. At module level:

```tsx
const ROLE_BADGE_ICONS: Record<AccountRole, React.ComponentType<{ className?: string }>> = {
  STUDENT: User,
  TEACHER: GraduationCap,
  PARENT: Users,
  ENTHUSIAST: Compass,
};

/** What an incomplete profile is missing, per role (T-103). An enthusiast is never incomplete. */
const INCOMPLETE_PROMPTS: Record<AccountRole, string> = {
  STUDENT: "Eğitim bilgilerini tamamla",
  PARENT: "Çocuğunun sınıfını ekle",
  TEACHER: "Branşını ekle",
  ENTHUSIAST: "Profilini tamamla",
};
```

Replace the badge's two-branch ternary body with

```tsx
{
  (() => {
    const RoleIcon = ROLE_BADGE_ICONS[session.accountRole];
    return (
      <>
        <RoleIcon className="size-3.5" />
        {ACCOUNT_ROLE_LABELS[session.accountRole].tr}
      </>
    );
  })();
}
```

(if the file already hoists small render helpers, hoist `RoleIcon` into a `const` above the JSX instead of the IIFE), and the prompt condition and link with

```tsx
                {profile && !profile.isComplete && (
                  <Link href={{ pathname: "/hesabim/ayarlar", hash: "hesap-turu" }}>
```

with `{INCOMPLETE_PROMPTS[session.accountRole]}` as the badge text. Update the comment above it: "Registration collects each role's details, so a new account arrives complete; this prompt is for older accounts and for a teacher registered before T-103."

Run: `pnpm vitest run components/v2/v2-member-hub.test.ts` — Expected: PASS.

### Task W8: Privacy notice

**Files:**

- Modify: `messages/tr.json`, `messages/en.json`

- [ ] **Step 1: TR copy**

In `Privacy`:

- `updated`: `"Son güncelleme: 26 Eylül 2026"`.
- `dataItems[3]` becomes: `"Profil bilgileri: hesap türü (öğrenci, öğretmen, veli ya da coğrafya meraklısı). Öğrenciler için eğitim düzeyi, sınıf, alan, okul, üniversite ve bölüm; veliler için çocuğunun sınıfı ve hazırlandığı alan (çocuğun adı, okulu ya da doğum tarihi sorulmaz); öğretmenler için branş ve çalışılan kurumun türü."`
- Insert after it: `"Bizi nereden duyduğun: kayıtta isteğe bağlı olarak seçtiğin kaynak (örneğin öğretmen, arkadaş, YouTube)."`
- Insert into `purposesItems` after the "Eğitim bilgilerine göre …" item: `"Sitenin kimlere ulaştığını ve nereden duyulduğunu anlamak için toplu kitle istatistikleri çıkarılması (hesap türü, sınıf, alan, branş, il ve kaynak dağılımı gibi). Bu istatistikler kişiyi tanımlamaz."`
- `legalItems[2]` becomes: `"KVKK md. 5/2-f, temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaati: güvenlik, kötüye kullanımın ve aşırı isteklerin önlenmesi ve sitenin kitlesinin toplu istatistiklerle anlaşılması."`

- [ ] **Step 2: EN copy (key parity)**

- `updated`: `"Last updated: 26 September 2026"` (match the existing EN date format).
- `dataItems[3]`: `"Profile: account type (student, teacher, parent or geography enthusiast). For students: education level, grade, track, school, university and department; for parents: their child's grade and track (the child's name, school or birth date are never asked); for teachers: subject and type of institution."`
- New item: `"How you heard of us: the source you optionally picked at sign-up (for example a teacher, a friend, YouTube)."`
- New purpose: `"Producing aggregate audience statistics to understand who the site reaches and how they found it (distribution of account type, grade, track, subject, province and source). These statistics do not identify anyone."`
- `legalItems[2]`: `"KVKK art. 5/2-f, the controller's legitimate interest, provided your fundamental rights and freedoms are not harmed: security, preventing abuse and excessive requests, and understanding the site's audience through aggregate statistics."` (keep the existing EN wording style for "KVKK art.").

- [ ] **Step 3: Gate and commit W1–W8**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm codegen:check`
Expected: all green; report the test file and test counts.

```bash
git add -A
git commit -m "feat(auth): four account types, per-type second step, referral source (T-103)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task W9: Visual and end-to-end verification, board, PR

- [ ] **Step 1: Run the stack against the API branch**

The API dev container must run `feature/t-103-account-types` with the new migration applied (`pnpm migration:run` per `cografya_api/CLAUDE.md`, with `DATABASE_URL` from the shell). `cografya-web-dev` serves `:3000` from this tree.

- [ ] **Step 2: Walk the four flows in Playwright**

On `/kayit`, register one account per role with a throwaway `@example.test` address (read the verification code from the API's dev mailer log). For each role check:

- Enthusiast: step 1 button reads "Ücretsiz Kayıt Ol" and goes straight to the code step.
- Student / Veli / Öğretmen: "Devam Et", step 2 shows the right fields; Veli shows no level select and no school input; submitting empty focuses the first missing field.
- Student → Veli → Student in step 1/2 keeps each role's answers separate.
- After verification `/hesabim` shows the right badge and no prompt.
- On `/hesabim/ayarlar`, switch the teacher to Veli: the notice appears, the child fields appear, save succeeds, the hub badge reads "Veli" after refresh.

Then `psql` the dev DB: `SELECT account_role, grade_level, study_stream, teacher_subject, institution_type, referral_source FROM users WHERE email LIKE '%@example.test' ORDER BY created_at DESC LIMIT 5;` and confirm the values match what was entered.

- [ ] **Step 3: Viewports and overflow**

`pnpm sweep:overflow -- --filter=/kayit` and `-- --filter=/hesabim/ayarlar`. Screenshots of `/kayit` step 1 and the settings card at 320, 360, 390 px and desktop, light and dark: the 2×2 picker must wrap "Coğrafya meraklısı" onto two lines, not truncate or overflow.

- [ ] **Step 4: Board**

In `/home/sertturk16/cografya_v4/TASKS.md`, move T-103 to DONE with PR numbers once both are open, and add under READY:

```markdown
### T-108 — Kitle Verisini Hocalara Göstermek

- **Owner:** TBD · **Surface:** `cografya_api` + `cografya_web` · **Doğdu:** 2026-09-26, T-103 kapsam dışı bırakıldı
- **Olgu:** T-103 hesap türünü, öğretmen branşı ve kurumunu, velinin çocuk sınıfını ve "nereden duydun" kaynağını topluyor; bunları gösteren bir yüzey yok. Şimdilik veritabanından okunuyor.
- **Karar bekleyen:** Yönetici sayfası mı, periyodik e-posta raporu mu. İkisi de yönetici kimliği/yetkisi ister.
```

- [ ] **Step 5: Push and open the web PR**

```bash
git push -u origin feature/t-103-account-types
gh pr create --base dev --title "feat(auth): four account types and per-type second step (T-103)" --body "$(cat <<'EOF'
Spec: docs/superpowers/specs/2026-09-26-t103-account-types-design.md · Plan: docs/superpowers/plans/2026-09-26-t103-account-types.md
Depends on cografya_api PR <link> (contract copied into openapi/openapi.json).

- Register: Öğrenci / Öğretmen / Veli / Coğrafya meraklısı. Required step 2 per role (child's grade + stream for Veli, branch + institution for Öğretmen, none for meraklı). Optional "Bizi nereden duydun?".
- Settings: new "Hesap Türü" card for every role; the role can be changed and saving clears the old role's fields.
- Hub: real role badge (Veli no longer shows as Öğrenci); completion prompt for any incomplete role.
- Privacy notice lists the new data and the audience-statistics purpose.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Report both PR links.
