import type { BookDetail, BookList } from "@/lib/api/types";

/**
 * Synthetic book payloads for the `lib/api/books` unit tests.
 *
 * WHY A FIXTURE AT ALL. `/api/books` and `/api/books/{slug}` are not served yet (the api's
 * B3 opens them), so there is no live response to test against. What CAN be pinned today
 * is the contract shape — and these constants pin it in the strongest way available.
 *
 * THE TYPING IS AN ANNOTATION, NOT AN `as` CAST, AND THAT IS THE POINT. Each constant is
 * declared `const x: BookList = {…}`, so the compiler performs a full assignability check:
 * a missing required field, a wrong type, or an `examTrack` value outside the contract's
 * closed enum is a `tsc` error. A cast (`{…} as BookList`, the older marine-fixture
 * pattern) permits all three — an assertion only requires the two types to overlap, so a
 * fixture that had drifted away from the schema would still compile and would advertise a
 * guard it did not provide. `pnpm codegen` regenerates the types from the committed spec,
 * which makes `tsc` the drift alarm on these files.
 *
 * THE VALUES ARE SYNTHETIC ON PURPOSE (`CONVENTIONS.md` §2 — tests assert structure, never
 * facts). No real title, ISBN, author, publisher or coverage number appears here. Beyond
 * the standing rule there is a specific reason: `FENER109-I1` measured the near-duplicate
 * metadata collapse on the api side *inside that PR's own test fixture*, where real
 * editorial strings made a corpus-level signal look like ordinary test data.
 *
 * COVERAGE THE TESTS DEPEND ON:
 *   · two pages, so the `hasMore` transition is genuinely traversed rather than assumed;
 *   · a detail payload carrying BOTH `youtube: null` (today's normal path) and a populated
 *     `youtube` block (the enriched path a later api leg opens), so the two branches of the
 *     structured-data rule each have a payload to be built against;
 *   · **at least one book whose `slugEn` DIFFERS from its `slugTr`**, and at least one where
 *     they match. Today's real book carries the same string in both — a product name is not
 *     translated — and that is a fact about the DATA which the fixture must not reproduce as
 *     its only case. With identical strings everywhere, a consumer that returned `slugTr`
 *     for both locales would produce byte-identical output on every fixture and pass, while
 *     deriving one locale's slug from the other is a `SEO-POLICY.md` §B4 4.5 BLOCKER. The
 *     repo already makes this exact move for routes: `lib/seo/routes.fixture.ts` uses
 *     `fixture-province-${locale}` for the same reason.
 */

/** Page 1 of 2 — `hasMore: true`, so the loop must ask for a second page. */
export const BOOK_LIST_PAGE_1: BookList = {
  page: 1,
  pageSize: 100,
  total: 3,
  hasMore: true,
  items: [
    {
      slugTr: "fixture-book-one",
      // Deliberately DIFFERENT from `slugTr` — see the coverage note above.
      slugEn: "fixture-book-one-en",
      titleTr: "Fixture Book One",
      publisherName: "Fixture Publisher",
      examTrack: "AYT",
      coverImagePath: "/kitaplar/fixture-book-one.webp",
      videoCount: 2,
      questionCount: 4,
      displayOrder: 1,
      updatedAt: "2026-01-02T03:04:05.000Z",
    },
    {
      slugTr: "fixture-book-two",
      // Deliberately the SAME as `slugTr` — the state today's real book is in.
      slugEn: "fixture-book-two",
      titleTr: "Fixture Book Two",
      publisherName: "Fixture Publisher",
      examTrack: "TYT",
      // `null` is a contract state, not a gap: a book with no cover renders no image.
      coverImagePath: null,
      videoCount: 0,
      questionCount: 0,
      displayOrder: 2,
      updatedAt: "2026-01-03T03:04:05.000Z",
    },
  ],
};

