import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumb } from "@/components/breadcrumb";
import { CardArrow } from "@/components/card-arrow";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getBooksResilient } from "@/lib/api/books";
import type { BookListItem } from "@/lib/api/types";
import {
  collectionPageJsonLd,
  itemListJsonLd,
  type ItemListEntry,
  JsonLd,
} from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import styles from "./kitaplar.module.css";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

/** The localized slug (`slugTr` for tr, `slugEn` for en) — two columns, never one derived
 *  from the other (`SEO-POLICY.md` §B4 4.5, BLOCKER). */
function slugForLocale(book: BookListItem, locale: Locale): string {
  return locale === "en" ? book.slugEn : book.slugTr;
}

/**
 * The hub's ONE derivation of the book list, shared by the visible cards, the `ItemList`
 * and the meta description.
 *
 * Single source on purpose (`SEO-POLICY.md` §B5 5.7 + the `/dunya` twin): the structured
 * data enumerates exactly the pages the reader can see and the description counts exactly
 * what the page lists, so neither can promise a book the hub does not carry.
 *
 * `titleTr` serves both locales — `titleEn` is `null` by contract and stays that way, since
 * a product name is not translated (`GLOSSARY.md` §4.2; `SEO-POLICY.md` §B14 14.2 omits a
 * field with no counterpart rather than machine-filling it).
 */
async function loadBooks(locale: Locale): Promise<{
  books: BookListItem[];
  items: ItemListEntry[];
  videoCount: number;
  questionCount: number;
}> {
  const books = await getBooksResilient();
  return {
    books,
    items: books.map((book) => ({
      name: book.titleTr,
      path: getPathname({
        locale,
        href: { pathname: "/kitaplar/[slug]", params: { slug: slugForLocale(book, locale) } },
      }),
    })),
    videoCount: books.reduce((total, book) => total + book.videoCount, 0),
    questionCount: books.reduce((total, book) => total + book.questionCount, 0),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { books, videoCount, questionCount } = await loadBooks(locale);
  // An empty catalogue makes the page component call `notFound()` (see below), and Next
  // then resolves the document title from the not-found boundary — so anything returned
  // here would be discarded. Same reasoning as the province route's `if (!province) return {}`.
  if (books.length === 0) return {};

  const t = await getTranslations({ locale, namespace: "Kitaplar" });

  return buildMetadata({
    locale,
    hrefForLocale: () => "/kitaplar",
    title: t("metaTitle"),
    // The counts come from the same derivation the body renders, so the description can
    // never claim more than the page lists (§B2.6).
    description: t("metaDescription", { videoCount, questionCount }),
    // Permanently single-locale: the English twin is `noindex` for good and the
    // `EN_CONTENT_READY` flag does not reach it (→ DEC 2026-08-15g V-4, `lib/seo/indexing.ts`).
    surface: "trOnly",
  });
}

/**
 * `/kitaplar` — the book hub (→ DEC 2026-08-15c; IA row in `CONVENTIONS.md` §5 and
 * `SEO-POLICY.md` §B4).
 *
 * SSG + ISR like every other programmatic hub (`ENGINEERING.md` §3): the card list is
 * server-rendered with real crawlable `<a href>` links to each book's detail page, so the
 * whole of the page's content is in the first response (§4 #1). JSON-LD is a
 * `CollectionPage` plus an `ItemList` enumerating only pages that actually exist.
 *
 * AN EMPTY LIST IS A 404, NOT AN EMPTY HUB (web SPEC §4.7). Two states produce one: the api
 * has no books, or a build-time api failure degraded `getBooksResilient` to `[]`. A heading
 * with nothing under it is what §B11 11.9 calls a soft 404, and it would also owe a sitemap
 * entry for a page carrying nothing — so the page answers a real 404 instead, and the
 * sitemap's own book block drops out with it (`app/sitemap.ts` reads the same list).
 */
export default async function KitaplarPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { books, items, videoCount, questionCount } = await loadBooks(locale);
  if (books.length === 0) {
    notFound();
  }

  const t = await getTranslations("Kitaplar");
  const tb = await getTranslations("Breadcrumb");
  const path = getPathname({ locale, href: "/kitaplar" });

  return (
    <div className="container page">
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: t("heading"),
            description: t("metaDescription", { videoCount, questionCount }),
            path,
            locale,
          }),
          itemListJsonLd({ name: t("heading"), items }),
        ]}
      />
      <Breadcrumb
        locale={locale}
        items={[
          { label: tb("home"), href: "/" },
          { label: tb("kitaplar"), href: "/kitaplar" },
        ]}
      />
      <h1>{t("heading")}</h1>
      <p className="lede">{t("lede")}</p>

      <ul role="list" className={styles.grid}>
        {books.map((book) => (
          <li key={book.slugTr}>
            <Link
              className={styles.card}
              href={{
                pathname: "/kitaplar/[slug]",
                params: { slug: slugForLocale(book, locale) },
              }}
            >
              {/* OUR OWN asset, so it goes through `next/image` like every other local image
                  (`ENGINEERING.md` §4 #9 — the second exception covers a REMOTE image whose
                  provider bars byte copies, and says in as many words that it does not reach
                  the covers in `public/kitaplar/`).

                  `fill` inside a fixed-size box rather than explicit dimensions: the contract
                  publishes a PATH and no width/height pair, and the CLS guarantee comes from
                  the box either way. `null` is a contract state — a book with no cover renders
                  no image, never a placeholder frame.

                  `alt=""` because the cover is decorative HERE and only here: it sits inside
                  the same link as the title, which already carries the book's name, so a
                  described cover would announce the same fact twice to a screen reader
                  (`ENGINEERING.md` §5; `SEO-POLICY.md` §B9 9.2). The detail page's cover is
                  NOT decorative and carries a real `alt`. */}
              {book.coverImagePath !== null && (
                <span className={styles.cardCover}>
                  <Image
                    src={book.coverImagePath}
                    alt=""
                    fill
                    sizes="72px"
                    className={styles.cardCoverImage}
                  />
                </span>
              )}
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>{book.titleTr}</span>
                <span className={styles.cardPublisher}>{book.publisherName}</span>
                <span className={styles.cardBadges}>
                  <span className="chip">{t("cardVideos", { count: book.videoCount })}</span>
                  <span className="chip">{t("cardQuestions", { count: book.questionCount })}</span>
                </span>
              </span>
              <CardArrow />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
