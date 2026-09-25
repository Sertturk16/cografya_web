import type { Locale } from "@/i18n/routing";
import type {
  AccountRole,
  EducationLevel,
  GradeLevel,
  InstitutionType,
  ReferralSource,
  RegisterRequest,
  StudyStream,
  TeacherSubject,
  UpdateProfileRequest,
} from "@/lib/api/types";

/**
 * Client-side validation constants, the password-policy check, the profile matrix and
 * `buildRegisterPayload` (plan §4.3.2, all four parts —
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). Parts 1-2 shipped in
 * PR-1 with the constants only (unused there); parts 3-4 below land in PR-2 with the
 * register screen, which is the first consumer of most of this file's constants.
 *
 * Every value below either mirrors a bound the committed `openapi/openapi.json` publishes
 * (proven equal by `form-rules.contract.test.ts`, gate G2 — the "constants half"; the
 * "payload-shape half" joins in PR-2 once `buildRegisterPayload` exists) or mirrors an
 * api-side pattern the contract does NOT publish (phone / email-ASCII / password classes —
 * read from the api source, named below, and covered by NO gate). Which is which is marked
 * on each constant so a later reader never assumes G2 covers more than it does.
 *
 * The web has no second server validator (plan §4.3.2): the browser blocks a submission
 * until every rule below holds, and the api's own `ValidationPipe` + DB `CHECK` stay the
 * only server-side enforcement — the BFF (`transport.server.ts`) is a pass-through by
 * design.
 */

/** `RegisterRequestDto.firstName.maxLength` — contract-derived, gate G2. Unused by any
 *  PR-1 screen (`/giris`, `/sifre-sifirlama*` carry no name field); lands with the
 *  register form in PR-2. */
export const FIRST_NAME_MAX = 100;

/** `RegisterRequestDto.lastName.maxLength` — contract-derived, gate G2. Unused in PR-1,
 *  see above. */
export const LAST_NAME_MAX = 100;

/** `RegisterRequestDto.email.maxLength` — contract-derived, gate G2. Used by every PR-1
 *  screen that carries an e-mail field. */
export const EMAIL_MAX = 254;

/** A rough client-side shape check, deliberately NOT the api's ASCII/format rules
 *  ({@link EMAIL_ASCII_PATTERN} below) — this only catches an obviously malformed address
 *  before a submission reaches the api, which stays the real validator. No gate: it is a
 *  UX check, not a contract-derived bound. Moved here (review `CODE85-N1`) from two
 *  byte-identical copies in `login-form.tsx` and `password-reset-request-form.tsx`, the one
 *  module every screen carrying an e-mail field already imports from. */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `RegisterRequestDto.password.minLength` — contract-derived, gate G2. The reset-confirm
 *  screen's NEW password enforces this through {@link isPasswordPolicyCompliant} below;
 *  `/giris`'s password field does NOT — an existing account may predate this policy, and
 *  the web has no way to know, so login only checks non-empty (plan §4.3.2). */
export const PASSWORD_MIN = 6;

/** `RegisterRequestDto.password.maxLength` — contract-derived, gate G2. */
export const PASSWORD_MAX = 128;

/** `RegisterRequestDto.provincePlateCode.pattern` — contract-derived, gate G2. Unused in
 *  PR-1 (no province field yet); lands with the register form in PR-2. */
export const PLATE_CODE_PATTERN = /^[0-9]{2}$/;

/** Turkish mobile E.164, read from the api source (`registration.service.ts`'s phone
 *  canonicalisation, `cografya_api` `dev` @ `89fed7e`) — the CONTRACT does not publish
 *  this shape (plan §3.3), so NO gate binds it. Unused in PR-1; lands with the register
 *  form in PR-2. */
export const PHONE_E164_PATTERN = /^\+905[0-9]{9}$/;

/** ASCII-only e-mail charset, read from the api source — NOT contract-published, no gate
 *  (plan §3.3/§4.3.2). Unused in PR-1: the login and reset screens rely on the browser's
 *  own `type="email"` validity check for shape, and the api is the actual enforcer of this
 *  narrower charset; a false client-side accept here only means the api answers with a
 *  generic `errors.transport.invalidRequest`, never a security gap. */
