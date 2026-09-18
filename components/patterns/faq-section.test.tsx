import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaqSection } from "./faq-section";

const ITEMS = [
  { question: "Soru bir?", answer: "Cevap bir." },
  { question: "Soru iki?", answer: "Cevap iki." },
] as const;

const MECHANISMS = ["list", "accordion"] as const;

describe("FaqSection", () => {
  it("gives every question a heading, in both mechanisms", () => {
    for (const mechanism of MECHANISMS) {
      const html = renderToStaticMarkup(
        <FaqSection heading="SSS" items={ITEMS} mechanism={mechanism} locale="tr" />,
      );
      expect(html.match(/<h3/g), mechanism).toHaveLength(2);
    }
  });

  it("names the section for assistive technology and owns its anchor", () => {
    const html = renderToStaticMarkup(<FaqSection heading="SSS" items={ITEMS} locale="tr" />);
    expect(html).toContain('id="sss"');
    expect(html).toContain("aria-labelledby");
    expect(html).toContain("scroll-mt-28");
  });

  it("renders no structured data unless asked", () => {
    const html = renderToStaticMarkup(<FaqSection heading="SSS" items={ITEMS} locale="tr" />);
    expect(html).not.toContain("application/ld+json");
  });

  /**
   * The whole point of the component, so it is asserted on BOTH mechanisms and on BOTH halves of
   * every entry.
   *
   * The answer matters more than the question here. Google's FAQPage rule — and
   * `lib/seo/json-ld.tsx`'s own docblock on `faqPageJsonLd` — is that the marked-up text must be
   * VISIBLE on the page, and the accordion is exactly where that quietly stopped being true: the
   * accordion primitive this component renders through used to drop a closed panel from the DOM,
   * so `/deniz` could have shipped seven answers to a crawler and none to the document. See
   * `components/ui/accordion.test.tsx`, which pins the other end of that guarantee.
   */
  it("renders every item it puts in the structured data, in both mechanisms", () => {
    for (const mechanism of MECHANISMS) {
      const html = renderToStaticMarkup(
        <FaqSection
          heading="SSS"
          items={ITEMS}
          mechanism={mechanism}
          structuredData="localized"
          locale="tr"
        />,
      );
      // `[\s\S]` rather than `.` under the `s` flag: `tsconfig.json` targets below es2018, where
      // `tsc` rejects the flag outright (TS1501). The brief's draft of this test carried `/s`.
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
      expect(ld, mechanism).not.toBe("");
      for (const item of ITEMS) {
        expect(ld, mechanism).toContain(item.question);
        expect(ld, mechanism).toContain(item.answer);
        expect(html, mechanism).toContain(item.question);
        expect(html, mechanism).toContain(item.answer);
      }
    }
  });

  /**
   * Ruling BU: the gate is `isIndexable(locale, surface)`, computed — never a boolean the caller
   * remembers to pass. `components/patterns/breadcrumbs.tsx` carries the same gate for the same
   * reason: a per-page flag is precisely what left 24 pages showing a trail to a reader and
   * nothing to a crawler.
   */
  it("emits no structured data for a locale the surface is not indexable in", () => {
    const html = renderToStaticMarkup(
      <FaqSection heading="FAQ" items={ITEMS} structuredData="trOnly" locale="en" />,
    );
    expect(html).not.toContain("application/ld+json");
    // The MARKUP is still there — the gate withholds the schema, never the content.
    expect(html).toContain(ITEMS[0].answer);
  });

  it("emits no structured data on a noindex surface, in the default locale either", () => {
    const html = renderToStaticMarkup(
      <FaqSection heading="SSS" items={ITEMS} structuredData="noindex" locale="tr" />,
    );
    expect(html).not.toContain("application/ld+json");
  });

  it("renders nothing at all for an empty list", () => {
    expect(renderToStaticMarkup(<FaqSection heading="SSS" items={[]} locale="tr" />)).toBe("");
  });

  it("takes the anchor and the heading id from `id`", () => {
    const html = renderToStaticMarkup(
      <FaqSection id="deniz-sss" heading="SSS" items={ITEMS} locale="tr" />,
    );
    expect(html).toContain('id="deniz-sss"');
    expect(html).toContain('aria-labelledby="deniz-sss-baslik"');
    expect(html).toContain('id="deniz-sss-baslik"');
  });

  /**
   * The RUNTIME half of `className?: never`. PR4 measured that the type alone is defeated
   * silently by a `Record<string, unknown>` spread, which is not an exotic shape — see
   * `components/patterns/page-hero.test.tsx`, where the same hole is pinned. `class` is smuggled
   * alongside `className` because a strip-list that enumerates only the React spelling leaves the
   * DOM one open, and JSX passes `class` through untouched.
   */
  it("drops a className smuggled past the type by a Record spread", () => {
    const smuggled: Record<string, unknown> = {
      className: "zz-evil",
      class: "zz-evil",
      "data-evil": "zz-evil",
    };
    for (const mechanism of MECHANISMS) {
      const html = renderToStaticMarkup(
        <FaqSection heading="SSS" items={ITEMS} mechanism={mechanism} locale="tr" {...smuggled} />,
      );
      expect(html, mechanism).not.toContain("zz-evil");
    }
  });

  it("forces no client boundary on its consumers, and cannot be rendered from one", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      fileURLToPath(new URL("./faq-section.tsx", import.meta.url)),
      "utf8",
    );
    // It imports `lib/seo/json-ld` (`server-only`), so a `"use client"` here would break
    // `pnpm build` for every consumer — `components/patterns/rsc-boundary.test.ts` is the
    // whole-tree form of this check; this is the local one, on the file that must never grow one.
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
  });
});
