import { describe, expect, it } from "vitest";
import { faqPageJsonLd, type FaqEntry, learningResourceJsonLd } from "./json-ld";
import { absoluteUrl } from "./site";

/**
 * Shape guards for the two JSON-LD builders the game shell added (PR #26 review).
 *
 * These pin schema.org VOCABULARY, which is the one part of a structured-data builder
 * TypeScript cannot check: `JsonLdSchema` is an index-signature type, so a typo in a key
 * name (`acceptedAnwer`) or a dropped `"@type"` typechecks and builds cleanly, then ships
 * markup that validators silently drop. Nothing here asserts a geography fact — the
 * fixtures are synthetic strings and the expectations are structural (CONVENTIONS §2).
 */
describe("faqPageJsonLd", () => {
  const entries: FaqEntry[] = [
    { question: "Synthetic question one?", answer: "Synthetic answer one." },
    { question: "Synthetic question two?", answer: "Synthetic answer two." },
  ];

  it("emits the exact FAQPage/Question/Answer node shape", () => {
    expect(faqPageJsonLd(entries)).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Synthetic question one?",
          acceptedAnswer: { "@type": "Answer", text: "Synthetic answer one." },
        },
        {
          "@type": "Question",
          name: "Synthetic question two?",
          acceptedAnswer: { "@type": "Answer", text: "Synthetic answer two." },
        },
      ],
    });
  });

  it("carries the caller's question and answer text through unmodified", () => {
    // The visible <details> block and this markup are built from ONE array at the call
    // site; the builder must not reformat, trim or truncate, or the two representations
    // would stop matching character-for-character (SEO-POLICY §B5 5.7).
    expect(
      faqPageJsonLd([{ question: " Q with spaces ", answer: "A — with punctuation." }]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: " Q with spaces ",
          acceptedAnswer: { "@type": "Answer", text: "A — with punctuation." },
        },
      ],
    });
  });

  it("emits an empty mainEntity rather than a malformed node for no entries", () => {
    expect(faqPageJsonLd([])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [],
    });
  });
});

describe("learningResourceJsonLd", () => {
  it("emits the exact LearningResource field set, with an absolute url", () => {
    expect(
      learningResourceJsonLd({
        name: "Synthetic resource",
        description: "Synthetic description.",
        path: "/synthetic-path",
        locale: "tr",
        learningResourceType: "Game",
        teaches: "Synthetic subject",
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "LearningResource",
      name: "Synthetic resource",
      description: "Synthetic description.",
      url: absoluteUrl("/synthetic-path"),
      inLanguage: "tr",
      learningResourceType: "Game",
      teaches: "Synthetic subject",
      // A statement of fact about this platform (no paywall, no sign-up) — not a knob.
      isAccessibleForFree: true,
    });
  });

  it("declares the page's own locale in inLanguage", () => {
    const schema = learningResourceJsonLd({
      name: "Synthetic resource",
      description: "Synthetic description.",
      path: "/synthetic-path",
      locale: "en",
      learningResourceType: "Game",
      teaches: "Synthetic subject",
    });
    expect(schema.inLanguage).toBe("en");
  });
});