export const EMAIL_ASCII_PATTERN = /^[\x21-\x7E]+$/;

/** The e-mail verification code's fixed length (`mintVerificationCode`,
 *  `cografya_api/src/auth/opaque-token.ts`, `89fed7e`) — NOT contract-published, no gate.
 *  Unused in PR-1; lands with `/e-posta-dogrulama` in PR-2. The PASSWORD-RESET code
 *  (`/sifre-sifirlama/yeni`) is a DIFFERENT shape — a base64url `mintOpaqueToken()` output,
 *  same file — and is not measured against this constant anywhere in this repo. */
export const VERIFICATION_CODE_LENGTH = 6;

/**
 * The three character classes the api's `IsPasswordPolicyCompliant` decorator enforces (one
 * lowercase, one uppercase, one digit) plus the length window above. The CLASS rules are NOT
 * contract-published (the contract only publishes the length bounds via `minLength`/
 * `maxLength`), so only the length half is covered by gate G2, transitively through
 * {@link PASSWORD_MIN}/{@link PASSWORD_MAX}; the class rules carry no gate.
 */
export function isPasswordPolicyCompliant(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN &&
    value.length <= PASSWORD_MAX &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

/**
 * TR mobile phone → the api's own canonical E.164 form ({@link PHONE_E164_PATTERN}). The
 * field itself never asks for a country code (`5XX XXX XX XX`, `DEC 2026-08-20g` md.1 #3) —
 * this folds the bare 10-digit form AND the two written forms the api's own canonicalisation
 * also accepts (`0532…`, `90532…`) into the SAME shape the api ultimately stores, so the
 * browser's own check exercises the real target shape rather than a looser proxy for it.
 * Returns `null` when nothing recognisable comes out; the caller renders that as a shape
 * error rather than guessing at a partial correction.
 */
export function canonicalizePhone(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  const bare =
    digits.startsWith("90") && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith("0") && digits.length === 11
        ? digits.slice(1)
        : digits;
  const candidate = `+90${bare}`;
  return PHONE_E164_PATTERN.test(candidate) ? candidate : null;
}

/**
 * THE LIVE MASK behind the two phone fields (T-072): what belongs in the box after this
 * keystroke. Its sibling {@link canonicalizePhone} answers a different question — "is this a
 * phone number, and what is its one storable form" — and runs once, on submit; this one runs
 * on every character, so anything it refuses is something the reader cannot type at all.
 *
 * Four rules, each of them a thing a reader did before the mask existed:
 *
 *  · NON-DIGITS ARE DROPPED. Letters, brackets and dashes, whatever gets pasted.
 *  · A LEADING `0`, `90` OR `+90` IS SWALLOWED. The field asks for `5XX XXX XX XX` and says
 *    so, but half of Türkiye writes the trunk `0` anyway — and the SETTINGS card is handed
 *    `profile.phone` from the api in its `+905XXXXXXXXX` form, which without this branch
 *    would read as a first digit of 9, be refused by the rule below, and blank a saved
 *    number on first paint.
 *  · THE FIRST DIGIT MUST BE 5, or nothing is accepted. Every Turkish mobile number begins
 *    with one; accepting `212…` would mean a field that takes a shape it refuses on submit.
 *    Ruled this way (T-072, owner answer) over the alternative of typing it and complaining.
 *  · TEN DIGITS, AND THE GROUPS ARE 3-3-2-2. A separator is only ever emitted BEFORE a digit
 *    that exists, so the box never ends in a space the reader did not type and backspace
 *    never has to be pressed twice.
 *
 * Returns the display string; `maxLength={13}` on the input is that string at full length.
 * The submit path is unchanged — {@link canonicalizePhone} reads the spaces out again.
 */
export function formatTurkishMobileInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  const national = digits.startsWith("90")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  if (!national.startsWith("5")) return "";

  const capped = national.slice(0, 10);
  const groups = [capped.slice(0, 3), capped.slice(3, 6), capped.slice(6, 8), capped.slice(8, 10)];
  return groups.filter((group) => group !== "").join(" ");
}

