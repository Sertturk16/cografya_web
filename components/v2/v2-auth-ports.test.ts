import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T-032 PR1 — the four ported pages and the three client islands behind them.
 *
 * ## Why the a11y half of this file exists
 *
 * `components/auth/auth-a11y.structure.test.ts` (gate G4) proves the auth flows wire their
 * accessibility contract. It derives its file list from `components/auth/` by directory, so
 * it covers the V1 `*-form.tsx` islands and NOTHING ELSE — the V2 cards live in
 * `components/v2/` under a different name, and PR4 deletes the directory G4 lives in. Without
 * the assertions below, retiring V1 would quietly retire the guarantee too.
 *
 * `components/auth/messages.test.ts` (gate G6) needs no such treatment: it scans `components/`
 * and `app/` recursively for anything that opens the `Auth` namespace, so it already covers
 * these files. It only needs MOVING when its directory goes, not duplicating here.
 *
 * `vitest.config.ts` runs a bare node environment with no jsdom, so no test in this repo can
 * render a component or prove focus actually moved. This file proves the SOURCE always wires
 * the contract, which is the half CI can check; the browser pass is evidence, never a gate.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const AUTH_PAGES = [
  "../../app/[locale]/(site)/sifre-sifirlama/page.tsx",
  "../../app/[locale]/(site)/sifre-sifirlama/yeni/page.tsx",
  "../../app/[locale]/(site)/e-posta-dogrulama/page.tsx",
] as const;

const ALL_PAGES = [...AUTH_PAGES, "../../app/[locale]/(site)/hakkimizda/page.tsx"] as const;

const CARDS = [
  "./v2-password-reset-request-card.tsx",
  "./v2-password-reset-confirm-card.tsx",
  "./v2-verify-email-card.tsx",
] as const;

describe("the ported pages wear V2 chrome", () => {
  it.each(ALL_PAGES)("%s gets the V2 header and footer from the (site) layout", (page) => {
    /**
     * This used to assert that each page rendered `<V2Header />` and `<V2Footer />` itself.
     * T-032 PR3 moved both into `app/[locale]/(site)/layout.tsx`, because copying chrome into
     * every page is how two pages ended up without a footer and twenty-four ended up nesting a
     * second `<main>` inside the root layout's.
     *
     * So the guarantee moved from "this page renders the chrome" to "this page cannot render
     * WITHOUT it": membership of the `(site)` group is what supplies it, and a page in that
     * group that also renders its own would ship two headers. Both halves are asserted, because
     * the second is now the live failure mode.
     */
    expect(page, "page is outside the (site) group").toContain("/(site)/");
    const source = stripComments(read(page));
    expect(source, "page renders a second V2Header").not.toContain("<V2Header");
    expect(source, "page renders a second V2Footer").not.toContain("<V2Footer");
  });

  it("the (site) layout every one of them sits under renders that chrome exactly once", () => {
    // Anti-vacuity for the assertion above: it only means anything if the layout really does
    // supply the chrome. Counted, not just present — a duplicate here duplicates it everywhere.
    const layout = stripComments(read("../../app/[locale]/(site)/layout.tsx"));
    expect(layout.match(/<V2Header\b/g), "V2Header in the (site) layout").toHaveLength(1);
    expect(layout.match(/<V2Footer\b/g), "V2Footer in the (site) layout").toHaveLength(1);
  });

  it.each(ALL_PAGES)("%s reaches for no V1 component", (page) => {
    const source = stripComments(read(page));
    expect(source).not.toContain("@/components/breadcrumb");
    expect(source).not.toContain("@/components/auth/");
    expect(source).not.toMatch(/className="container page"/);
    // The V1 utility classes PR4 deletes from globals.css. A page that still leans on one
    // renders unstyled the moment that PR lands, and nothing else would notice.
    expect(source).not.toMatch(/\bclassName="[^"]*\b(?:lede|btn|wrap-long-tokens)\b/);
  });

  it.each(AUTH_PAGES)("%s builds metadata through the auth helper", (page) => {
    const source = stripComments(read(page));
    expect(source).toContain("buildAuthMetadata");
    expect(source).not.toMatch(/\bbuildMetadata\s*\(/);
  });

  it("the about page keeps its indexable surface rather than inheriting noindex", () => {
    // `/hakkimizda` is a `localized` surface; it is editorial content, not an auth screen.
    const source = stripComments(read("../../app/[locale]/(site)/hakkimizda/page.tsx"));
    expect(source).toMatch(/\bbuildMetadata\s*\(/);
    expect(source).not.toContain("buildAuthMetadata");
    expect(source).not.toContain('surface: "noindex"');
  });
});

describe("the ported cards keep lib/auth and drop components/auth", () => {
  it.each(CARDS)("%s", (card) => {
    const source = stripComments(read(card));
    expect(source).toContain("@/lib/auth/");
    expect(source).not.toContain("@/components/auth/");
    expect(source).not.toContain("auth-form.module.css");
    // A link styled as a button composes `buttonVariants`; `Button` has no `asChild`.
    expect(source).not.toMatch(/className="[^"]*\bbtn\b/);
  });
});

