"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
// Deliberately NOT `@/i18n/navigation`'s `useRouter` — the same `login-form.tsx` reasoning
// (review `CODE85-M5`): `router.replace()` below receives the BFF's own `safeReturnPath()`
// output, a final path with its locale prefix already resolved.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Department, District, ProvinceListItem, University } from "@/lib/api/types";
import { AUTH_ERROR_MESSAGE_KEYS } from "@/lib/auth/error-messages";
import {
  buildRegisterPayload,
  canonicalizePhone,
  EMAIL_ASCII_PATTERN,
  EMAIL_MAX,
  EMAIL_SHAPE,
  FIRST_NAME_MAX,
  isPasswordPolicyCompliant,
  LAST_NAME_MAX,
  PASSWORD_MAX,
  VERIFICATION_CODE_LENGTH,
  type RegisterFormState,
  type UserType,
} from "@/lib/auth/form-rules";
import {
  GRADE_LEVEL_LABELS,
  renderLabel,
  STUDY_STREAM_LABELS,
  UNIVERSITY_GROUP_LABELS,
  USER_TYPE_LABELS,
} from "@/lib/auth/profile-labels";
import { AUTH_FETCH_TIMEOUT_MS, submitAuth } from "@/lib/auth/submit.client";
import type { AuthBffCode } from "@/lib/auth/transport.server";
import { FormErrorRegion, SelectField, TextField } from "./field";
import styles from "./auth-form.module.css";

/** `?returnTo=` off the CURRENT url — the identical `useSyncExternalStore` idiom
 *  `login-form.tsx` uses (plan §4.1,
 *  `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`); the step-2 code
 *  submission is a token-issuing action (`verify-email`, plan §3.1), so this screen needs
 *  the same mechanism `login-form.tsx`/`verify-email-form.tsx` already use. */
const NEVER_CHANGES = () => () => {};
function readReturnToParam(): string | null {
  return new URLSearchParams(window.location.search).get("returnTo");
}
function serverReturnToSnapshot(): string | null {
  return null;
}
function useReturnToParam(): string | null {
  return useSyncExternalStore(NEVER_CHANGES, readReturnToParam, serverReturnToSnapshot);
}

const RESEND_COOLDOWN_SECONDS = 60;

/** `undergraduate` and `graduate` are the two user types whose profile needs the
 *  university/department reference lists (plan §4.3.1's matrix) — `graduate`'s department
 *  is optional but the LIST is still offered, only the FIELD's `required`-ness differs. */
const NEEDS_UNIVERSITY_PROFILE: ReadonlySet<UserType> = new Set(["undergraduate", "graduate"]);

type ListState = "idle" | "loading" | "loaded" | "error";

/** Bounded `fetch` for the three same-origin reference-data reads (plan §4.4) — the SAME
 *  `AUTH_FETCH_TIMEOUT_MS` budget `submit.client.ts` already uses, so this stays the
 *  repo's third, not a THIRD unbounded client-side `fetch` (review `SEC61-M6`/`SEC85-M3`). */
