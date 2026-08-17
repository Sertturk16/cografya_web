import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { DenemeFacade, DenemeMeta } from "@/components/book/deneme-facade";
import { DenemePlayer } from "@/components/book/deneme-player";
import { DenemeVideo } from "@/components/book/deneme-video";
import { ProseNote } from "@/components/prose-note";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getBookBySlug, getBooksResilient } from "@/lib/api/books";
import { formatDuration } from "@/lib/book/duration";
import { resolveVideoState } from "@/lib/book/video-state";
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

/** The stable fragment id of one deneme block (`SEO-POLICY.md` §B4's book row). */
function denemeFragment(denemeNo: number): string {
  return `deneme-${denemeNo}`;
}

/** The stable fragment id of one question row — `#deneme-12-soru-3`, IA, not a route. */
function questionFragment(denemeNo: number, questionNo: number): string {
  return `${denemeFragment(denemeNo)}-soru-${questionNo}`;
}

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
 * The fragments (`#deneme-12`, `#deneme-12-soru-3`) are part of the IA (`SEO-POLICY.md`
 * §B4's book row) and deliberately NOT routes: a page per deneme or per question would be
 * 30 and 180 near-identical thin pages, which is §B12 12.1's shape exactly. Each target
 * carries `scroll-margin-top` so a followed fragment lands below the sticky header at every
 * viewport, 320px included (§B4 4.9).
 *
 * ## The player (W2) is an addition to this index, never a replacement for it
 *
 * Each block is wrapped by a client island that delegates one listener over its own rows; the
 * rows themselves are untouched server markup and still resolve with JavaScript off. The
 * player arrives only on a click or a key press, only inside the block that was pressed, and
 * only one at a time — so the first response still carries no iframe at all.
 *
 * The provider snapshot (`videos[].youtube`) is `null` on the normal path today, which is why
 * the covers are typographic and no `VideoObject` is emitted: the markup rule is a chain —
 * `uploadDate`/`duration` may only be emitted where the page SHOWS them (§B5 5.7), and a
 * `VideoObject` only where the video can actually be watched. `lib/book/video-state.ts` is the
 * single place that decides which of the three states a block is in, so the visible facts and
 * the structured data cannot drift apart.
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
      name: `${title} — ${t("denemeHeading", { no: video.denemeNo })}`,
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
          in 30 times the markup. Emitted only when the array is non-empty — today it is empty
          on real data, because every snapshot is `null`. */}
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
        {/* The coverage fact as its own sentence (owner ruling V-2, → DEC 2026-08-15g): the
            list shows only the denemeler that HAVE a solution, and this line states the
            relation between the two numbers instead of the list padding itself with rows for
            the rest. Both numbers are facts the künye and the badges already carry; neither
            declares a deficiency. */}
        <p className={styles.coverageNote}>
          {t("coverageNote", {
            denemeCount: book.coverage.denemeCount,
            videoCount: book.coverage.videoCount,
          })}
        </p>

        {videoStates.map(({ video, state }) => {
          /* ONE value, four consumers. `playable` is false for a video the provider refuses to
             embed, and every part of the block has to agree about it: the island intercepts
             nothing, the swap point may not reach its iframe branch even if the store somehow
             says otherwise (→ PR #63 review `CODE63-I1`), and the rows neither announce a video
             jump nor perform one. Computed here rather than re-derived at each site, for the
             same reason `resolveVideoState` is called once. */
          const playable = state.kind !== "external";
          return (
            /* The block's own client island. It renders THIS `<section>` and delegates one
               listener over everything inside it; the markup below is unchanged server output.
               When the block is not playable the island intercepts nothing at all — those rows
               keep their plain fragment behaviour, because there is no player for them to
               seek. */
            <DenemePlayer
              key={video.denemeNo}
              className={styles.deneme}
              denemeNo={video.denemeNo}
              playable={playable}
            >
              <h3 id={denemeFragment(video.denemeNo)} className={styles.denemeHeading}>
                {t("denemeHeading", { no: video.denemeNo })}
              </h3>
              <DenemeMeta state={state} />
              <DenemeVideo
                denemeNo={video.denemeNo}
                videoId={video.youtubeVideoId}
                title={t("playerTitle", { no: video.denemeNo })}
                playable={playable}
                facade={
                  <DenemeFacade
                    denemeNo={video.denemeNo}
                    videoId={video.youtubeVideoId}
                    state={state}
                  />
                }
              />
              <ul role="list" className={styles.questionGrid}>
                {video.questions.map((question) => {
                  const fragment = questionFragment(video.denemeNo, question.questionNo);
                  return (
                    <li key={question.questionNo}>
                      {/* THE ROW IS ITS OWN FRAGMENT TARGET, which is what makes the deep link
                          real: `#deneme-12-soru-3` is copyable, shareable and enters browser
                          history, and it resolves to this element with no JavaScript involved.
                          An `<a href>` rather than a `<button>` for the same reason — §B8 8.2
                          rates JavaScript navigation a BLOCKER, and W2's player wiring attaches
                          to these links rather than replacing them.

                          `data-second` is the jump target the block's island reads on a click.
                          The video id is NOT repeated here: the island is per-block and already
                          holds it, so 180 copies of one string would be dead weight in every
                          response (a deliberate departure from `SPEC.md` §4.3's letter, ruled by
                          Atlas as AK-12/E-W2-1).

                          THE NAME SAYS WHERE THE QUESTION IS, because W2 changed what the row
                          DOES without changing what it says (→ PR #63 review `A11Y63-I2`). A
                          links-list or rotor user meets 180 rows named `Soru 1`…`Soru 6`, and
                          pressing one now opens a player and moves focus into a cross-origin
                          frame. The suffix states a FACT about the question — question 3 is at
                          3:24 of the video — rather than promising a behaviour, so it stays
                          true for a reader with no JavaScript, for whom the row is still the
                          plain fragment jump it always was. It begins with the visible token,
                          which is also what keeps WCAG 2.5.3 satisfied here.

                          ONLY WHERE THERE IS A PLAYER TO JUMP IN. In an `external` block the
                          row really is nothing but a fragment jump, and giving two differently
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
            </DenemePlayer>
          );
        })}
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
          copy and stays in the page's own language. */}
      {attributionRows.length > 0 && (
        <p className={styles.sources}>
          <span className={styles.sourcesLabel}>{t("sourcesLabel")}:</span>{" "}
          {attributionRows.map((row, index) => (
            <Fragment key={row.providerId}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              <span lang="tr">{row.requiredNoticeTr}</span>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}