/** The full mask's length — `5XX XXX XX XX`, ten digits and three separators. The `maxLength`
 *  both phone inputs carry, so the number is written once rather than in two components. */
export const PHONE_INPUT_MAX_LENGTH = 13;

/**
 * The register screens' one internal user-type identifier, spelled as a single union rather
 * than the contract's two axes (`accountRole` + `educationLevel`) because the CONTROL is one
 * field — see `buildRegisterPayload` below for the split. `lib/auth/profile-labels.ts` holds
 * the reader label for each.
 *
 * `secondary` / `undergraduate` / `graduate` / `teacher` remain V1's four education-level
 * options for the full-profile "Kullanıcı tipi" control `DEC 2026-08-20g` md.1 #7 names
 * (`components/auth/register-form.tsx`, plan §4.3.3's copy deviation: the ruling's four
 * values, disambiguated with `GLOSSARY.md` §7.1's terms).
 *
 * `student` is V2's minimal-registration value (`DEC 2026-09-03a` md.1, `VAL126R2SEC-I3`). It
 * lives on the `accountRole` axis ALONE — `GLOSSARY.md` §7.1's two-row `accountRole` table
 * (Öğrenci → `STUDENT`) — and carries NO education level at all: no `educationLevel`,
 * `gradeLevel`, `studyStream`, `universityName` or `departmentName` key reaches the payload.
 * It is deliberately NOT a reuse of `secondary`: that branch stamps
 * `educationLevel: "SECONDARY"` the moment a `gradeLevel` appears, so reusing it would make a
 * V2 student's stored intent a lie the first time education collection is added.
 *
 * `parent` and `enthusiast` are T-103's; `parent` carries the child's secondary grade and stream.
 */
export type UserType =
  | "student"
  | "secondary"
  | "undergraduate"
  | "graduate"
  | "teacher"
  | "parent"
  | "enthusiast";

/**
 * The whole register-screen state `buildRegisterPayload` reads (plan §4.3.2 part 3, the
 * profile matrix). `passwordConfirm` is UI-only — `DEC 2026-08-20g` md.1 #6 ("owner: olsun"),
 * and `errors.register.passwordMismatch` was dropped at S6 precisely because there is no api
 * field for it — and `buildRegisterPayload` never reads it below; it is part of this type
 * only because the caller's whole form state naturally carries it, and gate G2's own
 * revert-to-red mutation (plan §9) is "add `passwordConfirm` to the payload", which has to
 * compile against a real property to be a meaningful mutation. `phone` is already
 * canonicalised (see {@link canonicalizePhone}) by the time it reaches here; this function
 * does not re-derive it. `gradeLevel`, `studyStream`, `universityName` and `departmentName`
 * are optional on the form state: minimal V2 registration (Decision 2-B, `DEC 2026-09-03a` md.1)
 * omits them at initial registration and defers education details to a post-registration profile
 * onboarding step; callers providing them (e.g. V1 registration) continue to emit full-profile payloads.
 */
export interface RegisterFormState {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
  readonly password: string;
  readonly passwordConfirm: string;
  readonly userType: UserType;
  readonly provincePlateCode: string;
  readonly districtId: string;
  readonly gradeLevel?: GradeLevel | "";
  readonly studyStream?: StudyStream | "";
  /**
   * T-061. Optional even inside the SECONDARY branch — the API's matrix accepts it present
   * or absent there and forbids it everywhere else, so an empty string must not become a key.
   */
  readonly schoolName?: string;
  readonly universityName?: string;
  readonly departmentName?: string;
  /** T-103. The `teacher` branch's subject; absent for every other `userType`. */
  readonly teacherSubject?: TeacherSubject | "";
  /** T-103. The `teacher` branch's workplace; absent for every other `userType`. */
  readonly institutionType?: InstitutionType | "";
  /** T-103. "Bizi nereden duydun?" — optional on every branch, register-only. */
  readonly referralSource?: ReferralSource | "";
  /**
   * T-101. Two separate decisions, never bundled: accepting the terms is REQUIRED to register;
   * commercial electronic messages are an OPTIONAL, unticked-by-default consent (KVKK md. 5/1,
   * 6563 sayılı Kanun) that must never be a condition of the service.
   */
  readonly termsAccepted: boolean;
  readonly marketingConsent: boolean;
}

