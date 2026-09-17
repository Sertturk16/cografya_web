import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageContainer } from "./page-container";

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
});