/** Page 2 of 2 — `hasMore: false` ends the loop. */
export const BOOK_LIST_PAGE_2: BookList = {
  page: 2,
  pageSize: 100,
  total: 3,
  hasMore: false,
  items: [
    {
      slugTr: "fixture-book-three",
      slugEn: "fixture-book-three",
      titleTr: "Fixture Book Three",
      publisherName: "Fixture Publisher",
      examTrack: "KPSS",
      coverImagePath: "/kitaplar/fixture-book-three.webp",
      videoCount: 1,
      questionCount: 2,
      displayOrder: 3,
      updatedAt: "2026-01-04T03:04:05.000Z",
    },
  ],
};

/**
 * One book's detail payload.
 *
 * The two videos are deliberately asymmetric: the first carries a populated `youtube`
 * block, the second carries `null`. Both are normal contract states and the page treats
 * them differently, so a fixture with only one of them would leave half the rule untested.
 */
export const BOOK_DETAIL: BookDetail = {
  slugTr: "fixture-book-one",
  // Differs from `slugTr`, matching this book's list entry — see the coverage note above.
  slugEn: "fixture-book-one-en",
  titleTr: "Fixture Book One",
  titleEn: null,
  publisherName: "Fixture Publisher",
  examTrack: "AYT",
  coverImagePath: "/kitaplar/fixture-book-one.webp",
  videoCount: 2,
  questionCount: 4,
  displayOrder: 1,
  // Required since the api opened its read side; it feeds the sitemap's `lastmod` and
  // `Book.dateModified`, so a fixture without it would let a consumer forget both.
  updatedAt: "2026-01-02T03:04:05.000Z",
  authorNames: ["Fixture Author Alpha", "Fixture Author Beta"],
  isbn13: "9780000000000",
  pageCount: 120,
  denemeCount: 4,
  introTr: "Fixture narrative paragraph one.\n\nFixture narrative paragraph two.",
  introEn: null,
  metaTitleTr: "Fixture Book One meta title",
  metaDescriptionTr: "Fixture Book One meta description carrying a synthetic figure: 4.",
  youtubeChannelId: "UCfixturechannelid00000",
  youtubePlaylistId: null,
  purchaseUrl: "https://example.invalid/fixture-book-one",
  coverage: {
    videoCount: 2,
    questionCount: 4,
    denemeNumbers: [1, 3],
    denemeCount: 4,
  },
  videos: [
    {
      denemeNo: 1,
      youtubeVideoId: "fixtureVid1",
      questions: [
        // `startSecond: 0` is an ordinary value, never a sentinel (contract note).
        { questionNo: 1, startSecond: 0 },
        { questionNo: 2, startSecond: 94 },
      ],
      youtube: {
        thumbnailUrl: "https://i.ytimg.com/vi/fixtureVid1/hqdefault.jpg?sqp=fixture&rs=fixture",
        thumbnailWidth: 480,
        thumbnailHeight: 360,
        publishedAtUtc: "2026-01-02T03:04:05.000Z",
        durationIso: "PT6M8S",
        durationSeconds: 368,
        embeddable: true,
        dataFetchedAtUtc: "2026-01-09T00:00:00.000Z",
      },
    },
    {
      denemeNo: 3,
      youtubeVideoId: "fixtureVid3",
      questions: [
        { questionNo: 1, startSecond: 11 },
        { questionNo: 2, startSecond: 205 },
      ],
      // The normal path today: no provider snapshot, so no VideoObject may be emitted.
      youtube: null,
    },
  ],
  attribution: [
    {
      providerId: "youtube",
      providerName: "Fixture Provider",
      requiredNoticeTr: "Fixture required notice.",
      licenceUrl: null,
      channelUrl: "https://example.invalid/fixture-channel",
    },
    {
      providerId: "partner",
      providerName: "Fixture Partner",
      requiredNoticeTr: "Fixture partner notice.",
      licenceUrl: null,
      channelUrl: null,
    },
  ],
};