/** The consent fields the register form refuses to submit without (T-101). */
export type RequiredRegisterConsent = "termsAccepted";

/**
 * Which REQUIRED consents are missing. Only the terms are required; `marketingConsent` is
 * deliberately absent from this check, so leaving it unticked can never block registration.
 */
export function missingRegisterConsents(
  state: Pick<RegisterFormState, "termsAccepted" | "marketingConsent">,
): RequiredRegisterConsent[] {
  return state.termsAccepted ? [] : ["termsAccepted"];
}

/**
 * The profile matrix (plan §3.3/§4.3.3, table verbatim in BEHAVIOUR from
 * `src/auth/dto/profile-shape.rule.ts`, which the api enforces a SECOND time as a DB
 * `CHECK` — updated by `cografya_api` PR #155 `AllowStudentMinimalRegistrationProfileShape1788100000000`)
 * — which extra fields each user type requires, forbids, or leaves optional:
 *
 * The left column is the {@link UserType} union and nothing else — every member has exactly
 * one row, and every row is a member:
 *
 * | user type      | `accountRole` | `educationLevel` | required                        | forbidden                   |
 * |----------------|----------------|-------------------|----------------------------------|------------------------------|
 * | student        | `STUDENT`      | *absent*          | —                                | every education field       |
 * | secondary      | `STUDENT`      | `SECONDARY`       | `gradeLevel` + `studyStream`     | university, department      |
 * | undergraduate  | `STUDENT`      | `UNDERGRADUATE`   | `universityName` + `departmentName` | grade, stream            |
 * | graduate       | `STUDENT`      | `GRADUATE`        | `universityName`; department optional | grade, stream          |
 * | parent         | `PARENT`       | `SECONDARY` or absent | `gradeLevel` + `studyStream` | school, university, department, teacher fields |
 * | teacher        | `TEACHER`      | *absent*          | `teacherSubject` + `institutionType` (or neither) | every education field |
 * | enthusiast     | `ENTHUSIAST`   | *absent*          | —                                | everything                   |
 *
 * `student` is minimal V2 registration (Decision 2-B, `DEC 2026-09-03a` md.1): it omits the
 * education fields entirely, so `buildRegisterPayload` returns
 * `{ ...common, accountRole: "STUDENT" }` without `educationLevel` or any education key,
 * matching `cografya_api`'s minimal student contract. The three education-level branches keep
 * their own defensive collapse to the same shape when their education field is empty — a
 * still-live path for a V1 caller that has not filled the profile in yet.
 * `buildRegisterPayload` is the ONLY function in this repo that constructs the `register`
 * request body, and it emits exactly the keys the matrix's branch above allows and nothing
 * else — the global pipe's `whitelist`+`forbidNonWhitelisted`
 * (`cografya_api` `src/main.ts:43-47`) rejects an undeclared field BY NAME, so an extra key
 * here is not a warning, it is a 400 (gate G2's payload-shape half pins this). `locale` is
 * NOT a form field (the DTO's own description: "Form alanı değil — doğrulama e-postasının
 * dili") — the caller supplies it from the page's own locale, never from `formState`. The
 * `TEACHER` branch and minimal `STUDENT` branch carry no `educationLevel` key AT ALL, not even
 * `undefined` (`GLOSSARY.md` §7.1) — `common` below never declares that property, so the object
 * literal genuinely has no such key, which is what a JS `in`/`Object.keys` check (and gate G2's
 * own subset assertion) actually observes.
 */
