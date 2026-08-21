import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

/**
 * MESSAGE-KEY + RENDER guards for the climate section's method / reading-point disclosure
 * (SPEC §9.2-1, §9.2-2).
 *
 * Separate from `attribution-notice.test.ts` on purpose. That file guards the provider's
 * VERBATIM licence text — an untouchable class where a byte pin is the right instrument.
 * These three sentences are OUR prose: they are meant to be edited for clarity, so pinning
 * their bytes would be wrong. What must not happen is that they silently stop rendering, and
 * that is what is guarded here.
 *
 * Why a catalogue guard is needed at all: next-intl logs a missing key and renders its dotted
 * path rather than failing the build, and this repo defines no `IntlMessages` global typing.
 * Deleting `Climate.notice.readingPoint` type-checks, builds, ships "Climate.notice
 * .readingPoint" onto 81 indexable pages, and leaves CI green.
 *
 * Both locales, even though the climate block is TR-gated today: the gate is one boolean
 * (`EN_CONTENT_READY`, `lib/seo/indexing.ts`), and a key that resolves only in Turkish turns
 * flipping it into a visible regression rather than a content release.
 *
 * Structural only (`CONVENTIONS.md` §2) — never asserts what the copy says.
 */

const NOTICE_KEYS = ["reanalysis", "readingPoint", "cellFallback"] as const;

const catalogues = { tr: tr.Climate.notice, en: en.Climate.notice } as const;

describe("the disclosure catalogue", () => {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    describe(locale, () => {
      it.each(NOTICE_KEYS)("resolves Climate.notice.%s to a non-empty string", (key) => {
        const value = catalogue[key];
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      });

      it("keeps the {km} interpolation in the coastal line", () => {
        // Without this, an edit can drop the placeholder and publish a sentence that declares
        // a shift while naming no distance — which satisfies nobody and satisfies A-1 least
        // of all, since the whole condition is that the shift is declared WITH its magnitude.
        expect(catalogue.cellFallback).toContain("{km}");
      });

      it.each(["reanalysis", "readingPoint"] as const)(
        "keeps Climate.notice.%s free of interpolation",
        (key) => {
          // These two are constants of the source, identical on all 81 pages. A placeholder
          // appearing here would mean someone started feeding them per-province data, which is
          // the moment the sentence stops being true for the other 80.
          expect(catalogue[key]).not.toMatch(/\{[a-zA-Z]/);
        },
      );
    });
  }
});

/**
 * THE DISCLOSURE TRAVELS WITH THE VALUES.
 *
 * The catalogue guards above prove the strings exist. They cannot prove they are on the page
 * that carries the numbers. This repo's vitest environment is `node` and the climate section
 * is an async server component, so it cannot be rendered here; the honest guard at this level
 * is the source symbol, scoped to the one component the obligation is about — the same
 * instrument, and the same reasoning, as `attribution-notice.test.ts`.
 */
describe("the climate section renders the disclosure", () => {
  const section = readFileSync(
    new URL("../../components/climate/climate-section.tsx", import.meta.url),
    "utf8",
  );

  it.each(NOTICE_KEYS)("references notice.%s", (key) => {
    expect(section).toContain(`notice.${key}`);
  });

  it("keys the disclosure to the source token rather than rendering it unconditionally", () => {
    // SPEC §9.2: the reading method is a constant of the SOURCE. If this gate is removed, the
    // sentences keep rendering for whatever series arrives next and start describing a reading
    // method that series may not use.
    expect(section).toMatch(/SOURCE_OWES_METHOD_DISCLOSURE\[climate\.source\]/);
  });

  it("gates the coastal line so the other 76 provinces render nothing", () => {
    // The failure this prevents is not a crash: an ungated line would print a declared shift
    // for provinces that have none, which is false on 76 pages.
    expect(section).toMatch(/fallbackKm !== null/);
  });

  it("takes the distance from the rounding lookup, never from the raw table", () => {
    // Reading `CELL_FALLBACK_KM` here would put a two-decimal figure in front of a reader.
    expect(section).toContain("cellFallbackDisplayKm");
    expect(section).not.toContain("CELL_FALLBACK_KM");
  });

  it("keeps the copy out of the component source — one copy, in the catalogues", () => {
    // Same rule the licence notice is held to, for the same reason: a second copy is an edit
    // waiting to disagree with the first.
    expect(section).not.toContain("istasyon ölçümü değildir");
    expect(section).not.toContain("not station measurements");
  });
});
