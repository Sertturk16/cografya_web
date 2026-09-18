import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHero } from "./page-hero";

describe("PageHero", () => {
  it("renders the hub tier's heading in the brand colour", () => {
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="CBS Araçları" />);
    expect(html).toContain("<h1");
    expect(html).toContain("text-primary");
  });

  it("renders the detail tier larger and neutral", () => {
    const html = renderToStaticMarkup(<PageHero tier="detail" heading="İstanbul" />);
    expect(html).toContain("text-foreground");
    expect(html).toContain("sm:text-6xl");
  });

  it("renders exactly one h1 whichever tier is used", () => {
    // `/profil` ships two `<h1>` today — one in the page, one in the component it renders.
    // A hero that could emit a second would make that class of defect easier, not harder.
    for (const tier of ["hub", "detail"] as const) {
      const html = renderToStaticMarkup(<PageHero tier={tier} heading="x" lede="y" />);
      expect(html.match(/<h1/g)).toHaveLength(1);
    }
  });

  it("omits the lede entirely when there is none", () => {
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="x" />);
    expect(html).not.toContain("<p");
  });

  /**
   * Everything below is added to the brief's four, and every one of them pins a measurement
   * taken off the 17 live heroes rather than a preference.
   */

  it("keeps the h1 at or above the 1.9rem floor at every width", () => {
    // The floor `typography.tsx`'s docblock and `app/globals.css` both record. The hub tier
    // takes the site's spelling everywhere it is visible and keeps the floor where it is not:
    // `text-[1.9rem]` (30.4px) rather than the pages' `text-3xl` (30px) below `sm`.
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="x" />);
    expect(html).toContain("text-[1.9rem]");
    expect(html).not.toContain("text-3xl");
    // `text-3xl` ships a paired line-height; an arbitrary-value size does not, so the spelling
    // has to carry one itself or the heading sets solid at 1.9rem.
    expect(html).toContain("leading-tight");
  });

  it("wraps the hero in the one measured wrapper, with no variant", () => {
    // `relative z-10 max-w-3xl space-y-4` appears 14 times across the hub heroes, identically.
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="x" />);
    expect(html).toContain('class="relative z-10 max-w-3xl space-y-4"');
  });

  it("renders the notice between the heading and the lede, which is what five pages do", () => {
    const html = renderToStaticMarkup(
      <PageHero
        tier="hub"
        heading="x"
        badges={<span>rozet</span>}
        notice={<i>uyarı</i>}
        lede="özet"
      >
        <button type="button">eylem</button>
      </PageHero>,
    );
    const order = ["rozet", "<h1", "uyarı", "özet", "eylem"].map((needle) => html.indexOf(needle));
    expect(order.every((index) => index !== -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("gives the badges and the tail their measured wrappers, not the caller", () => {
    // The 14 heroes write `flex items-center gap-2` around the badges and `pt-2` around the
    // CTA. Adopting this component is meant to be a deletion at the call site, not a rewrite.
    //
    // `flex-wrap` was added in the adoption task, and it is a correction to the MEASUREMENT
    // rather than a preference: the row above was counted over the 14 HUB heroes only, and all
    // three DETAIL heroes (`turkiye/[slug]:379`, `turkiye/bolge/[slug]:453`, `dunya/[slug]:326`)
    // write `flex items-center gap-2 flex-wrap`, carrying 4 to 6 badges. Measured at 320px with
    // the token removed: `turkiye/bolge/marmara` clips 125px against the hero section's
    // `overflow-hidden`, losing its fifth badge entirely; `dunya/almanya` clips 113px. The only
    // alternative was the `className` escape hatch this component exists to refuse.
    const html = renderToStaticMarkup(
      <PageHero tier="hub" heading="x" badges={<span>b</span>}>
        <span>c</span>
      </PageHero>,
    );
    expect(html).toContain('<div class="flex items-center gap-2 flex-wrap"><span>b</span></div>');
    expect(html).toContain('<div class="pt-2"><span>c</span></div>');
  });

  it("emits no empty wrapper for a slot that was not filled", () => {
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="x" />);
    expect(html).not.toContain("flex items-center gap-2");
    expect(html).not.toContain("pt-2");
  });

  it("uses one lede spelling for both tiers", () => {
    // The 3 detail pages write the hub tokens plus `max-w-3xl`, which the hub wrapper already
    // supplies. Same tokens, one spelling — the difference was never a decision.
    const hub = renderToStaticMarkup(<PageHero tier="hub" heading="x" lede="y" />);
    const detail = renderToStaticMarkup(<PageHero tier="detail" heading="x" lede="y" />);
    const lede = 'class="text-muted-foreground text-sm sm:text-base leading-relaxed"';
    expect(hub).toContain(lede);
    expect(detail).toContain(lede);
  });

  it("puts the two tiers a real step apart", () => {
    const hub = renderToStaticMarkup(<PageHero tier="hub" heading="x" />);
    const detail = renderToStaticMarkup(<PageHero tier="detail" heading="x" />);
    expect(hub).toContain("font-bold");
    expect(hub).toContain("text-primary");
    expect(detail).toContain("font-extrabold");
    expect(detail).toContain("text-4xl");
    expect(hub).not.toContain("text-4xl");
  });

  it("drops a className smuggled past the type by a Record spread", () => {
    // `className?: never` refuses every honest spelling — a direct prop, an inline-object
    // spread, a `{ className?: string }` spread — and is defeated SILENTLY by a
    // `Record<string, unknown>` spread, which is not an exotic shape. Review round 1 compiled
    // all five forms to establish that.
    //
    // What actually saves the component is the implementation: it destructures its six named
    // props and never spreads a rest object onto the DOM. That half was asserted by nothing,
    // and it is the half that holds — a future refactor to `{ tier, heading, ...rest }` would
    // reopen the passthrough with the type still reading `never`, and `H1_SPELLINGS` would
    // stop meaning anything the same day.
    // Spread with NO cast — the point is that this compiles, which is the hole itself.
    const smuggled: Record<string, unknown> = { className: "zz-evil", "data-evil": "zz-evil" };
    const html = renderToStaticMarkup(<PageHero tier="hub" heading="x" lede="y" {...smuggled} />);
    expect(html).not.toContain("zz-evil");
    expect(html).toContain('class="relative z-10 max-w-3xl space-y-4"');
  });

  it("forces no client boundary on its consumers", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(fileURLToPath(new URL("./page-hero.tsx", import.meta.url)), "utf8");
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    // 17 heroes sit at the top of Server Components that fetch. A hero that pulled them over
    // the boundary would be adopted by nobody.
    expect(source).not.toContain("useState");
  });
});