export function buildRegisterPayload(
  formState: RegisterFormState,
  locale: Locale,
): RegisterRequest {
  const common = {
    firstName: formState.firstName,
    lastName: formState.lastName,
    phone: formState.phone,
    email: formState.email,
    password: formState.password,
    districtId: formState.districtId,
    provincePlateCode: formState.provincePlateCode,
    locale,
    // Sent on every branch, `false` included: the API stores a consent instant only for `true`.
    marketingConsent: formState.marketingConsent,
    ...(formState.referralSource ? { referralSource: formState.referralSource } : {}),
  };

  switch (formState.userType) {
    case "secondary": {
      const base: RegisterRequest = {
        ...common,
        accountRole: "STUDENT",
        ...(formState.gradeLevel
          ? {
              educationLevel: "SECONDARY",
              gradeLevel: formState.gradeLevel as GradeLevel,
              studyStream: formState.studyStream as StudyStream,
            }
          : {}),
      };
      // `schoolName` is the one optional field INSIDE an otherwise-required branch, and it is
      // spread the same way `graduate`'s `departmentName` is: an empty string would be a key
      // the matrix accepts here but rejects on every other branch, so it must not become one.
      const school = formState.schoolName?.trim();
      return school ? { ...base, schoolName: school } : base;
    }
    case "undergraduate":
      return {
        ...common,
        accountRole: "STUDENT",
        ...(formState.universityName
          ? {
              educationLevel: "UNDERGRADUATE",
              universityName: formState.universityName,
              departmentName: formState.departmentName,
            }
          : {}),
      };
    case "graduate": {
      const base: RegisterRequest = {
        ...common,
        accountRole: "STUDENT",
        ...(formState.universityName
          ? {
              educationLevel: "GRADUATE",
              universityName: formState.universityName,
            }
          : {}),
      };
      return formState.departmentName && formState.departmentName.trim().length > 0
        ? { ...base, departmentName: formState.departmentName }
        : base;
    }
    case "student":
      return { ...common, accountRole: "STUDENT" };
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
    default: {
      const exhaustive: never = formState.userType;
      throw new Error(`buildRegisterPayload: unreachable user type ${String(exhaustive)}`);
    }
  }
}

/**
 * The education axis as a form holds it.
 */
export interface ProfileAxisFormState {
  readonly educationLevel: EducationLevel | "";
  readonly gradeLevel: GradeLevel | "";
  readonly studyStream: StudyStream | "";
  readonly schoolName: string;
  readonly universityName: string;
  readonly departmentName: string;
}

/**
 * Builds the COMPLETE five-field axis for a REPLACE. Always returns all five properties;
 * a field the selected branch does not use is an explicit `null`, never an omission.
 */
function educationAxisPayload(
  formState: ProfileAxisFormState,
): Omit<UpdateProfileRequest, "accountRole" | "teacherSubject" | "institutionType"> {
  if (!formState.educationLevel) {
    return {
      educationLevel: null,
      gradeLevel: null,
      studyStream: null,
      schoolName: null,
      universityName: null,
      departmentName: null,
    };
  }

  switch (formState.educationLevel) {
    case "SECONDARY":
      return {
        educationLevel: "SECONDARY",
        gradeLevel: formState.gradeLevel ? (formState.gradeLevel as GradeLevel) : null,
        studyStream: formState.studyStream ? (formState.studyStream as StudyStream) : null,
        schoolName: formState.schoolName.trim().length > 0 ? formState.schoolName.trim() : null,
        universityName: null,
        departmentName: null,
      };
    case "UNDERGRADUATE":
      return {
        educationLevel: "UNDERGRADUATE",
        gradeLevel: null,
        studyStream: null,
        schoolName: null,
        universityName: formState.universityName ? formState.universityName : null,
        departmentName: formState.departmentName ? formState.departmentName : null,
      };
    case "GRADUATE":
      return {
        educationLevel: "GRADUATE",
        gradeLevel: null,
        studyStream: null,
        schoolName: null,
        universityName: formState.universityName ? formState.universityName : null,
        departmentName:
          formState.departmentName && formState.departmentName.trim().length > 0
            ? formState.departmentName
            : null,
      };
    default: {
      const exhaustive: never = formState.educationLevel;
      throw new Error(
        `buildProfileReplacementPayload: unreachable education level ${String(exhaustive)}`,
      );
    }
  }
}

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
