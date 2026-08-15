import { describe, expect, it } from "vitest";
import {
  bookJsonLd,
  faqPageJsonLd,
  type FaqEntry,
  learningResourceJsonLd,
  videoObjectJsonLd,
} from "./json-ld";
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

/**
 * The book layer's two builders (W0). Same purpose as the blocks above — pin the
 * schema.org VOCABULARY that TypeScript cannot check, since `JsonLdSchema` is an
 * index-signature type and a mistyped key ships markup validators silently drop.
 *
 * Two of these blocks assert an ABSENCE rather than a shape, which is unusual enough to
 * state plainly: `description` and `Clip` are fields somebody could reasonably add in good
 * faith, and both are barred for reasons that live outside this file. A test is the only
 * form of that rule which survives a future contributor who has not read `SEO-POLICY.md`.
 */
describe("bookJsonLd", () => {
  const book = {
    name: "Synthetic Book",
    path: "/kitaplar/synthetic-book",
    inLanguage: "tr",
    authorNames: ["Synthetic Author One", "Synthetic Author Two"],
    publisherName: "Synthetic Publisher",
    isbn: "9780000000000",
    numberOfPages: 120,
  };

  it("emits the exact Book node shape §B5 5.2 names", () => {
    expect(bookJsonLd(book)).toEqual({
      "@context": "https://schema.org",
      "@type": "Book",
      name: "Synthetic Book",
      url: absoluteUrl("/kitaplar/synthetic-book"),
      inLanguage: "tr",
      author: [
        { "@type": "Person", name: "Synthetic Author One" },
        { "@type": "Person", name: "Synthetic Author Two" },
      ],
      publisher: { "@type": "Organization", name: "Synthetic Publisher" },
      isbn: "9780000000000",
      numberOfPages: 120,
    });
  });

  it("preserves the author order it was given", () => {
    // A credit order is published data. Sorting it as a tidy-up would rewrite it — and
    // the array's alphabetical order here is deliberately the REVERSE of the input, so a
    // sort would be visible rather than coincidentally identical.
    const schema = bookJsonLd({
      ...book,
      authorNames: ["Zeta Synthetic", "Alpha Synthetic"],
    });
    expect(schema.author).toEqual([
      { "@type": "Person", name: "Zeta Synthetic" },
      { "@type": "Person", name: "Alpha Synthetic" },
    ]);
  });

  it("omits isbn, numberOfPages and dateModified when the api has no value", () => {
    // §B5 5.8: a field the contract answers `null` for is left out, never filled in.
    const schema = bookJsonLd({
      name: book.name,
      path: book.path,
      inLanguage: book.inLanguage,
      authorNames: book.authorNames,
      publisherName: book.publisherName,
      isbn: null,
      numberOfPages: null,
    });
    expect(schema).not.toHaveProperty("isbn");
    expect(schema).not.toHaveProperty("numberOfPages");
    expect(schema).not.toHaveProperty("dateModified");
  });

  it("carries dateModified through when the api supplies updated_at", () => {
    const schema = bookJsonLd({ ...book, dateModified: "2026-01-02T03:04:05.000Z" });
    expect(schema.dateModified).toBe("2026-01-02T03:04:05.000Z");
  });

  it("never emits Product/offers or declares the videos as parts of the book", () => {
    // We publish a purchase link and no price, so a priceless `Offer` would be §B5 5.8's
    // invented field; and declaring the solution videos as parts of the printed book
    // asserts a relationship nobody established (misleading markup).
    const schema = bookJsonLd(book);
    expect(schema).not.toHaveProperty("offers");
    expect(schema).not.toHaveProperty("hasPart");
    expect(schema["@type"]).toBe("Book");
  });

  it("takes inLanguage from the caller rather than from a page locale", () => {
    // The field describes the WORK, and the contract carries no language column — so the
    // builder must not infer one. Passing a different value must change the output.
    expect(bookJsonLd({ ...book, inLanguage: "de" }).inLanguage).toBe("de");
  });
});

describe("videoObjectJsonLd", () => {
  const video = {
    name: "Synthetic video title",
    thumbnailUrl: "https://i.ytimg.com/vi/syntheticId/hqdefault.jpg?sqp=abc&rs=def",
    uploadDate: "2026-01-02T03:04:05.000Z",
    duration: "PT6M8S",
  };

  it("emits the exact VideoObject node shape", () => {
    expect(videoObjectJsonLd(video)).toEqual({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "Synthetic video title",
      thumbnailUrl: "https://i.ytimg.com/vi/syntheticId/hqdefault.jpg?sqp=abc&rs=def",
      uploadDate: "2026-01-02T03:04:05.000Z",
      duration: "PT6M8S",
    });
  });

  it("passes the provider's thumbnail address through byte for byte", () => {
    // Developer Policies III.E.5 bars replacing API Data with independently computed data:
    // the address is used as returned, never rebuilt from the video id. The query string
    // and host below exist to make any normalisation visible as a failure.
    const oddButValid = "https://i9.ytimg.com/vi_webp/x/maxresdefault.webp?v=1&sqp=-oaymwE%3D";
    const schema = videoObjectJsonLd({ ...video, thumbnailUrl: oddButValid });
    expect(schema.thumbnailUrl).toBe(oddButValid);
  });

  it("emits the provider's raw ISO duration, not a re-derived one", () => {
    // The contract publishes the ISO string beside the parsed seconds because a parser
    // reading "PT6M8S" as 68 seconds passes every range check and is still wrong.
    expect(videoObjectJsonLd({ ...video, duration: "PT1H2M3S" }).duration).toBe("PT1H2M3S");
  });

  it("emits embedUrl only when the caller supplies one", () => {
    expect(videoObjectJsonLd(video)).not.toHaveProperty("embedUrl");
    expect(
      videoObjectJsonLd({ ...video, embedUrl: "https://example.invalid/embed/syntheticId" })
        .embedUrl,
    ).toBe("https://example.invalid/embed/syntheticId");
  });

  it("never emits description", () => {
    // Recommended by Google, not required — and this surface renders no visible per-video
    // summary, which makes it §B5 5.7's "structured data that is not on the page".
    expect(videoObjectJsonLd(video)).not.toHaveProperty("description");
  });

  it("never emits hasPart/Clip", () => {
    // Ruled 2026-08-15 (web SPEC E4): Google's clip URL is the video URL plus a time QUERY
    // PARAMETER; our ruled deep link is a fragment, and query-parameter variants were
    // rejected under §B12 12.2.c. A `url` the page does not honour is a claim about a page
    // behaviour that does not exist. This assertion is what keeps it out.
    const schema = videoObjectJsonLd(video);
    expect(schema).not.toHaveProperty("hasPart");
    expect(JSON.stringify(schema)).not.toContain("Clip");
  });
});