async function fetchReferenceList<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`fetchReferenceList: ${url} answered ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
  userType?: string;
  provincePlateCode?: string;
  districtId?: string;
  gradeLevel?: string;
  studyStream?: string;
  universityName?: string;
  departmentName?: string;
}

const USER_TYPE_OPTIONS: readonly UserType[] = [
  "secondary",
  "undergraduate",
  "graduate",
  "teacher",
];
const GRADE_LEVEL_KEYS = Object.keys(GRADE_LEVEL_LABELS) as (keyof typeof GRADE_LEVEL_LABELS)[];
const STUDY_STREAM_KEYS = Object.keys(STUDY_STREAM_LABELS) as (keyof typeof STUDY_STREAM_LABELS)[];

const FIELD_LABEL_KEYS: Record<keyof FieldErrors, string> = {
  firstName: "fields.firstName",
  lastName: "fields.lastName",
  phone: "fields.phone",
  email: "fields.email",
  password: "fields.password",
  passwordConfirm: "fields.passwordConfirm",
  userType: "fields.userType",
  provincePlateCode: "fields.province",
  districtId: "fields.district",
  gradeLevel: "fields.grade",
  studyStream: "fields.stream",
  universityName: "fields.university",
  departmentName: "fields.department",
};

/**
 * `/kayit` · `/en/register` (plan §6.2). Step 1 is the Turgay field set (§4.3.1); step 2 is
 * the e-mail-verification code, rendered IN PLACE at the same URL (§6.2) — the address lives
 * only in React state, never in browser storage (§6.3), so a reload during step 2 returns to
 * the empty form and the visitor finishes at `/e-posta-dogrulama` instead.
 */
export function RegisterForm({
  locale,
  provinces,
}: {
  readonly locale: Locale;
  readonly provinces: readonly ProvinceListItem[];
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const rawReturnTo = useReturnToParam();
  const fallbackHome = getPathname({ locale, href: "/" });

  const [step, setStep] = useState<"form" | "code">("form");
  const [registeredEmail, setRegisteredEmail] = useState("");

  // Step 1 fields.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [userType, setUserType] = useState<UserType | "">("");
  const [provincePlateCode, setProvincePlateCode] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [gradeLevel, setGradeLevel] = useState<RegisterFormState["gradeLevel"]>("");
  const [studyStream, setStudyStream] = useState<RegisterFormState["studyStream"]>("");
  const [universityName, setUniversityName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Dependent reference lists.
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtState, setDistrictState] = useState<ListState>("idle");
  const [lastFetchedProvince, setLastFetchedProvince] = useState(provincePlateCode);
  // A11Y88-I1: the retry button below only renders while `districtState === "error"`, so
  // clicking it (`setDistrictState("loading")`) unmounts the very button the click came
  // from, dropping focus to `document.body` with no re-focus step — unlike every OTHER
  // programmatic transition in this file, which moves focus somewhere sensible
  // (`errorHeadingRef`/`codeHeadingRef` below). This ref lets the retry click itself be
  // re-focused once its own fetch settles; `districtRetryPendingRef` marks that the CURRENT
  // "loading" pass was retry-triggered, so the settle effect below only steals focus after an
  // explicit retry click, never after the ordinary province-change fetch.
  const districtRetryRef = useRef<HTMLButtonElement>(null);
  const districtRetryPendingRef = useRef(false);
  // Kept in step with `provincePlateCode` through its OWN effect (never mutated during
  // render — `react-hooks/refs` forbids that) so an async `.then()` below can read the
  // CURRENT selection at the moment it resolves, not the one captured when it started.
  const provincePlateCodeRef = useRef(provincePlateCode);
  useEffect(() => {
    provincePlateCodeRef.current = provincePlateCode;
    // A province change supersedes any retry that was still in flight for the PRIOR
    // province — the settle effect below (keyed on `districtRetryPendingRef`) must react to
    // what this NEW fetch does, not steal focus on behalf of a click the user has already
    // moved on from. This runs in an effect, not the render-time block below, because a ref
    // write during render is disallowed (`react-hooks/refs`).
    districtRetryPendingRef.current = false;
  }, [provincePlateCode]);

  const [universities, setUniversities] = useState<University[]>([]);
  const [universityState, setUniversityState] = useState<ListState>("idle");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentState, setDepartmentState] = useState<ListState>("idle");

  // Step 2 fields.
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [cooldown, setCooldown] = useState(0);

  const [serverErrorCode, setServerErrorCode] = useState<AuthBffCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const codeHeadingRef = useRef<HTMLHeadingElement>(null);

  const hasFieldErrors = Object.values(fieldErrors).some((value) => value !== undefined);
  const hasErrors =
    step === "form"
      ? hasFieldErrors || serverErrorCode !== null
      : codeError !== undefined || serverErrorCode !== null;

  useEffect(() => {
    if (hasErrors) errorHeadingRef.current?.focus();
  }, [hasErrors]);

  useEffect(() => {
    if (step === "code") codeHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // The district list follows the chosen province (plan §4.4). The SYNCHRONOUS reset —
  // clearing any chosen district and dropping to "loading" — happens HERE, during render,
  // guarded by comparing against the last province this ran for (React's own "adjusting
  // state during render" idiom, the same one `password-reset-confirm-form.tsx` already uses
  // for its token field — never a bare `setState` at the top of an effect body). The effect
  // below owns ONLY the actual fetch.
  if (provincePlateCode !== lastFetchedProvince) {
    setLastFetchedProvince(provincePlateCode);
    setDistricts([]);
    setDistrictId("");
    setDistrictState(provincePlateCode === "" ? "idle" : "loading");
    // `districtRetryPendingRef` is cleared for a province change in the `provincePlateCode`
    // effect above, not here — a ref write during render is disallowed (`react-hooks/refs`).
  }

  useEffect(() => {
    if (districtState !== "loading") return;
    const requestedPlateCode = provincePlateCode;
    // A resolved-but-late response for a SUPERSEDED province is discarded by comparing
    // against the CURRENT selection at the moment it resolves (plan §4.4) — not by an
    // `AbortController` alone, because a resolved-but-late response is the failure mode,
    // not a live request.
    fetchReferenceList<District[]>(
      `/api/reference/districts/${encodeURIComponent(requestedPlateCode)}`,
    )
      .then((data) => {
        if (provincePlateCodeRef.current !== requestedPlateCode) return;
        setDistricts(data);
        setDistrictState("loaded");
      })
      .catch(() => {
        if (provincePlateCodeRef.current !== requestedPlateCode) return;
        setDistrictState("error");
      });
  }, [districtState, provincePlateCode]);

  // A11Y88-I1: once a retry-triggered fetch settles, move focus somewhere useful instead of
  // leaving it on `document.body` (the retry button that had focus just unmounted). Success →
  // the district `<select>` itself, so the user can immediately choose a value; a repeat
  // failure → the retry button, which remounts in the same spot. Gated on
  // `districtRetryPendingRef` so the ORDINARY province-change fetch (never retry-triggered)
  // never has its focus stolen — this settle effect only ever fires after an explicit retry
  // click. `document.getElementById` rather than a `field.tsx` ref (review's own "smallest
  // remedy" framing): `SelectField` does not forward a ref to its underlying `<select>`, and
  // widening that shared, heavily-tested a11y component's contract is a bigger change than
  // this fix calls for — the district `<select>`'s `id` is already static and unique.
  useEffect(() => {
    if (!districtRetryPendingRef.current) return;
    if (districtState === "loading") return;
    districtRetryPendingRef.current = false;
    if (districtState === "loaded") {
      document.getElementById("register-districtId")?.focus();
    } else if (districtState === "error") {
      districtRetryRef.current?.focus();
    }
  }, [districtState]);

  // University/department are fetched LAZILY, the first time a user type that needs them is
  // chosen, then kept for the life of the page (plan §4.4) — the SAME render-time transition
  // plus fetch-only-effect split as the district list above.
  if (userType !== "" && NEEDS_UNIVERSITY_PROFILE.has(userType) && universityState === "idle") {
    setUniversityState("loading");
  }
  if (userType !== "" && NEEDS_UNIVERSITY_PROFILE.has(userType) && departmentState === "idle") {
    setDepartmentState("loading");
  }

  useEffect(() => {
    if (universityState !== "loading") return;
    fetchReferenceList<University[]>("/api/reference/universities")
      .then((data) => {
        setUniversities(data);
        setUniversityState("loaded");
      })
      .catch(() => {
        setUniversityState("error");
      });
  }, [universityState]);

  useEffect(() => {
    if (departmentState !== "loading") return;
    fetchReferenceList<Department[]>("/api/reference/departments")
      .then((data) => {
        setDepartments(data);
        setDepartmentState("loaded");
      })
      .catch(() => {
        setDepartmentState("error");
      });
  }, [departmentState]);

  function validateStep1(): FieldErrors {
    const next: FieldErrors = {};
    if (firstName.trim().length === 0) next.firstName = t("fieldErrors.required");
    if (lastName.trim().length === 0) next.lastName = t("fieldErrors.required");

    if (phone.trim().length === 0) next.phone = t("fieldErrors.required");
    else if (canonicalizePhone(phone) === null) next.phone = t("fieldErrors.phoneInvalid");

    if (email.trim().length === 0) next.email = t("fieldErrors.required");
    else if (!EMAIL_SHAPE.test(email) || !EMAIL_ASCII_PATTERN.test(email))
      next.email = t("fieldErrors.emailInvalid");

    if (password.length === 0) next.password = t("fieldErrors.required");
    else if (!isPasswordPolicyCompliant(password)) next.password = t("fieldErrors.passwordPolicy");

    if (passwordConfirm.length === 0) next.passwordConfirm = t("fieldErrors.required");
    else if (passwordConfirm !== password) next.passwordConfirm = t("fieldErrors.passwordMismatch");

    if (userType === "") next.userType = t("fieldErrors.required");
    if (provincePlateCode === "") next.provincePlateCode = t("fieldErrors.required");
    if (districtId === "") next.districtId = t("fieldErrors.required");

    if (userType === "secondary") {
      if (gradeLevel === "") next.gradeLevel = t("fieldErrors.required");
      if (studyStream === "") next.studyStream = t("fieldErrors.required");
    }
    if (userType === "undergraduate" || userType === "graduate") {
      if (universityName === "") next.universityName = t("fieldErrors.required");
    }
    if (userType === "undergraduate" && departmentName === "") {
      next.departmentName = t("fieldErrors.required");
    }
    return next;
  }

  async function handleSubmitStep1(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    const errors = validateStep1();
    setFieldErrors(errors);
    if (Object.values(errors).some((value) => value !== undefined)) return;

    const canonicalPhone = canonicalizePhone(phone);
    if (canonicalPhone === null || userType === "") return; // unreachable given validateStep1 above

    setSubmitting(true);
    const formState: RegisterFormState = {
      firstName,
      lastName,
      phone: canonicalPhone,
      email,
      password,
      passwordConfirm,
      userType,
      provincePlateCode,
      districtId,
      gradeLevel,
      studyStream,
      universityName,
      departmentName,
    };
    const result = await submitAuth("register", buildRegisterPayload(formState, locale));
    setSubmitting(false);

    if (result.ok) {
      setRegisteredEmail(email);
      setStep("code");
      return;
    }
    setServerErrorCode(result.code);
  }

  async function handleSubmitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerErrorCode(null);
    if (code.length === 0) {
      setCodeError(t("fieldErrors.required"));
      return;
    }
    if (code.length !== VERIFICATION_CODE_LENGTH) {
      setCodeError(t("fieldErrors.codeShape"));
      return;
    }
    setCodeError(undefined);

    setSubmitting(true);
    const result = await submitAuth(
      "verify-email",
      { email: registeredEmail, code },
      { returnTo: rawReturnTo || fallbackHome },
    );
    setSubmitting(false);

    if (result.ok) {
      router.replace(result.redirectTo ?? fallbackHome);
      return;
    }
    setServerErrorCode(result.code);
  }

  async function handleResend() {
    setResendState("sending");
    const result = await submitAuth("verify-email/resend", { email: registeredEmail });
    setResendState(result.ok ? "sent" : "idle");
    if (!result.ok) {
      setServerErrorCode(result.code);
      return;
    }
    setServerErrorCode(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  const errorSummary =
    serverErrorCode !== null
      ? t(AUTH_ERROR_MESSAGE_KEYS[serverErrorCode])
      : t("formErrors.summary");

  if (step === "code") {
    return (
      <div className={styles.card}>
        <form className={styles.form} onSubmit={(event) => void handleSubmitCode(event)} noValidate>
          {hasErrors ? (
            <FormErrorRegion
              headingRef={errorHeadingRef}
              summary={
                serverErrorCode !== null
                  ? t(AUTH_ERROR_MESSAGE_KEYS[serverErrorCode])
                  : (codeError ?? errorSummary)
              }
              fieldErrors={
                codeError !== undefined
                  ? [{ id: "register-code", label: t("fields.verificationCode") }]
                  : undefined
              }
            />
          ) : null}
          <h2 ref={codeHeadingRef} tabIndex={-1} className={styles.successHeading}>
            {t("verify.heading")}
          </h2>
          <TextField
            id="register-code"
            label={t("fields.verificationCode")}
            // Never `type="number"` (gate G4's revert-to-red control): the api mints the
            // code with `padStart(6,'0')`, so `'000000'` is a valid code and a leading zero
            // must never be silently stripped by a numeric input.
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={VERIFICATION_CODE_LENGTH}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
            error={codeError}
          />
          <div className={styles.codeActions}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {t("verify.submit")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleResend()}
              disabled={resendState === "sending" || cooldown > 0}
            >
              {t("verify.resend")}
            </button>
          </div>
          {resendState === "sent" ? (
            <p role="status" className={styles.resendNote}>
              {t("verify.resendAccepted")}
            </p>
          ) : null}
        </form>
      </div>
    );
  }

  const fieldErrorLinks = hasFieldErrors
    ? (Object.entries(fieldErrors) as [keyof FieldErrors, string | undefined][])
        .filter((entry): entry is [keyof FieldErrors, string] => entry[1] !== undefined)
        .map(([field]) => ({ id: `register-${field}`, label: t(FIELD_LABEL_KEYS[field]) }))
    : undefined;

  const districtAnnouncement =
    districtState === "loaded"
      ? t("district.announceCount", { count: districts.length })
      : districtState === "error"
        ? t("district.loadError")
        : "";
  // UYELIK-04 ui-fixes plan Finding 2: the load-error message wins over the generic
  // "required" one when both are true at once (a failed submit with a still-broken list) —
  // it is the more specific, more actionable of the two.
  const districtError =
    districtState === "error" ? t("district.loadError") : fieldErrors.districtId;
  // A11Y87-M1: the university/department lists follow the SAME side-effect-of-a-still-
  // standing-control pattern as the district list above, but had no live region at all —
  // only the <option> text, which is unread unless the user has already tabbed to that
  // exact <select>. Error-only (not a "loaded" announcement): unlike the district list, the
  // count here does not depend on anything the user just chose, so there is no
  // `announceCount`-equivalent copy to reuse — reusing the already-shipped `loadError`
  // strings keeps this fix free of new copy / CONTENT-STYLE surface.
  const universityAnnouncement = universityState === "error" ? t("university.loadError") : "";
  const departmentAnnouncement = departmentState === "error" ? t("department.loadError") : "";

  const nonKktcUniversities = universities.filter((university) => university.type !== "KKTC");
  const kktcUniversities = universities.filter((university) => university.type === "KKTC");
  const turkeyGroupLabel = renderLabel(locale, UNIVERSITY_GROUP_LABELS.DEVLET);
  const kktcGroupLabel = renderLabel(locale, UNIVERSITY_GROUP_LABELS.KKTC);

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={(event) => void handleSubmitStep1(event)} noValidate>
        {hasErrors ? (
          <FormErrorRegion
            headingRef={errorHeadingRef}
            summary={errorSummary}
            fieldErrors={fieldErrorLinks}
          />
        ) : null}

        <TextField
          id="register-firstName"
          label={t("fields.firstName")}
          type="text"
          autoComplete="given-name"
          required
          maxLength={FIRST_NAME_MAX}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={fieldErrors.firstName}
        />
        <TextField
          id="register-lastName"
          label={t("fields.lastName")}
          type="text"
          autoComplete="family-name"
          required
          maxLength={LAST_NAME_MAX}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={fieldErrors.lastName}
        />
        <TextField
          id="register-phone"
          label={t("fields.phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder={t("fields.phonePlaceholder")}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldErrors.phone}
        />
        <TextField
          id="register-email"
          label={t("fields.email")}
          type="email"
          autoComplete="email"
          required
          maxLength={EMAIL_MAX}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          id="register-password"
          label={t("fields.password")}
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          hint={t("hints.newPassword")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        <TextField
          id="register-passwordConfirm"
          label={t("fields.passwordConfirm")}
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX}
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          error={fieldErrors.passwordConfirm}
        />

        <SelectField
          id="register-userType"
          label={t("fields.userType")}
          required
          value={userType}
          onChange={(event) => setUserType(event.target.value as UserType | "")}
          error={fieldErrors.userType}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {USER_TYPE_OPTIONS.map((type) => {
            const rendered = renderLabel(locale, USER_TYPE_LABELS[type]);
            return (
              <option key={type} value={type} lang={rendered.lang}>
                {rendered.text}
              </option>
            );
          })}
        </SelectField>

        {userType === "secondary" ? (
          <>
            <SelectField
              id="register-gradeLevel"
              label={t("fields.grade")}
              required
              value={gradeLevel}
              onChange={(event) =>
                setGradeLevel(event.target.value as RegisterFormState["gradeLevel"])
              }
              error={fieldErrors.gradeLevel}
            >
              <option value="">{t("selectPlaceholder")}</option>
              {GRADE_LEVEL_KEYS.map((key) => {
                const rendered = renderLabel(locale, GRADE_LEVEL_LABELS[key]);
                return (
                  <option key={key} value={key} lang={rendered.lang}>
                    {rendered.text}
                  </option>
                );
              })}
            </SelectField>
            <SelectField
              id="register-studyStream"
              label={t("fields.stream")}
              required
              value={studyStream}
              onChange={(event) =>
                setStudyStream(event.target.value as RegisterFormState["studyStream"])
              }
              error={fieldErrors.studyStream}
            >
              <option value="">{t("selectPlaceholder")}</option>
              {STUDY_STREAM_KEYS.map((key) => {
                const rendered = renderLabel(locale, STUDY_STREAM_LABELS[key]);
                return (
                  <option key={key} value={key} lang={rendered.lang}>
                    {rendered.text}
                  </option>
                );
              })}
            </SelectField>
          </>
        ) : null}

        {userType === "undergraduate" || userType === "graduate" ? (
          <>
            <SelectField
              id="register-universityName"
              label={t("fields.university")}
              required={userType === "undergraduate" || userType === "graduate"}
              value={universityName}
              onChange={(event) => setUniversityName(event.target.value)}
              error={fieldErrors.universityName}
            >
              {universityState === "loading" ? (
                <option value="">{t("university.loading")}</option>
              ) : universityState === "error" ? (
                <option value="">{t("university.loadError")}</option>
              ) : (
                <>
                  <option value="">{t("selectPlaceholder")}</option>
                  {nonKktcUniversities.length > 0 ? (
                    <optgroup label={turkeyGroupLabel.text} lang={turkeyGroupLabel.lang}>
                      {nonKktcUniversities.map((university) => (
                        <option key={university.nameTr} value={university.nameTr}>
                          {university.nameTr}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {kktcUniversities.length > 0 ? (
                    <optgroup label={kktcGroupLabel.text} lang={kktcGroupLabel.lang}>
                      {kktcUniversities.map((university) => (
                        <option key={university.nameTr} value={university.nameTr}>
                          {university.nameTr}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </>
              )}
            </SelectField>
            <SelectField
              id="register-departmentName"
              label={t("fields.department")}
              required={userType === "undergraduate"}
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
              error={fieldErrors.departmentName}
            >
              {departmentState === "loading" ? (
                <option value="">{t("department.loading")}</option>
              ) : departmentState === "error" ? (
                <option value="">{t("department.loadError")}</option>
              ) : (
                <>
                  <option value="">{t("selectPlaceholder")}</option>
                  {departments.map((department) => (
                    <option key={department.nameTr} value={department.nameTr}>
                      {department.nameTr}
                    </option>
                  ))}
                </>
              )}
            </SelectField>
            <p aria-live="polite" className={styles.srOnly}>
              {universityAnnouncement}
            </p>
            <p aria-live="polite" className={styles.srOnly}>
              {departmentAnnouncement}
            </p>
          </>
        ) : null}

        <SelectField
          id="register-provincePlateCode"
          label={t("fields.province")}
          required
          value={provincePlateCode}
          onChange={(event) => setProvincePlateCode(event.target.value)}
          error={fieldErrors.provincePlateCode}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {provinces.map((province) => (
            <option key={province.plateCode} value={province.plateCode}>
              {province.nameTr}
            </option>
          ))}
        </SelectField>

        {/* Always enabled, never `disabled` — a disabled control is skipped by Tab and
            explains nothing; a state-carrying placeholder is reachable, readable and needs
            no instruction sentence (plan §4.4, `CONTENT-STYLE.md` §22). */}
        <SelectField
          id="register-districtId"
          label={t("fields.district")}
          required
          value={districtId}
          onChange={(event) => setDistrictId(event.target.value)}
          error={districtError}
        >
          {provincePlateCode === "" ? (
            <option value="">{t("district.selectProvinceFirst")}</option>
          ) : districtState === "loading" ? (
            <option value="">{t("district.loading")}</option>
          ) : districtState === "error" ? (
            <option value="">{t("district.loadError")}</option>
          ) : (
            <>
              <option value="">{t("district.selectPlaceholder")}</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.nameTr}
                </option>
              ))}
            </>
          )}
        </SelectField>
        {districtState === "error" ? (
          <button
            type="button"
            ref={districtRetryRef}
            className={`btn btn-ghost ${styles.districtRetry}`}
            onClick={() => {
              districtRetryPendingRef.current = true;
              setDistrictState("loading");
            }}
          >
            {t("district.retry")}
          </button>
        ) : null}
        <p aria-live="polite" className={styles.srOnly}>
          {districtAnnouncement}
        </p>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {t("register.submit")}
          </button>
        </div>
        <noscript>
          <p className={styles.noscript}>{t("noscript")}</p>
        </noscript>
      </form>
    </div>
  );
}
