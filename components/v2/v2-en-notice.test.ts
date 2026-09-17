import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EN_CONTENT_READY } from "@/lib/seo/indexing";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SOURCE = read("./v2-en-work-in-progress-notice.tsx");

/**
 * The seven V2 surfaces whose substance is hand-written Turkish. This list mirrors the V1
 * pages that already carry `EnWorkInProgressNotice`; it is the same promise, moved.
 */
const SURFACES = [
  "../../app/[locale]/v2/araclar/page.tsx",
  "../../app/[locale]/v2/araclar/alan-hesaplama/page.tsx",
  "../../app/[locale]/v2/araclar/koordinat-bulma/page.tsx",
  "../../app/[locale]/v2/araclar/mesafe-olcme/page.tsx",
  "../../app/[locale]/v2/deniz/page.tsx",
  "../../app/[locale]/v2/dunya/[slug]/page.tsx",
  "../../app/[locale]/v2/turkiye/[slug]/page.tsx",
] as const;

describe("V2 EN work-in-progress notice", () => {
  it("is gated on EN_CONTENT_READY, not only on the locale", () => {
    // Binding it to the flag that already decides EN indexability means the claim the page
    // makes to a reader and the claim it makes to a crawler cannot disagree.
    expect(SOURCE).toContain("EN_CONTENT_READY");
  });

  it("renders nothing for Turkish readers", () => {
    expect(SOURCE).toMatch(/locale !== "en"/);
  });

  it("does not interrupt assistive technology for a plain note", () => {
    // Nothing has gone wrong and nothing changed dynamically.
    expect(SOURCE).not.toMatch(/role="(?:alert|status)"/);
    expect(SOURCE).not.toContain("aria-live");
  });

  it.each(SURFACES)("%s renders it", (surface) => {
    expect(read(surface)).toContain("<V2EnWorkInProgressNotice locale={locale} />");
  });

  it("covers every surface the V1 notice covered, and no fewer", () => {
    // The V1 list is the specification. If a V1 page carries the notice and its V2
    // counterpart does not, the port lost a promise to the reader rather than moved it.
    const v1 = [
      "../../app/[locale]/araclar/page.tsx",
      "../../app/[locale]/araclar/alan-hesaplama/page.tsx",
      "../../app/[locale]/araclar/koordinat-bulma/page.tsx",
      "../../app/[locale]/araclar/mesafe-olcme/page.tsx",
      "../../app/[locale]/deniz/page.tsx",
      "../../app/[locale]/dunya/[slug]/page.tsx",
      "../../app/[locale]/turkiye/[slug]/page.tsx",
    ];
    for (const page of v1) {
      expect(read(page), `${page} lost its notice`).toContain("EnWorkInProgressNotice");
    }
    expect(SURFACES).toHaveLength(v1.length);
  });

  it("positive control — the flag import is real and currently false", () => {
    // If someone flips the flag, this test tells them to delete the notice rather than
    // leaving a now-lying banner on seven pages.
    expect(EN_CONTENT_READY).toBe(false);
  });
});