describe("the a11y contract G4 pinned for V1 still holds for the V2 ports", () => {
  it.each(CARDS)("%s moves focus when its state changes", (card) => {
    expect(stripComments(read(card))).toContain(".focus()");
  });

  it.each(["./v2-password-reset-request-card.tsx", "./v2-password-reset-confirm-card.tsx"])(
    "%s gives every state it swaps in a focusable target",
    (card) => {
      // Only these two replace the whole card with a new state. A wholesale subtree swap
      // cannot be announced by a live region — the role and its first content arrive in the
      // same commit, so assistive technology gets no "something changed" signal — which is why
      // each target is `tabIndex={-1}` and is focused instead.
      //
      // The verify-email card is deliberately absent: it redirects on success and never swaps
      // itself out, so its only focus target is the error heading inside `FormErrorSummary`,
      // pinned by the FormField block below rather than duplicated here.
      expect(stripComments(read(card))).toContain("tabIndex={-1}");
    },
  );

  it("the confirm card focuses each of its four states, not just the happy one", () => {
    const source = stripComments(read("./v2-password-reset-confirm-card.tsx"));
    for (const ref of [
      "errorHeadingRef",
      "successHeadingRef",
      "deadLinkHeadingRef",
      "checkingStatusRef",
    ]) {
      expect(source, `${ref} is never focused`).toContain(`${ref}.current?.focus()`);
    }
  });

  it("the checking state is focus-driven, never a bare live region", () => {
    // Its predecessor shipped a sole `role="status"` paragraph here and was corrected; the
    // port must not reintroduce the shape.
    const source = stripComments(read("./v2-password-reset-confirm-card.tsx"));
    expect(source).not.toMatch(/role="status"/);
  });

  it("the resend note IS a live region, because it is a text-only update", () => {
    // The opposite case, and the reason the rule above is about subtree swaps rather than
    // live regions generally: this node is permanently mounted and only its text changes.
    const source = stripComments(read("./v2-verify-email-card.tsx"));
    expect(source).toMatch(/role="status"/);
  });

  it.each([
    ["./v2-password-reset-confirm-card.tsx", "the opaque reset token"],
    ["./v2-verify-email-card.tsx", "the six-digit verification code"],
  ])("%s never puts %s in a numeric input", (card) => {
    const source = stripComments(read(card));
    // The reset token is base64url and may contain letters; the verification code is minted
    // with `padStart(6, "0")`, so "000000" is real and a leading zero must survive. Either
    // field as `type="number"` is silent data loss.
    expect(source).not.toContain('type="number"');
  });

  it("resolves auth error codes through the map, never as a literal key", () => {
    // The G6 scan is a regex over raw source text that deliberately excludes every
    // `Auth.errors.*` key, because it expects each to be reached through this lookup.
    for (const card of CARDS) {
      const source = stripComments(read(card));
      expect(source).not.toMatch(/\bt\("errors\./);
    }
  });
});

describe("FormField carries the wiring the V1 field component carried", () => {
  const source = stripComments(read("../patterns/form-field.tsx"));

  it("marks an invalid control and points it at the message", () => {
    expect(source).toContain("aria-invalid");
    expect(source).toContain("aria-describedby");
  });

  it("shows helper OR error, never both", () => {
    // Both at once makes the reader work out which applies, and a screen reader announces
    // them in sequence with no indication that one supersedes the other.
    expect(source).toContain("hasError ? errorId :");
  });

  it("gives the error summary an alert role and a focusable heading", () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain("tabIndex={-1}");
  });

  it("links each field error to its own input", () => {
    expect(source).toContain("href={`#${fieldError.id}`}");
  });
});
