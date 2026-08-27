import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import type { BenchVideo } from "@/components/book/bench-stage";
import { DenemeMeta } from "@/components/book/deneme-meta";
import { VideoBench } from "@/components/book/video-bench";
import { ProseNote } from "@/components/prose-note";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getBookBySlug, getBooksResilient } from "@/lib/api/books";
import { formatDuration } from "@/lib/book/duration";
import { PUBLISHED_DATE_FORMAT } from "@/lib/book/published-date";
import { denemeFragment, questionFragment, videoTitle } from "@/lib/book/video-identity";
import { isPlayable, resolveVideoState } from "@/lib/book/video-state";
import type { BookDetail, BookListItem } from "@/lib/api/types";
import { canonicalEmbedUrl } from "@/lib/youtube/embed";
import { bookJsonLd, JsonLd, videoObjectJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./book-detail.module.css";

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

/**
 * The book's own language, handed to `Book.inLanguage`.
 *
 * A CONSTANT AND NOT THE PAGE LOCALE, deliberately. On a `CreativeWork` that field describes
 * the WORK, not the chrome around it — the English page still describes a Turkish book. The
 * contract carries no language column, so the value is stated here rather than invented from
 * data that does not exist; it is also why `titleEn` is `null`.
 */
const BOOK_LANGUAGE = "tr";

/** The localized slug (`slugTr` for tr, `slugEn` for en) — two columns, never one derived
 *  from the other (`SEO-POLICY.md` §B4 4.5, BLOCKER). */
function slugForLocale(book: BookDetail | BookListItem, locale: Locale): string {
  return locale === "en" ? book.slugEn : book.slugTr;
}

/* THE TWO FRAGMENT BUILDERS AND THE TITLE BUILDER MOVED TO `lib/book/video-identity.ts`, and the
   move is the whole of this PR's answer to `DEC 2026-08-17i`. They were the only three places
   this page assumed a deneme book — how a video is NAMED and how it is ADDRESSED — and they now
   sit in one module with the timeline and the structured data importing the same functions. When
   the api grows a per-video display title (`FU-BOOK-GENERIC-CONTRACT`), one function learns it. */

/**
 * SSG the books that exist; anything else falls through to `notFound()` (`ENGINEERING.md`
 * §4 #6 — a real 404, never a soft 200).
 *
 * Build-safe: if the api is unreachable during `next build` the list degrades to empty and
 * the pages render on demand through ISR at runtime, the same contract the province and
 * country routes carry.
 */
export async function generateStaticParams() {
  const books = await getBooksResilient();
  return routing.locales.flatMap((locale) =>
    books.map((book) => ({ locale, slug: slugForLocale(book, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = await getBookBySlug(slug);
  // Unknown slug → the page component calls `notFound()`; Next then resolves the title from
  // the not-found boundary, so anything returned here is discarded (see `not-found.tsx`).
  if (!book) return {};

  return buildMetadata({
    locale,
    // Localized-slug alternates: `slugTr` for tr, `slugEn` for en.
    hrefForLocale: (l) => ({
      pathname: "/kitaplar/[slug]",
      params: { slug: slugForLocale(book, l) },
    }),
    // HAND-WRITTEN, FROM THE API, THROUGH THE HELPER. `metaTitleTr`/`metaDescriptionTr` are
    // authored per book (`SEO-POLICY.md` A1/A2) rather than composed from a web-side pattern
    // — four books can be written by hand where 81 provinces could not — and they still go
    // through `buildMetadata`, which is what keeps canonical, hreflang, `og:*` and the robots
    // rule on one code path (§B2 2.5 BLOCKER: bypassing the helper dissolves the SEO surface).
    // Both are Turkish on BOTH locales: `titleEn`/`introEn` are `null` by contract and the EN
    // page carries no machine translation (§B14 14.2), which is also why it is `noindex`.
    title: book.metaTitleTr,
    description: book.metaDescriptionTr,
    openGraphType: "article",
    // Permanently single-locale (→ DEC 2026-08-15c; `lib/seo/indexing.ts`): the English twin
    // stays out of the index even after `EN_CONTENT_READY` flips.
    surface: "trOnly",
  });
}

/**
 * `/kitaplar/{slug}` — one book, its künye, and the question index of its video solutions.
 *
 * ## The 180 rows are the page, and that is a structural decision rather than a layout one
 *
 * Every deneme block and every question row is server-rendered as a real `<a href>` to an
 * in-page fragment, so the whole index is readable and clickable with JavaScript disabled
 * (`SEO-POLICY.md` §B8 8.2 BLOCKER + §B12 12.2.b BLOCKER). A page whose body exists only to
 * send the visitor somewhere else is what the doorway policy describes; the index is what
 * keeps this page on the right side of that line, and it is why the rows are HTML the first
 * response carries rather than something a player renders later.
 *
 * ## The index is a WORKBENCH now, and the accordion is gone
 *
 * One stage holds the page's only player; the thirty rows sit beside it with all six questions
 * already open. Pressing a question moves the stage, not the page — which is the whole of the
 * change: a reader working from deneme 3 to deneme 31 no longer loses the video, and reaching
 * "deneme 24, question 3" costs one press instead of three (jump → open → press).
 *
 * **Removing the accordion costs the index nothing, and that is checkable rather than argued.**
 * The collapsed panel was server markup that was merely hidden, so all 180 `<a href>` were always
 * in the first response; they still are, now visible. What the accordion bought was page length,
 * and both ends of that trade are measured at ONE viewport so they can be read against each
 * other: at 320px in Turkish the accordion page was **4,894px** and this one is **8,241px**,
 * against ~20,000px for thirty flat blocks. The bench pays the difference back a different way:
 * the six question cells are laid out as a compact grid rather than one full-width row each, and
 * the thirty per-block player boxes collapse into one stage. Both figures come from the sample
 * gate's own JSON — `kareler-d1/once/olcum-before.json` and
 * `kareler-d1/sonra-fix/olcum-sonra-fix.json`, key `tr-320` — and the sentence names which build
 * each belongs to because the first draft said "this build" for the accordion's number while
 * sitting in the bench's file, which reads as a measurement of the page you are looking at
 * (→ PR #70 review `FENER70-M3`).
 *
 * The one property the accordion had that this does not is that a closed row is a smaller target
 * surface for a reader who wants only the list. That is a real loss and it is the price of the
 * one-press promise, taken knowingly (→ AK-23).
 *
 * The fragments (`#deneme-12`, `#deneme-12-soru-3`) are part of the IA (`SEO-POLICY.md`
 * §B4's book row) and deliberately NOT routes: a page per deneme or per question would be
 * 30 and 180 near-identical thin pages, which is §B12 12.1's shape exactly. Each target
 * carries `scroll-margin-top` so a followed fragment lands below the sticky header at every
 * viewport, 320px included (§B4 4.9).
 *
 * ## The player is an addition to this index, never a replacement for it
 *
 * The workbench is wrapped by ONE client island that delegates a single listener over the stage
 * and all thirty rows; the rows themselves are untouched server markup and still resolve with
 * JavaScript off. The player arrives only on a click or a key press, only on the stage, and only
 * one at a time — so the first response still carries no iframe at all.
 *
 * The provider snapshot (`videos[].youtube`) is now POPULATED on the normal path — the sync leg
 * ran on 2026-08-17 and all thirty blocks resolve to `rich`, with a real thumbnail, duration and
 * publication date (this paragraph said the opposite while the snapshots were still null; it is
 * corrected here rather than left to rot, because the rule below now actually fires). The markup
 * rule is a chain (§B5 5.7): `uploadDate`/`duration` may only be emitted where the page SHOWS
 * them, and a `VideoObject` only where the video can actually be watched.
 *
 * THAT CHAIN IS WHY THE VIDEO KÜNYE SITS ON THE ROW HEAD. It used to sit in the `<summary>`
 * because that was the part visible while the panel was closed; nothing is closed now, so the
 * pair simply sits on the row — thirty visible pairs for thirty `VideoObject` blocks, in the
 * first response, with no press required. The stage caption shows the SELECTED video's pair too,
 * but the stage shows one video at a time and its selection is client state, so it can never be
 * what discharges the chain for the other twenty-nine (→ AK-23, Q4).
 * `lib/book/video-state.ts` is still the single place that decides which of the three states a
 * video is in, so the visible facts and the structured data cannot drift apart.
 */
export default async function BookDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  if (!book) {
    notFound();
  }

  const t = await getTranslations("BookDetail");
  const tb = await getTranslations("Breadcrumb");
  const format = await getFormatter();

  const title = book.titleTr;
  const selfHref = {
    pathname: "/kitaplar/[slug]",
    params: { slug: slugForLocale(book, locale) },
  } as const;
  const path = getPathname({ locale, href: selfHref });

  // The editorial narrative is Turkish and has no English counterpart (`introEn` is `null`
  // by contract). The EN page therefore carries NO narrative rather than a translated one —
  // §B14 14.2's own instruction, and the reason this surface is `"trOnly"` rather than
  // `"trNarrative"`: no English text is coming later either.
  const introText = locale === "tr" ? book.introTr : null;

  // Each block's facade state, resolved ONCE and read by three places: the visible cover, the
  // künye row, and the structured data. One resolution is what keeps them from disagreeing.
  const videoStates = book.videos.map((video) => ({ video, state: resolveVideoState(video) }));

  /* The jump strip's two inputs, and they are DIFFERENT FACTS rather than one derived from the
     other. `denemeCount` is how many denemeler the BOOK has (a künye fact); `denemeNumbers` is
     exactly which of them have an indexed solution. The api publishes the set on purpose —
     "Ranges for display are the web layer's to derive; the api publishes the set, never a
     formatted string" — because the covered numbers are not a contiguous range: today they are
     1–13, 15–21, 23, 24 and 33–40. A strip built from the count alone, or from
     `min…max` of the set, would link ten fragments that do not exist (§B8 8.9, BLOCKER).
     A `Set` rather than `.includes()` in the loop: 40 iterations over a 30-element array is
     nothing, but the lookup states the intent.

     THE COVERED SET IS DERIVED FROM THE BLOCKS THAT ACTUALLY RENDER, not from
     `coverage.denemeNumbers`. Both fields describe the same thing and are set-equal on today's
     live data (measured: both `[1..13, 15..21, 23, 24, 33..40]`), but they are two independent
     contract fields, and only one of them is the source of the `id`s these links point at. A
     `denemeNumbers` entry with no row in `videos[]` would render `<a href="#deneme-25">` with no
     target — a broken in-page anchor, which §B8 8.9 rates BLOCKER — and it would ship green,
     because typecheck, lint and the structure test all still pass and the dead tile looks
     exactly like a working one. Deriving from `videoStates` makes "every jump href has a
     target" true by construction rather than by the two projections agreeing (→ PR #66 review
     `FENER66-M2` (validated) / `CODE66-M8` / `TA66-M3`). `coverage.denemeNumbers` stays what it
     reads as: a künye fact. This is the same discipline `resolveVideoState` already applies one
     level down — resolve once, so two consumers cannot drift. */
  const jumpNumbers = Array.from({ length: book.coverage.denemeCount }, (_, index) => index + 1);
  const coveredDenemeNumbers = new Set(videoStates.map(({ video }) => video.denemeNo));

  /* THE STAGE'S PAYLOAD — the only thing on this page that crosses into the client bundle.
     Built from the SAME `videoStates` the index rows render from, so the stage and the rows can
     never describe different videos.

     THREE THINGS ARE DELIBERATELY ABSENT and their absence is what keeps this small. No copy:
     every reader-facing string on the stage is resolved from the catalogue inside the client
     component, not shipped thirty times. No derived values: `formatDuration` is pure and runs
     there. No state machine: `resolveVideoState`'s discriminated union stays on the server and
     what crosses is its ANSWER (`rich`, `playable`), so `lib/book/video-state.ts` remains the
     single place those three states are decided.

     ONE FIELD IS PRE-FORMATTED AND IT IS THE EXCEPTION THAT NAMES THE RULE. `publishedText` is
     built here, with `getFormatter`, because `i18n/request.ts` pins `timeZone: "UTC"` for the
     whole project — "the same build prints a different DAY depending on which machine rendered
     it" — and formatting the date in the browser would make that guarantee depend on the
     provider inheriting the request config into the client. It is also the same call
     `DenemeMeta` makes for the row — and since PR #70's review the two share their options object
     (`lib/book/published-date.ts`) rather than each writing `dateStyle` out, so "they cannot
     disagree about the day" is structural rather than a convention (→ `TA70-M7`).

     Measured payload (live data, 30 videos): see the closing summary's size table. */
  const benchVideos: BenchVideo[] = videoStates.map(({ video, state }) => ({
    denemeNo: video.denemeNo,
    bookVideoId: video.bookVideoId,
    videoId: video.youtubeVideoId,
    playable: isPlayable(state),
    questions: video.questions.map((question) => ({
      no: question.questionNo,
      second: question.startSecond,
    })),
    rich:
      state.kind === "rich"
        ? {
            thumbnailUrl: state.youtube.thumbnailUrl,
            thumbnailWidth: state.youtube.thumbnailWidth,
            thumbnailHeight: state.youtube.thumbnailHeight,
            durationIso: state.youtube.durationIso,
            durationSeconds: state.youtube.durationSeconds,
            publishedAtUtc: state.youtube.publishedAtUtc,
            publishedText: format.dateTime(
              new Date(state.youtube.publishedAtUtc),
              PUBLISHED_DATE_FORMAT,
            ),
          }
        : null,
  }));

  /* WHICH VIDEO THE STAGE OPENS ON, and it is derived from the blocks that actually render —
     never from `coverage.denemeNumbers`. Both fields describe the same thing and are set-equal on
     today's data, but only one of them is the source of the markup the stage's `data-deneme` has
     to match, and a default naming a video with no row would put the stage and the index on
     different videos at first paint (the `FENER66-M2` discipline, applied to the new surface).
     The array is the contract's own order, so this is the book's first covered deneme. */
  const defaultDenemeNo = benchVideos[0]?.denemeNo ?? null;

  // Which credit rows this page owes — selected by the contract's own machine token, never by
  // matching the notice text, and never re-ordered (see the source statement's comment below).
  const attributionRows = book.attribution.filter(
    (row) => row.providerId !== "youtube" || book.videos.length > 0,
  );

  // `VideoObject` for every block a reader can actually watch here, and for no other. The
  // filter is the state machine's own answer rather than a condition repeated at this site —
  // `youtube === null` and `embeddable === false` both resolve away from "rich", and the
  // builder additionally refuses a thumbnail that is not on a provider host (→ PR #61 review
  // SEC61-M3), returning `null` rather than markup.
  //
  // `name` is composed from two strings this page already prints verbatim — the `<h1>` title
  // and the block's own `<h3>` — so §B5 5.7 ("no data in the markup that is not on the page")
  // is satisfied by construction while the search result still says which book it belongs to.
  //
  // Emitted on the English page too, from this same path. That page is permanently `noindex`,
  // so the markup is inert there; a second code path to suppress it would be more surface for
  // the same outcome (Atlas ruling AK-12/E-W2-6).
  const videoSchemas = videoStates.flatMap(({ video, state }) => {
    if (state.kind !== "rich") return [];
    const schema = videoObjectJsonLd({
      // THROUGH THE SHARED BUILDER, not a second composition of the same string: this must be
      // byte-identical to the `<h3>` the row prints, or §B5 5.7 has markup naming something the
      // page does not show. `lib/book/video-identity.ts` is the one place that decides it.
      name: `${title} — ${videoTitle(t, video)}`,
      thumbnailUrl: state.youtube.thumbnailUrl,
      uploadDate: state.youtube.publishedAtUtc,
      // The provider's RAW ISO string, never re-derived from the parsed seconds: the contract
      // publishes both precisely because "PT6M8S" read as 68 seconds passes every range check.
      duration: state.youtube.durationIso,
      embedUrl: canonicalEmbedUrl(video.youtubeVideoId),
    });
    return schema === null ? [] : [schema];
  });

  return (
    <div className="container page">
      <JsonLd
        schema={bookJsonLd({
          name: title,
          path,
          inLanguage: BOOK_LANGUAGE,
          // Published credit order, iterated as given and never sorted — re-ordering a credit
          // rewrites it (`cografya_api` seed: "Published credit order — never sorted").
          authorNames: book.authorNames,
          publisherName: book.publisherName,
          isbn: book.isbn13,
          numberOfPages: book.pageCount,
          dateModified: book.updatedAt,
        })}
      />
      {/* One `<script>` carrying the array, rather than one per block: a top-level array is
          valid JSON-LD and Google reads it, and 30 separate elements would say the same thing
          in 30 times the markup. Emitted only when the array is non-empty; on today's data all
          thirty snapshots resolve to `rich`, so it carries thirty nodes. (This sentence said the
          opposite — "today it is empty, because every snapshot is `null`" — while the docblock
          above had already been corrected, leaving the file contradicting itself about the one
          fact the `VideoObject` chain turns on; → PR #66 review `FENER66-M3` / `CODE66-M2`.) */}
      {videoSchemas.length > 0 && <JsonLd schema={videoSchemas} />}
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("kitaplar"), href: "/kitaplar" },
          { label: title, href: selfHref },
        ]}
      />
      <h1>{title}</h1>

      <div className={styles.intro}>
        {/* OUR OWN file in `public/kitaplar/`, so it goes through `next/image`
            (`ENGINEERING.md` §4 #9 — "always", and the second exception says in as many words
            that it does not reach these covers). `fill` inside a fixed-size box because the
            contract publishes a path and no dimensions; the box holds CLS at 0 whatever the
            cover's proportions turn out to be.

            `priority`: this is the largest element above the fold, i.e. the LCP candidate, and
            §4 #9's own `loading="lazy"` carve-out says the same thing from the other side —
            deferring the LCP image delays the metric the budget exists to protect.

            `null` is a normal contract state and renders NOTHING — no frame, no placeholder,
            no "cover coming soon". */}
        {book.coverImagePath !== null && (
          <div className={styles.coverBox}>
            <Image
              src={book.coverImagePath}
              alt={t("coverAlt", { title })}
              fill
              sizes="(max-width: 40rem) 40vw, 180px"
              className={styles.coverImage}
              priority
            />
          </div>
        )}

        <div className={styles.introBody}>
          {introText !== null && <ProseNote text={introText} className={styles.prose} />}
          <p className={styles.badges}>
            <span className="chip">{t("badgeVideos", { count: book.coverage.videoCount })}</span>
            <span className="chip">
              {t("badgeQuestions", { count: book.coverage.questionCount })}
            </span>
          </p>
          {/* Outbound seller link, and a PLAIN one: the owner ruled it is not an affiliate
              or commission link (→ DEC 2026-08-15g V-5), so it carries no `rel="sponsored"`
              — marking a plain link as sponsored would be as wrong as the reverse.
              `noopener noreferrer` is what the new tab needs: `noopener` severs the
              `window.opener` handle, and `noreferrer` is added alongside it (→ PR #62 review
              `SEC62-M3`) because the seller has no need to be told which page sent the reader
              and this repo's three earlier outbound links already carry the pair — one form,
              not two. The accessible name says where the link goes AND that it opens in a new
              tab, because a link that changes context should say so (WCAG 3.2.5). Both halves,
              because this page's other outbound control — the facade's "YouTube'da izle" —
              discloses the tab, and one page that discloses it on one link and not the other
              teaches the reader that the silent one stays put (→ PR #63 review `CS63R2-M1`).
              No price appears anywhere on this page, by rule. */}
          {book.purchaseUrl !== null && (
            <a
              className="btn btn-primary"
              href={book.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("purchaseAria")}
            >
              {t("purchase")}
            </a>
          )}
        </div>
      </div>

      <section className="section">
        <h2>{t("kunyeHeading", { title })}</h2>
        <dl className={styles.factSheet}>
          <div className={styles.fact}>
            <dt>{t("publisherLabel")}</dt>
            <dd>{book.publisherName}</dd>
          </div>
          {book.authorNames.length > 0 && (
            <div className={styles.fact}>
              <dt>{t("authorsLabel")}</dt>
              {/* Comma-joined and NOT run through a list formatter: the array is a published
                  credit whose order is the cover's, and inserting a conjunction would turn a
                  künye line into a sentence we wrote. */}
              <dd>{book.authorNames.join(", ")}</dd>
            </div>
          )}
          <div className={styles.fact}>
            <dt>{t("examLabel")}</dt>
            <dd>{book.examTrack}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{t("denemeCountLabel")}</dt>
            <dd>{format.number(book.denemeCount)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{t("pageCountLabel")}</dt>
            <dd>{format.number(book.pageCount)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>{t("isbnLabel")}</dt>
            {/* Never locale-formatted: an ISBN is an identifier, and `format.number` would
                group its digits into something that is no longer the identifier. */}
            <dd className={styles.factIdentifier}>{book.isbn13}</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <h2>{t("videosHeading", { title })}</h2>

        {/* THE COVERAGE SENTENCE IS GONE, and its removal is the ruling rather than a tidy-up.
            It used to read "Kitaptaki 40 denemeden 30 tanesinin video çözümü var." — the exact
            line DEC 2026-08-17c cites when it bars announcing the total or ratio of what is
            missing (`CONTENT-STYLE.md` §22, "eksik-vurgusu"): the reader did not need that
            number at that point, and we were the ones putting the gap in front of them.

            The half the reader DOES need survives, at the point of use. The ruling's own
            litmus is whether someone would otherwise act on a wrong expectation, and here they
            would: the covered denemeler are 1–13, 15–21, 23, 24 and 33–40, so the index skips
            14, 22 and 25–32, and a reader holding the book and looking for deneme 14 meets a
            hole with no explanation. The jump strip below answers exactly that, once, where the
            question is asked — a neutral non-link rather than a sentence about a shortfall.

            V-2 (→ DEC 2026-08-15g) is untouched: the LIST is still only the denemeler that have
            a solution. What changed is that the sentence which used to carry the coverage fact
            no longer exists, so the strip carries the necessary part of it instead. */}
        <nav className={styles.jump} aria-labelledby="denemeye-atla">
          <h3 id="denemeye-atla" className={styles.jumpHeading}>
            {t("jumpHeading")}
          </h3>
          <ul role="list" className={styles.jumpList}>
            {jumpNumbers.map((no) => {
              const covered = coveredDenemeNumbers.has(no);
              return (
                <li key={no}>
                  {/* A REAL `<a href>` FOR EVERY NUMBER THAT HAS A TARGET, AND NOTHING FOR THE
                      REST. `SEO-POLICY.md` §B8 8.9 rates a link to a fragment that does not
                      exist a BLOCKER, and the covered set is NOT a contiguous range — the api
                      publishes `denemeNumbers` precisely because the gaps are scattered
                      (14, 22, 25–32 today). Deriving the strip from `denemeCount` alone and
                      linking all of it would ship ten dead anchors.

                      THE VISIBLE TEXT IS THE BARE NUMBER AND THE ACCESSIBLE NAME IS NOT.
                      Thirty links named "1"…"40" tell a screen-reader user nothing, so the
                      full name sits in a visually-hidden span while the digit is
                      `aria-hidden`. The name still CONTAINS the visible label, which is what
                      WCAG 2.5.3 asks and what keeps speech input working — saying "12" matches
                      "Deneme 12". `title` was rejected for this job: Google treats it as anchor
                      text only for an EMPTY `<a>`, and these are not empty. */}
                  {covered ? (
                    <a className={styles.jumpItem} href={`#${denemeFragment(no)}`}>
                      <span className={styles.srOnly}>{t("denemeHeading", { no })}</span>
                      <span aria-hidden="true">{no}</span>
                    </a>
                  ) : (
                    <span className={`${styles.jumpItem} ${styles.jumpItemEmpty}`}>
                      <span className={styles.srOnly}>{t("jumpNoVideo", { no })}</span>
                      <span aria-hidden="true">{no}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* THE WORKBENCH — one stage, thirty rows, one delegated listener.

            The island renders the stage and wraps the index; the thirty rows below are UNCHANGED
            SERVER MARKUP passed as children, exactly as the accordion's rows were. That
            composition is what keeps the 180 `<a href>` in the first response while the player
            lives in a client component: React renders the island on the server too, so the stage's
            cover is in the HTML as well — with no iframe anywhere in it.

            `defaultDenemeNo === null` means the book has no indexed video at all. The bench is
            then not rendered and neither is an empty stage; the section keeps its heading and its
            jump strip, which is the honest shape for a book whose solutions are not indexed here.
            On today's data it is unreachable — every seeded book has thirty videos — but the
            contract permits `videos: []` and an empty stage would be a 16:9 grey rectangle with a
            caption naming nothing. */}
        {defaultDenemeNo !== null && (
          <VideoBench
            className={styles.workbench}
            indexClassName={styles.index}
            videos={benchVideos}
            defaultDenemeNo={defaultDenemeNo}
            locale={locale}
          >
            {videoStates.map(({ video, state }) => {
              /* ONE value, three consumers. `playable` is false for a video the provider refuses
                 to embed, and every part of the surface has to agree about it: the island
                 intercepts nothing for it, the swap point may not reach its iframe branch even if
                 the store somehow says otherwise (→ PR #63 review `CODE63-I1`), and the rows
                 neither announce a video jump nor perform one. Read through `isPlayable` rather
                 than spelled out here, for the same reason `resolveVideoState` is called once —
                 two sites writing `state.kind !== "external"` are two places to miss on the day a
                 fourth state arrives (→ PR #70 review `SIMP70-M5`). */
              const playable = isPlayable(state);
              return (
                /* THE ROW. An `<article>` and no disclosure control at all: with the panel gone
                   there is no state to toggle, so the `<summary>`/`<button aria-expanded>`
                   question the accordion had to answer does not arise. The `<h3>` keeps the `id`,
                   which is what keeps `#deneme-12` stable across this change — the fragment is
                   binding IA (`SEO-POLICY.md` §B4's book row) and nothing about the layout is
                   allowed to move it.

                   `aria-labelledby` POINTS AT THAT SAME `<h3>`, and it is what an `<article>` owes
                   its reader. `role="article"` is a landmark-adjacent region that appears by name
                   in a screen reader's element list, and a heading INSIDE an element does not name
                   it — so thirty rows arrived as thirty unnamed "article"s (→ PR #70 review
                   `A11Y70-M1`). The id it borrows is the fragment id, which already exists and is
                   already unique per video.

                   `data-deneme` SITS HERE NOW, AND IT WAS ON THE `<ul>` UNTIL PR #70's REVIEW.
                   That is why `#deneme-15` scrolled correctly and left the stage on the book's
                   first video: the fragment resolves to the `<h3>`, and `closest("[data-deneme]")`
                   from the `<h3>` walked past a `<ul>` that is its SIBLING and found nothing at
                   all (→ `FENER70-M2` / `CODE70-M5`). On the article it covers both the heading
                   and every question row beneath it, which is the whole subtree the island can be
                   asked about — still one attribute per video, not one per question. */
                <article
                  key={video.denemeNo}
                  className={styles.deneme}
                  aria-labelledby={denemeFragment(video.denemeNo)}
                  data-deneme={video.denemeNo}
                >
                  <div className={styles.denemeHead}>
                    <h3 id={denemeFragment(video.denemeNo)} className={styles.denemeHeading}>
                      {videoTitle(t, video)}
                    </h3>
                    {/* The scannable facts. The count is real per-block data rather than the
                        constant it looks like: the contract does not promise six. It names
                        QUESTION SOLUTIONS, not questions — `GLOSSARY.md` §4.2's scope note bars
                        compressing the two into one phrase, because what is measured is that each
                        video solves six questions, never that the book's deneme contains six
                        (→ PR #66 review `CS66-I1`). */}
                    <span className={styles.denemeFacts}>
                      <span>{t("denemeQuestionCount", { count: video.questions.length })}</span>
                      {/* SEPARATOR AND KÜNYE TOGETHER OR NEITHER. `DenemeMeta` renders nothing in
                          the `typographic` and `external` states, so a separator outside this
                          conditional left a dangling "6 soru ·" on any video whose provider
                          snapshot had aged out or whose video refuses embedding (→ PR #66 review
                          `CODE66-I1`). Invisible in today's samples because all thirty are `rich`;
                          the aging path is normal, not exceptional, and reaches one row at a
                          time. */}
                      {state.kind === "rich" && (
                        <>
                          <span className={styles.factSeparator} aria-hidden="true">
                            ·
                          </span>
                          <DenemeMeta state={state} />
                        </>
                      )}
                    </span>
                  </div>
                  <ul role="list" className={styles.questionGrid}>
                    {video.questions.map((question) => {
                      const fragment = questionFragment(video.denemeNo, question.questionNo);
                      return (
                        <li key={question.questionNo}>
                          {/* THE ROW IS ITS OWN FRAGMENT TARGET, which is what makes the deep link
                            real: `#deneme-12-soru-3` is copyable, shareable and enters browser
                            history, and it resolves to this element with no JavaScript involved.
                            An `<a href>` rather than a `<button>` for the same reason — §B8 8.2
                            rates JavaScript navigation a BLOCKER, and the player wiring attaches
                            to these links rather than replacing them.

                            `data-second` is the jump target the island reads on a click. The video
                            id is NOT repeated here: the island resolves the video from
                            `data-deneme` on the list above, so 180 copies of one string would be
                            dead weight in every response (a deliberate departure from `SPEC.md`
                            §4.3's letter, ruled by Atlas as AK-12/E-W2-1).

                            THE NAME SAYS WHERE THE QUESTION IS, because the player wiring changed
                            what the row DOES without changing what it says (→ PR #63 review
                            `A11Y63-I2`). A links-list or rotor user meets 180 rows named
                            `Soru 1`…`Soru 6`, and pressing one now moves the stage and starts a
                            player. The suffix states a FACT about the question — question 3 is at
                            3:24 of the video — rather than promising a behaviour, so it stays true
                            for a reader with no JavaScript, for whom the row is still the plain
                            fragment jump it always was. It begins with the visible token, which is
                            also what keeps WCAG 2.5.3 satisfied here.

                            ONLY WHERE THERE IS A PLAYER TO JUMP IN. In an `external` block the row
                            really is nothing but a fragment jump, and giving two differently
                            behaving rows one name is what WCAG 3.2.4 asks us not to do. */}
                          <a
                            id={fragment}
                            href={`#${fragment}`}
                            className={styles.questionLink}
                            data-second={question.startSecond}
                            aria-label={
                              playable
                                ? t("questionLabelAria", {
                                    no: question.questionNo,
                                    time: formatDuration(question.startSecond),
                                  })
                                : undefined
                            }
                          >
                            {t("questionLabel", { no: question.questionNo })}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </VideoBench>
        )}
      </section>

      {/* THE SOURCE STATEMENT (`SEO-POLICY.md` §B15 15.4/15.5; → PR #62 review `FENER62-I2`).
          This page carries material the partner produced, so it names the partner — and it
          names it with the api's OWN string rather than a sentence written here.
          `requiredNoticeTr` is `CONTENT-STYLE.md` §22's untouchable class: printed as
          received, never translated, shortened, reworded or re-typed by hand. It is also what
          keeps 15.5 satisfied, since it names the two real parties instead of a generic
          "resmi kaynaklar".

          BOTH ROWS NOW, WHICH IS THE W2 HALF OF THIS BLOCK. W1 printed the partner row alone
          because the page carried no YouTube content to cite. It carries it now: every block
          can load a player on a press, so the source credit is owed — and the ledger's own
          position is that carrying both is strictly safer than either alone. The array is
          iterated AS THE CONTRACT ORDERS IT and never sorted; re-ordering a published credit
          rewrites it.

          **THIS DOES NOT CLOSE THE ATTRIBUTION OBLIGATION.** The provenance ledger says it in
          as many words — "a text credit alone does not discharge the obligation": Developer
          Policies III.E.4 and the Branding Guidelines additionally require the YouTube logo on
          any page where the API has a presence, and that logo is an asset this repo does not
          have yet. It lands in W3, together with the link back to YouTube content. Nothing
          here may be read as the obligation being met.

          THE YOUTUBE ROW IS GATED ON THERE BEING A VIDEO; THE PARTNER ROW IS NOT. A book with
          no indexed video has no player, no thumbnail and no YouTube presence, so it owes that
          provider nothing. The partner's row is a different obligation and W2 first got this
          wrong by gating both together (→ PR #63 review `FENER63-M1`/`CODE63-M1`): the partner
          sentence credits the BOOK as well as its solutions, so a seeded video-less book would
          have rendered publisher material with no credit line at all — a transparency
          regression against W1, which printed that row unconditionally. Splitting the gate is
          the whole of the fix; nothing else about the block changes, and on today's data both
          rows render exactly as before.

          SELECTED AND ORDERED BY THE CONTRACT, never by matching the notice text: a credit
          line identified by its own words is a line that disappears the day the ledger rewords
          it. An empty array renders nothing rather than a fallback sentence — the rows are
          contractually always present, so their absence is a contract break, and inventing an
          attribution is exactly what an untouchable string forbids (the `marine-attribution`
          precedent: the copyright line is omitted, not faked).

          `lang="tr"` ON THE NOTICES, NOT ON THE ROW. Both are Turkish sentences on BOTH
          locales, so the EN page has to declare their language or a screen reader reads them
          with English phonetics (WCAG 3.1.2, `ENGINEERING.md` §5 — the mirror of the marine
          block's `lang="en"` on the Turkish page). The label beside them is localized interface
          copy and stays in the page's own language.

          W3 CLOSES WHAT W2's PARAGRAPH ABOVE LEFT OPEN, and it closes it HERE rather than at
          the player. Developer Policies III.E.4 and the Branding Guidelines ask for two things
          the text credit alone cannot give: the official YouTube branding logo "on any page
          where the YouTube API has a presence", and that logo linking "back to YouTube content
          or to a YouTube component". Both land on the `youtube` credit row — the logo beside
          the notice, the whole row inside one link (→ DEC 2026-08-17b).

          THE OBLIGATION IS PAGE-LEVEL, AND SO IS THE ELEMENT — which is why "visible in both
          states" holds structurally rather than by a condition. This block sits BELOW the 30
          deneme blocks and outside `DenemeVideo`'s swap point, so it is in the same DOM whether
          every block shows a typographic cover or one of them has traded its cover for an
          iframe. Nothing here reads the player's state, and nothing may start to: a mark that
          depends on the state machine is a mark that can be absent in one of the two states.
          It is deliberately NOT repeated per block (30 copies of one mark strain the ledger's
          "the logo may not be the page's most prominent element" line, and in the loaded state
          the mark would have to sit outside the player box anyway).

          NOTHING IS PLACED OVER THE PLAYER. The Required Minimum Functionality rule and
          `book-video.module.css`'s `.playerBox` comment both stand untouched by this change.

          ONLY THE `youtube` ROW IS LINKED, AND THE GATE KEYS ON THE PROVIDER TOKEN — not on
          `channelUrl`, which the contract also populates on the `partner` row today. The
          partner credit stays plain text by ruling (DEC 2026-08-17b): the Branding Guidelines
          govern the YouTube mark, and turning the publisher's untouchable sentence into a link
          to a YouTube channel would credit the wrong party with the wrong address.

          `channelUrl === null` PRINTS NO MARK AT ALL. The logo may not appear without the link
          back — so if the contract ever stops publishing the address, this row degrades to the
          plain-text credit it was in W2. That is a CONTRACT BREAK rather than a design state,
          and it is handled the way `marine-attribution` handles a missing copyright line: the
          element is omitted, never faked, and no fallback address is invented from a video id.
          A CONSTANT `https://www.youtube.com` FALLBACK WAS WEIGHED AND REFUSED (→ PR #65 review
          `FENER65-M3`), because it is the wrong trade in three directions: it is a second
          address living in web, which AK-15/E1 puts at the contract source precisely so there is
          only one; it is not the address the api published, so the mark would link back to
          something we chose rather than something the credit names; and it would REMOVE the one
          symptom this break still has. The absent mark is visible in any rendered sample; a
          plausible-looking platform link is visible nowhere, so the fallback would buy a
          discharged obligation by hiding the regression that broke it. The structural close is
          the contract's, not this file's: `BookAttributionDto.channelUrl` is typed nullable
          while `buildBookAttribution()` sets a compiled constant on every row, and narrowing the
          DTO is what makes this branch unreachable by construction.

          THE NEW-TAB DISCLOSURE IS A VISUALLY-HIDDEN SUFFIX, NOT AN `aria-label`, and that
          departs from the two outbound links above on purpose. Their visible text is ours to
          compose, so an `aria-label` can restate it. This link's visible text is
          `requiredNoticeTr` — `CONTENT-STYLE.md` §22's untouchable class — and an `aria-label`
          REPLACES the accessible name with a sentence we wrote, which is exactly what an
          untouchable string forbids. The suffix leaves the notice standing as its own text node
          and appends to it, so the accessible name still begins with the visible text (WCAG
          2.5.3) while the reader is told the link changes context (WCAG 3.2.5). The suffix is in
          the PAGE's language while the notice keeps `lang="tr"` — the same WCAG 3.1.2 split the
          notices already make.

          THE SUFFIX CARRIES ITS OWN LEADING COMMA, and it is in the message value rather than in
          this file (→ PR #65 review `A11Y65-M1` / `CODE65-M4`). Two reasons, and neither is
          typography. JSX strips a newline-only gap between adjacent elements, so without it the
          DOM holds `…YouTube</span><span>yeni sekmede…` with no separating text node at all, and
          whether the accessible name gets a space is left to each engine's block-boundary
          heuristic — a property nothing in the code guarantees. And the page's two other new-tab
          disclosures both punctuate the same join (`purchaseAria`, `watchOnYoutubeAria`), so an
          unpunctuated third one would deliver one disclosure two ways on one page, which is the
          axis `CS63R2-M1` was resolved to keep single. The comma sits in the localized value
          because punctuation belongs to the string it punctuates; the untouchable notice stays
          one unedited text node either way.

          `alt=""` ON THE MARK, because in THIS context it is decorative: the link's own text
          already says "Video kaynağı: YouTube", and naming the image "YouTube logosu" would make
          a screen reader announce the same fact twice (`SEO-POLICY.md` §B9 9.2; the same call as
          the thumbnail's, → PR #63 review `FENER63-M2`).

          THE FILE IS THE PROVIDER'S OWN BYTES. `public/marka/yt_icon_red_digital.png` is the
          unmodified `01 Red` digital icon from YouTube's brand archive
          (sha256 `1027b1b0…7a83`, identical to the file inside the downloaded zip — the
          acquisition record is `Owner's Inbox/kitap-video-web/youtube-brand/KAYNAK.md`). It is
          never recoloured, re-drawn, cropped or re-proportioned: `width`/`height` are the file's
          REAL pixel dimensions rather than a rounded pair, so the ratio the browser applies is
          the file's own, and the clear space the guidelines require is already inside the canvas
          (an 827×579 mark with 214/248px of margin around it) — printing the file whole
          preserves it automatically. `sizes="34px"` IS DERIVED, NOT PICKED (→ PR #65 review
          `CODE65-M2`): the box the CSS module builds is 28 × (1255/1075) ≈ 32.7px wide, and 34
          is that figure rounded UP past the next whole pixel, so a sub-pixel difference can
          never make the browser select a candidate narrower than what it draws. It is a
          selection hint rather than a layout declaration — the layout comes from the two
          attributes above — and it is load-bearing: without it `next/image` builds the srcset
          from `width`/`2×width` and ships a kilobyte-class render for a 33px mark, where with it
          the browser takes `w=48`. The one coupling to keep in mind is that the figure it
          rounds lives in `book-detail.module.css`'s `.sourceMark`, so a height change there is a
          change here. `next/image` is `ENGINEERING.md` §4 #9's "always" and this
          asset meets neither narrow exception: it is not a build-emitted SVG and its provider
          does not bar byte copies — YouTube publishes it FOR republication (Atlas ruling AK-15
          /E2). Re-encoding is not one of the modifications the guidelines name; colour, ratio and
          crop all survive it, and the 4× closeup sample is the evidence. */}
      {attributionRows.length > 0 && (
        <p className={styles.sources}>
          <span className={styles.sourcesLabel}>{t("sourcesLabel")}:</span>{" "}
          {attributionRows.map((row, index) => (
            <Fragment key={row.providerId}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              {/* THE NOTICE ELEMENT IS WRITTEN OUT IDENTICALLY IN BOTH BRANCHES rather than
                  hoisted into a shared variable, and that is not an oversight. `lang="tr"` and
                  the bare `{row.requiredNoticeTr}` interpolation are what `attribution-gate.
                  test.ts` reads out of THIS file's source; a hoisted element would satisfy that
                  scan from one site while the branch that actually renders showed something
                  else. Two literal copies mean the guard is looking at both. */}
              {row.providerId === "youtube" && row.channelUrl !== null ? (
                <a
                  className={styles.sourceLink}
                  href={row.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src="/marka/yt_icon_red_digital.png"
                    alt=""
                    width={1255}
                    height={1075}
                    sizes="34px"
                    className={styles.sourceMark}
                  />
                  <span lang="tr">{row.requiredNoticeTr}</span>
                  <span className={styles.srOnly}>{t("sourceNewTab")}</span>
                </a>
              ) : (
                <span lang="tr">{row.requiredNoticeTr}</span>
              )}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}
