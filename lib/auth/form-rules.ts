import type { Locale } from "@/i18n/routing";
import type { GradeLevel, RegisterRequest, StudyStream } from "@/lib/api/types";

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
 * The four values `DEC 2026-08-20g` md.1 #7 names for the "Kullanıcı tipi" control, spelled
 * as an internal identifier rather than the contract's two axes (`accountRole` +
 * `educationLevel`) because the CONTROL is one field with four options, not two — see
 * `buildRegisterPayload` below for the split. `lib/auth/profile-labels.ts` holds the reader
 * label for each (plan §4.3.3's copy deviation: the ruling's four values, disambiguated with
 * `GLOSSARY.md` §7.1's terms).
 */
export type UserType = "secondary" | "undergraduate" | "graduate" | "teacher";

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
  readonly universityName?: string;
  readonly departmentName?: string;
}

/**
 * The profile matrix (plan §3.3/§4.3.3, table verbatim in BEHAVIOUR from
 * `src/auth/dto/profile-shape.rule.ts`, which the api enforces a SECOND time as a DB
 * `CHECK` — updated by `cografya_api` PR #155 `AllowStudentMinimalRegistrationProfileShape1788100000000`)
 * — which extra fields each user type requires, forbids, or leaves optional:
 *
 * | user type      | `accountRole` | `educationLevel` | required                        | forbidden                   |
 * |----------------|----------------|-------------------|----------------------------------|------------------------------|
 * | student (min)  | `STUDENT`      | *absent*          | —                                | every education field       |
 * | secondary      | `STUDENT`      | `SECONDARY`       | `gradeLevel` + `studyStream`     | university, department      |
 * | undergraduate  | `STUDENT`      | `UNDERGRADUATE`   | `universityName` + `departmentName` | grade, stream            |
 * | graduate       | `STUDENT`      | `GRADUATE`        | `universityName`; department optional | grade, stream          |
 * | teacher        | `TEACHER`      | *absent*          | —                                | every education field       |
 *
 * Minimal V2 student registration omits education fields entirely (Decision 2-B, `DEC 2026-09-03a` md.1).
 * In that case, `buildRegisterPayload` returns `{ ...common, accountRole: "STUDENT" }` without
 * `educationLevel` or any education key, matching `cografya_api`'s minimal student contract.
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
  };

  switch (formState.userType) {
    case "secondary":
      return {
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
    case "teacher":
      return { ...common, accountRole: "TEACHER" };
    default: {
      const exhaustive: never = formState.userType;
      throw new Error(`buildRegisterPayload: unreachable user type ${String(exhaustive)}`);
    }
  }
}
