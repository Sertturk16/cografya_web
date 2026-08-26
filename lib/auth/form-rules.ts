/**
 * Client-side validation constants and the password-policy check (plan §4.3.2, parts 1 and
 * 2 of four — `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). The
 * profile matrix and `buildRegisterPayload` (parts 3-4) land in PR-2 with the register
 * screen; this file's shape is fixed here so PR-2 only ADDS to it, never restructures it.
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
