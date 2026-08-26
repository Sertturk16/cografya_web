import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * G6 (plan §9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`):
 * message-key resolution guard for the `Auth` namespace, on the `site-nav/messages.test.ts`
 * pattern. Every `Auth.*` key the auth screens actually ask for must resolve to a
 * non-empty string in BOTH catalogues; the consumer scan is derived from the sources, not
 * hand-maintained alone, so a key used elsewhere cannot silently fall outside this guard.
 *
 * `AUTH_KEYS` below deliberately does NOT include the error-code map's keys
 * (`Auth.errors.*`) — those are resolved through a VARIABLE
 * (`t(AUTH_ERROR_MESSAGE_KEYS[code])`), which this file's literal-call scan cannot and does
 * not need to see; `error-messages.test.ts` (gate G3) covers that set on its own.
 */

const AUTH_KEYS = [
  "login.metaTitle",
  "login.metaDescription",
  "login.heading",
  "login.submit",
  "login.forgot",
  "login.alreadySignedIn",
  "login.logout",
  "login.loggedOut",
  "reset.metaTitle",
  "reset.metaDescription",
  "reset.heading",
  "reset.submit",
  "reset.accepted",
  "resetNew.metaTitle",
  "resetNew.metaDescription",
  "resetNew.heading",
  "resetNew.submit",
  "resetNew.done",
  "register.metaTitle",
  "register.metaDescription",
  "register.heading",
  "register.submit",
  "verify.metaTitle",
  "verify.metaDescription",
  "verify.heading",
  "verify.submit",
  "verify.resend",
  "verify.resendAccepted",
  "fields.firstName",
  "fields.lastName",
  "fields.phone",
  "fields.phonePlaceholder",
  "fields.email",
  "fields.password",
  "fields.passwordConfirm",
  "fields.userType",
  "fields.province",
  "fields.district",
  "fields.grade",
  "fields.stream",
  "fields.university",
  "fields.department",
  "fields.verificationCode",
  "fields.resetCode",
  "fields.newPassword",
  "hints.newPassword",
  "selectPlaceholder",
  "district.selectProvinceFirst",
  "district.loading",
  "district.selectPlaceholder",
  "district.loadError",
  "district.announceCount",
  "university.loading",
  "university.loadError",
  "department.loading",
  "department.loadError",
  "fieldErrors.required",
  "fieldErrors.emailInvalid",
  "fieldErrors.phoneInvalid",
  "fieldErrors.passwordPolicy",
  "fieldErrors.passwordMismatch",
  "fieldErrors.codeShape",
  "formErrors.summary",
  "noscript",
] as const;

function resolve(catalogue: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey.split(".").reduce<unknown>((node, segment) => {
    if (typeof node !== "object" || node === null) return undefined;
    return (node as Record<string, unknown>)[segment];
  }, catalogue);
}

const catalogues = { tr: trMessages.Auth, en: enMessages.Auth } as const;

/**
 * Namespace-call detector, matching BOTH shapes this repo actually uses: a plain-string
 * `useTranslations("Auth")` / `getTranslations("Auth")` (client components, and the second
 * call inside every auth page's own body) and the object-argument
 * `getTranslations({ locale, namespace: "Auth" })` (every auth page's `generateMetadata`).
 *
 * Two regexes on purpose. `AUTH_NAMESPACE_CALL` hardcodes the literal `"Auth"` — the
 * `site-nav/messages.test.ts` precedent (`/(?:use|get)Translations\("Nav"\)/`) — and is
 * the ONLY one used to select which files are Auth consumers; a generic
 * `"([^"]+)"`-capturing regex used for that same filter would match every OTHER
 * namespace's call too (measured: it did, on first write of this file — `Breadcrumb`,
 * `Common`, `Footer`, … all matched and then failed the "only Auth" assertion). The
 * capturing `NAMESPACE_CALL_GLOBAL` is used ONLY afterwards, to enumerate every
 * `Translations(...)` call inside a file THAT ALREADY PASSED the Auth-only filter, so a
 * file mixing `Auth` with a second namespace still gets caught.
 */
const AUTH_NAMESPACE_CALL =
  /(?:use|get)Translations\(\s*(?:"Auth"|\{\s*locale,\s*namespace:\s*"Auth"\s*\})\s*\)/;
const NAMESPACE_CALL_GLOBAL =
  /(?:use|get)Translations\(\s*(?:"([^"]+)"|\{\s*locale,\s*namespace:\s*"([^"]+)"\s*\})\s*\)/g;

const ROOTS = [
  { label: "components", url: new URL("../", import.meta.url) },
  { label: "app", url: new URL("../../app/", import.meta.url) },
] as const;

const consumerSources = ROOTS.flatMap(({ label, url }) =>
  readdirSync(url, { recursive: true, encoding: "utf8" })
    .filter(
      (name): name is string =>
        typeof name === "string" && /\.(?:ts|tsx)$/.test(name) && !name.includes("node_modules"),
    )
    .map((name) => ({
      path: `${label}/${name}`,
      source: readFileSync(fileURLToPath(new URL(name, url)), "utf8").replace(
        /\/\*[\s\S]*?\*\//g,
        " ",
      ),
    }))
    .filter(({ source }) => AUTH_NAMESPACE_CALL.test(source)),
);

describe("Auth message catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(AUTH_KEYS)("resolves %s to a non-empty string", (key) => {
        const value = resolve(catalogue, key);
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    });
  }

  it("carries the SAME key set in both locales", () => {
    function flatten(node: unknown, prefix: string): string[] {
      if (typeof node !== "object" || node === null) return [prefix];
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        flatten(value, prefix ? `${prefix}.${key}` : key),
      );
    }
    expect(flatten(enMessages.Auth, "").sort()).toEqual(flatten(trMessages.Auth, "").sort());
  });

  it("discovers at least one Auth consumer", () => {
    expect(consumerSources.length).toBeGreaterThan(0);
  });

  it.each(consumerSources)(
    "$path asks only the Auth namespace, for keys the list knows",
    ({ source }) => {
      const namespaces = [...source.matchAll(NAMESPACE_CALL_GLOBAL)].map(
        (match) => match[1] ?? match[2],
      );
      // Anchors the scan: a refactor that renamed the translator call would pass vacuously.
      expect(namespaces.length).toBeGreaterThan(0);
      for (const namespace of namespaces) {
        expect(namespace).toBe("Auth");
      }

      const requested = [...source.matchAll(/\bt\("([^"]+)"\)/g)].map((match) => match[1]);
      expect(requested.length).toBeGreaterThan(0);
      for (const key of requested) {
        expect(AUTH_KEYS).toContain(key);
      }
    },
  );
});
