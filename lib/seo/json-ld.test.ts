import { describe, expect, it, vi } from "vitest";
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

  it("omits isbn, numberOfPages and dateModified when the CALLER passes no value", () => {
    // Deliberately a statement about the builder, not about the api. `isbn13` and
    // `pageCount` are REQUIRED and non-nullable on `BookDetailDto`, so today no caller can
    // reach this branch through them — `dateModified` is the live case, since the contract
    // carries no `updatedAt` yet. The branch is still the right shape: §B5 5.8 bars emitting
    // a field with nothing behind it, and the builder must not become the place that
    // invents one when a future field arrives nullable.
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

  it("omits author entirely when the contract supplies an empty list", () => {
    // `authorNames: []` is a permitted contract state, and `author: []` would be a field
    // asserting nothing — the same §B5 5.8 defect as an invented value, pointing the other
    // way. The key must be absent, not empty.
    const schema = bookJsonLd({ ...book, authorNames: [] });
    expect(schema).not.toHaveProperty("author");
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
    embedUrl: "https://example.invalid/embed/syntheticId",
  };

  /**
   * The builder returns `null` when the thumbnail host fails its assertion, so every
   * field-level case below has to say which of the two outcomes it is asserting about.
   * Throwing here rather than asserting non-null inline keeps that failure legible: a case
   * that silently started returning `null` would otherwise fail on a property of `null`,
   * several lines from the cause.
   */
  function emitted(args: Parameters<typeof videoObjectJsonLd>[0]) {
    const schema = videoObjectJsonLd(args);
    if (schema === null) {
      throw new Error(`expected a VideoObject for provider-hosted ${args.thumbnailUrl}`);
    }
    return schema;
  }

  it("emits the exact VideoObject node shape", () => {
    expect(videoObjectJsonLd(video)).toEqual({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "Synthetic video title",
      thumbnailUrl: "https://i.ytimg.com/vi/syntheticId/hqdefault.jpg?sqp=abc&rs=def",
      uploadDate: "2026-01-02T03:04:05.000Z",
      duration: "PT6M8S",
      embedUrl: "https://example.invalid/embed/syntheticId",
    });
  });

  it("passes the provider's thumbnail address through byte for byte", () => {
    // Developer Policies III.E.5 bars replacing API Data with independently computed data:
    // the address is used as returned, never rebuilt from the video id. The query string
    // and host below exist to make any normalisation visible as a failure.
    const oddButValid = "https://i9.ytimg.com/vi_webp/x/maxresdefault.webp?v=1&sqp=-oaymwE%3D";
    expect(emitted({ ...video, thumbnailUrl: oddButValid }).thumbnailUrl).toBe(oddButValid);
  });

  it("emits the provider's raw ISO duration, not a re-derived one", () => {
    // The contract publishes the ISO string beside the parsed seconds because a parser
    // reading "PT6M8S" as 68 seconds passes every range check and is still wrong.
    expect(emitted({ ...video, duration: "PT1H2M3S" }).duration).toBe("PT1H2M3S");
  });

  it("always carries an embedUrl, passed through from the caller", () => {
    // A `VideoObject` with neither `contentUrl` nor `embedUrl` names no playable resource,
    // and on this surface there is no legitimate case for one: a block that cannot be
    // embedded emits no markup at all. The value is the caller's — the player host is W2's
    // decision, not this builder's.
    expect(emitted(video).embedUrl).toBe("https://example.invalid/embed/syntheticId");
  });

  // THE HOST ASSERTION (→ PR #61 review `SEC61-M3`). The address becomes markup AND, in W2,
  // an `<img src>` the reader's browser fetches before any click, so the builder refuses to
  // publish one it cannot vouch for. It ASSERTS rather than rewriting: rebuilding the URL
  // from the video id is what Developer Policies III.E.5 bars, so there is no repair — only
  // publish or do not.
  it.each([
    ["the canonical thumbnail host", "https://i.ytimg.com/vi/x/hqdefault.jpg"],
    ["a numbered thumbnail host", "https://i9.ytimg.com/vi_webp/x/maxresdefault.webp"],
    ["a youtube.com host", "https://www.youtube.com/vi/x/hqdefault.jpg"],
  ])("emits a VideoObject for %s", (_case, thumbnailUrl) => {
    expect(videoObjectJsonLd({ ...video, thumbnailUrl })).not.toBeNull();
  });

  it.each([
    // The two shapes a bare `includes("ytimg.com")` or a dot-less suffix would let through.
    ["a lookalike registrable domain", "https://evil-ytimg.com/vi/x/hqdefault.jpg"],
    ["the provider host as a left-hand label", "https://i.ytimg.com.attacker.test/x.jpg"],
    ["an unrelated host", "https://cdn.example.invalid/vi/x/hqdefault.jpg"],
    // http would be blocked as mixed content on an https page before anyone saw it.
    ["a plaintext scheme", "http://i.ytimg.com/vi/x/hqdefault.jpg"],
    ["a value that is not a URL at all", "hqdefault.jpg"],
    ["an empty string", ""],
    // THE ROW THAT PINS PARSE-OVER-STRING-MATCH (→ PR #62 review `TEST62-M6`). Everything
    // left of `@` is USERINFO, so this URL's host is `evil.test` — but the provider's own
    // hostname appears literally in the string, which is exactly what a check written with
    // `startsWith`/`includes` on the raw address would accept. The rows above catch a
    // dot-less suffix; only this one catches a reader who "simplified" the `new URL()` parse.
    ["the provider host as a userinfo segment", "https://i.ytimg.com@evil.test/vi/x/hq.jpg"],
  ])("emits nothing for %s, and says so", (_case, thumbnailUrl) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(videoObjectJsonLd({ ...video, thumbnailUrl })).toBeNull();
      // A silent `null` is indistinguishable from a video that simply has no snapshot, which
      // is the ordinary path — so the refusal has to be audible (the TEST61-M7 lesson).
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain(thumbnailUrl);
    } finally {
      warn.mockRestore();
    }
  });

  // WHAT THE TWO ABSENCE GUARDS BELOW DO AND DO NOT COVER. They assert over the object the
  // builder emits for a complete argument set, which is the whole of its behaviour only
  // because it has no parameter that could produce either key. They would NOT catch a
  // future `clips`/`description` argument that emits its field solely when supplied — the
  // person adding that argument is reopening a ruling, and these tests will not do it for
  // them. Kept because the cheap guard covers today's shape exactly.
  it("never emits description", () => {
    // Recommended by Google, not required — and this surface renders no visible per-video
    // summary, which makes it §B5 5.7's "structured data that is not on the page".
    // Through `emitted()` (→ PR #62 review `TEST62-M4`): `expect(null).not.toHaveProperty(…)`
    // passes, so a builder that started refusing every input would satisfy this assertion
    // while emitting no markup at all.
    expect(emitted(video)).not.toHaveProperty("description");
  });

  it("cannot be constructed without the provider snapshot's three fields", () => {
    // THE BUILDER'S STATED SAFETY PROPERTY, ASSERTED AT COMPILE TIME. Its docblock claims
    // that a `VideoObject` cannot be built when `youtube === null` without inventing data —
    // a claim about the TYPE, which no runtime assertion can reach. `@ts-expect-error` can:
    // the line below fails `tsc` (and therefore CI) the day any of the three provider
    // fields becomes optional, which is the change that would quietly turn the guarantee
    // into a comment.
    // @ts-expect-error — omitting thumbnailUrl/uploadDate/duration must not typecheck.
    const incomplete = () => videoObjectJsonLd({ name: "x", embedUrl: "y" });
    expect(incomplete).toBeTypeOf("function");
  });

  it("never emits hasPart/Clip", () => {
    // Ruled 2026-08-15 (web SPEC E4): Google's clip URL is the video URL plus a time QUERY
    // PARAMETER; our ruled deep link is a fragment, and query-parameter variants were
    // rejected under §B12 12.2.c. A `url` the page does not honour is a claim about a page
    // behaviour that does not exist. This assertion is what keeps it out.
    // `emitted()` for the same reason as the block above: `JSON.stringify(null)` is `"null"`,
    // which contains no "Clip" either (→ PR #62 review `TEST62-M4`).
    const schema = emitted(video);
    expect(schema).not.toHaveProperty("hasPart");
    expect(JSON.stringify(schema)).not.toContain("Clip");
  });
});
