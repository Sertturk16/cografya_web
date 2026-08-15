import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { ProseNote } from "@/components/prose-note";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getBookBySlug, getBooksResilient } from "@/lib/api/books";
import type { BookDetail, BookListItem } from "@/lib/api/types";
import { bookJsonLd, JsonLd } from "@/lib/seo/json-ld";
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
 * ## What is deliberately absent here and lands in W2
 *
 * No player, no iframe, no thumbnail, no `VideoObject`, no visible duration or publish date.
 * Every one of those depends on the api's provider snapshot, which is `null` on the normal
 * path today, and the markup rule is a chain: `uploadDate`/`duration` may only be emitted
 * where the page shows them (§B5 5.7), and a `VideoObject` may only be emitted on a page
 * where the video can be watched. This page shows none of it and emits none of it.
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
            no "cover coming soon". Today's seed is null (the api's `cover_image_path` is not
            filled yet), so the live page currently takes this branch. */}
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
              — marking a plain link as sponsored would be as wrong as the reverse. `noopener`
              is what the new tab needs; the accessible name says where it goes, because a
              link that changes context should say so (WCAG 3.2.5). No price appears anywhere
              on this page, by rule. */}
          {book.purchaseUrl !== null && (
            <a
              className="btn btn-primary"
              href={book.purchaseUrl}
              target="_blank"
              rel="noopener"
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

        {book.videos.map((video) => (
          <section key={video.denemeNo} className={styles.deneme}>
            <h3 id={denemeFragment(video.denemeNo)} className={styles.denemeHeading}>
              {t("denemeHeading", { no: video.denemeNo })}
            </h3>
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
                        to these links rather than replacing them. */}
                    <a id={fragment} href={`#${fragment}`} className={styles.questionLink}>
                      {t("questionLabel", { no: question.questionNo })}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
