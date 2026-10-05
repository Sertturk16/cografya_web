import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("V2 error boundaries", () => {
  it("V2 has its own not-found so it never renders V1 chrome", () => {
    /**
     * A not-found boundary REPLACES `children`, so before this file existed the `.v2-app`
     * wrapper never rendered and the `body:has(.v2-app) > header, footer` suppression rule
     * never matched: a V2 route that called `notFound()` came back wearing V1's header and
     * footer.
     */
    /**
     * The original fix was to give the boundary its own `<V2Header />`/`<V2Footer />`. T-032 PR3
     * made that unnecessary and then wrong: the chrome lives in `app/[locale]/(site)/layout.tsx`,
     * and a `not-found.tsx` inside a route group renders INSIDE that group's layout — so the
     * boundary wears the chrome by position rather than by remembering to import it, and a copy
     * of its own would show up twice.
     *
     * The V1 half of the original defect is gone outright: there is no `.v2-app` wrapper and no
     * `body:has(.v2-app)` suppression rule to fail to match, because there is no V1 chrome left
     * to suppress. What remains is that the boundary must sit in the group.
     */
    const source = read("../../app/[locale]/(site)/not-found.tsx");
    expect(source).not.toContain("<V2Header");
    expect(source).not.toContain("<V2Footer");
    // It is the group's boundary, not the root's — a `not-found.tsx` directly under `[locale]`
    // would render with only the document shell, which is the original defect's shape.
    expect(
      existsSync(
        fileURLToPath(new URL("../../app/[locale]/(site)/not-found.tsx", import.meta.url)),
      ),
      "(site) has no not-found boundary",
    ).toBe(true);
    expect(
      existsSync(fileURLToPath(new URL("../../app/[locale]/not-found.tsx", import.meta.url))),
      "a second not-found sits outside the (site) group and would render bare",
    ).toBe(false);
  });

  /**
   * `(site)`, `(play)` and `(embed)` each need their own: a group without one falls through to
   * `app/global-error.tsx`, the unstyled last-resort shell that replaces the whole document.
   */
  const ERROR_BOUNDARIES = [
    "../../app/[locale]/(site)/error.tsx",
    "../../app/[locale]/(play)/error.tsx",
    "../../app/[locale]/(embed)/error.tsx",
  ];

  /** The body all three render; the a11y and no-leak rules live in it, once. */
  const ROUTE_ERROR = "./v2-route-error.tsx";

  it.each(ERROR_BOUNDARIES)("%s is a client component that renders the shared body", (rel) => {
    const source = stripComments(read(rel));
    expect(source).toContain('"use client"');
    expect(source).toMatch(/<V2RouteError[^>]*reset=\{reset\}/);
  });

  it.each(ERROR_BOUNDARIES)("%s never surfaces the error object", (rel) => {
    // It can carry a server stack. Next already reports server-side failures through its own
    // channel, so logging or rendering it adds nothing and can leak.
    const source = stripComments(read(rel));
    expect(source).not.toContain("console.error");
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.digest");
  });

  it("the shared body moves focus to its heading", () => {
    // docs/design.md a11y floor: a boundary that swaps page content in place mid-session has
    // to announce itself, and focus movement is the signal that does not depend on a live
    // region being noticed before its content settles.
    const source = stripComments(read(ROUTE_ERROR));
    expect(source).toContain("tabIndex={-1}");
    expect(source).toContain(".focus()");
  });

  it("the shared body's retry refetches from the server, not only re-renders", () => {
    // `reset()` alone re-renders the same failed RSC payload, so a Server Component error (the
    // API was down) stays on screen. `retryRoute` refreshes first; see `lib/nav/retry-route.ts`.
    const source = stripComments(read(ROUTE_ERROR));
    expect(source).toContain("onClick={() => retryRoute(router, reset)}");
    expect(source).not.toContain("onClick={reset}");
    expect(source).toMatch(/import \{ useRouter \} from "@\/i18n\/navigation"/);
  });

  it("global-error's retry reloads the document", () => {
    // It sits outside every provider and replaces the whole document; a reload is the refetch.
    const source = stripComments(read("../../app/global-error.tsx"));
    expect(source).toContain("window.location.reload()");
    expect(source).not.toMatch(/\breset\(/);
  });

  it("the shared body takes no error and logs nothing", () => {
    const source = stripComments(read(ROUTE_ERROR));
    expect(source).not.toContain("console.error");
    expect(source).not.toMatch(/\berror\b/);
  });

  it("the (play) boundary draws the chrome its layout does not", () => {
    // `(play)/layout.tsx` has no header and no `<main>`; each game page renders `V2Header`
    // itself, and the boundary replaces the page, so it has to bring both back.
    const source = stripComments(read("../../app/[locale]/(play)/error.tsx"));
    expect(source).toContain("<V2Header");
    expect(source).toMatch(/<main[^>]*>\s*<V2RouteError/);
  });

  it("every boundary takes its copy from the catalogues", () => {
    // Hard-coded Turkish here would be invisible to the EN reader who triggered it.
    for (const rel of ["../../app/[locale]/(site)/not-found.tsx", ROUTE_ERROR]) {
      expect(stripComments(read(rel))).toMatch(/useTranslations|getTranslations/);
    }
  });
});
