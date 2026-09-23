import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * BINDING GUARD: a component that renders a mandated notice has no switch for turning it off.
 *
 * ## The failure this exists to prevent
 *
 * `ClimateSection` and `AirPollutionSection` each took a `hideAttribution` prop. The province
 * page passed it at three call sites, and each component then dropped its ENTIRE attribution
 * block — the source line, the licence line, the reference citation and the provider's own
 * verbatim wording — on the understanding that the credit was "delegated to the page
 * footer/sources".
 *
 * The delegated target was a per-page sources card (since deleted), which rendered the quote
 * inside a `<details>` labelled "Atıf şartı & yasal metin", CLOSED BY DEFAULT. That is a
 * bibliography echo, not a notice: the criterion this repo applies — stated in
 * `components/marine/marine-attribution.tsx`'s own docblock, from the reading of CC BY 4.0 and
 * ECMWF's "shall be attached" wording — is VISIBLE WITHOUT A CLICK on the page carrying the
 * derived material. So on every province page with a climate chart, ERA5-Land's required
 * notice appeared nowhere a reader would see it, and the same for ACAG's on every page with a
 * PM2.5 series.
 *
 * Nothing failed. The prop typechecked, the tests were green, and the two components
 * disagreed with the third (`MarineAttribution`, which has no such prop and never did) with
 * nothing to notice that they did.
 *
 * ## What is derived
 *
 * The subject list is not hand-kept. A component is in scope if it renders EITHER of the two
 * markers a mandated notice leaves in source:
 *
 *  - a `lang="en"` scope — how this repo marks an untranslated provider string published
 *    verbatim (WCAG 3.1.2, and the rule is written down in all four attribution components);
 *  - `Marine.disclaimer.educationalOnly` — the sea-safety sentence, "not for maritime,
 *    navigational or safety-of-life decisions".
 *
 * The second marker was added when the licence notices centralized onto `/hakkimizda`. That
 * move was licence-correct (CC BY 4.0 §3(a)(2) admits a hyperlink), and it had one hazard: the
 * component left beside the values, `MarineDataNotice`, carries the safety disclaimer and NO
 * verbatim provider string, so the `lang="en"` marker alone would have stopped seeing the one
 * component whose notice is least safe to make optional. A `variant="compact"` that dropped the
 * sentence would have been the exact `hideAttribution` defect again, on the exact page where a
 * reader is reading a wave height.
 *
 * Whatever the next such component is called, it is caught by writing the `lang="en"` its own
 * notice needs or by rendering the disclaimer it is there to carry.
 *
 * Structural only (`CONVENTIONS.md` §2): prop shapes, never copy.
 */

const componentsDir = fileURLToPath(new URL("./", import.meta.url));

const walkTsx = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });

/**
 * `lang="en"` on a Turkish-locale surface means one thing here: a provider's own wording,
 * published untranslated because a licence requires it.
 */
const VERBATIM_PROVIDER_STRING = 'lang="en"';

/** The sea-safety sentence. Not a licence notice, and the least optional string on the site. */
const SAFETY_DISCLAIMER = "disclaimer.educationalOnly";

const isCarrier = (source: string) =>
  source.includes(VERBATIM_PROVIDER_STRING) || source.includes(SAFETY_DISCLAIMER);

const carriers = walkTsx(componentsDir)
  .map((file) => ({ file, source: readFileSync(file, "utf8") }))
  .filter(({ source }) => isCarrier(source))
  // Comments are stripped before the scan below, and the reason is not tidiness: the two
  // components this rule was written for now carry a docblock saying "THERE IS NO
  // `hideAttribution` PROP, AND THERE MUST NOT BE ONE". Matching on that would fail the file
  // for explaining the rule it obeys, and the obvious fix — deleting the explanation — is the
  // one thing that must not happen.
  .map(({ file, source }) => ({
    file,
    source: stripComments(source),
  }));

/**
 * A prop that switches a notice off. `hide`/`suppress`/`without` + `attribution`,
 * `licence`/`license`, `notice`, `credit`, `source`, `disclaimer` or `warning`, in either
 * order, case-insensitive — the shapes a future `omitLicence`, `noAttribution` or
 * `hideDisclaimer` would take.
 */
const OFF_SWITCH =
  /\b(?:hide|suppress|without|no|omit|skip)(?:Attribution|Licen[cs]e|Notice|Credit|Sources?|Disclaimer|Warning)\b/i;

describe("an attribution is not a prop", () => {
  it("finds the components that publish a verbatim provider string", () => {
    // Anti-vacuity: a marker that stopped matching would satisfy the loop below for free, and
    // finding these components is the whole point of deriving them rather than listing them.
    expect(carriers.length, "components rendering a mandated notice").toBeGreaterThan(3);
  });

  it("finds them by BOTH markers, not only the older one", () => {
    // Per-marker anti-vacuity, and the reason it is worth its own assertion: the disclaimer
    // marker was added for a component that carries no `lang="en"` at all. If it ever matches
    // nothing, the derivation has silently gone back to the list it had before the licence
    // notices centralized — green, and blind to the compact notice.
    const withProviderString = carriers.filter(({ source }) =>
      source.includes(VERBATIM_PROVIDER_STRING),
    );
    const withDisclaimer = carriers.filter(({ source }) => source.includes(SAFETY_DISCLAIMER));

    expect(
      withProviderString.length,
      'components rendering a lang="en" provider string',
    ).toBeGreaterThan(3);
    expect(
      withDisclaimer.length,
      "components rendering the marine safety disclaimer",
    ).toBeGreaterThan(0);
  });

  it("gives none of them a switch for turning the notice off", () => {
    for (const { file, source } of carriers) {
      const name = file.slice(file.lastIndexOf("/") + 1);
      const offender = OFF_SWITCH.exec(source);
      expect(
        offender?.[0] ?? null,
        `${name} takes "${offender?.[0]}" — a mandated notice may not be optional; ` +
          "it renders in full, visible without a click, beside the material it credits",
      ).toBeNull();
    }
  });
});
