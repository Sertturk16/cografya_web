import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageContainer, type PageContainerProps } from "./page-container";

type Space = Required<PageContainerProps>["space"];

/**
 * A compile-time closed-union check, not a hand-written list a fifth member could silently
 * outgrow. `Record<Space, true>` requires every member of `Space` as a key and rejects any key
 * that is not one — TypeScript's excess-property check on an object literal assigned to a
 * mapped type runs in both directions. Add a fifth rhythm to `RHYTHM` (which is what `Space`
 * is derived from, `keyof typeof RHYTHM`) without adding it here and `pnpm typecheck` fails on
 * this file; delete one from here without `RHYTHM` shrinking and it fails the other way. The
 * `Object.keys` read below turns that same exactness into a runtime assertion.
 */
const RHYTHM_MEMBERS: Record<Space, true> = {
  band: true,
  tight: true,
  default: true,
  loose: true,
};

describe("PageContainer", () => {
  it("renders one container with the shared width and padding", () => {
    const html = renderToStaticMarkup(<PageContainer>body</PageContainer>);
    expect(html).toContain("max-w-7xl");
    expect(html).toContain("mx-auto");
    expect(html).toContain("px-4");
  });

  it("carries no min-h-screen and no background — the (site) layout owns those", () => {
    // Five pages used to duplicate the layout's wrapper. If the container starts providing
    // it too, that duplication becomes invisible instead of removed.
    const html = renderToStaticMarkup(<PageContainer>body</PageContainer>);
    expect(html).not.toContain("min-h-screen");
    expect(html).not.toContain("bg-background");
  });

  it("offers four rhythms, and only `band` carries no page-level vertical padding", () => {
    const band = renderToStaticMarkup(<PageContainer space="band">b</PageContainer>);
    const tight = renderToStaticMarkup(<PageContainer space="tight">b</PageContainer>);
    const loose = renderToStaticMarkup(<PageContainer space="loose">b</PageContainer>);
    expect(tight).not.toEqual(loose);
    // The six tails collapsed into four named rhythms; an open `className` would let a
    // seventh tail back in through the prop, which is how the spellings grew in the first
    // place. TypeScript blocks it (`className?: never`); this asserts the runtime shape.
    expect(tight).toContain("space-y-");
    // `band` sits inside a full-bleed header that already owns `py-10 sm:py-14`; page-level
    // `pt-6`/`pb-20` there would double that spacing, so it must be the one rhythm without it.
    expect(band).not.toContain("pt-6");
    expect(band).not.toContain("pb-20");
    expect(tight).toContain("pt-6");
    expect(tight).toContain("pb-20");
  });

  it("renders `default`, the rhythm 21 of the 34 migrated call sites use and the prop's own fallback", () => {
    // `default` is the no-`space`-prop shape — the omitted rhythm in the test above, and the
    // one no test rendered at all before this. `RHYTHM.default` (`pt-6 pb-20 sm:pt-10
    // space-y-14`) sits between `tight` (`space-y-8`) and `loose` (`space-y-16`): same
    // page-level padding as both, its own `space-y-14`.
    const withProp = renderToStaticMarkup(<PageContainer space="default">b</PageContainer>);
    const omitted = renderToStaticMarkup(<PageContainer>b</PageContainer>);
    expect(withProp).toEqual(omitted);
    expect(withProp).toContain("pt-6");
    expect(withProp).toContain("pb-20");
    expect(withProp).toContain("space-y-14");
  });

  it("the rhythm union has exactly four members", () => {
    // Nothing asserted the union was CLOSED at four before this — only that three of the four
    // differ from each other. An open `className` passthrough was refused on this branch
    // precisely because it would let the collapsed six-tail spellings back in (see the
    // `className?: never` comment on `PageContainerProps` and `docs/design.md`); a fifth
    // rhythm added without matching discussion is the same regression through a different
    // door, and nothing before this test would have noticed it landing.
    expect(Object.keys(RHYTHM_MEMBERS).sort()).toEqual(["band", "default", "loose", "tight"]);
  });

  it.each(Object.keys(RHYTHM_MEMBERS) as Space[])(
    'space="%s" renders without throwing',
    (space) => {
      // Each member of the checked-exhaustive list above must actually be a real, renderable
      // rhythm — the exactness check alone would pass just as well against a typo'd key.
      expect(() =>
        renderToStaticMarkup(<PageContainer space={space}>b</PageContainer>),
      ).not.toThrow();
    },
  );
});
