import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getBooksResilient, hasBooks } from "@/lib/api/books";
import type { BookListItem } from "@/lib/api/types";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { bookHubSurface } from "@/lib/seo/book-sitemap";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2BooksHub } from "@/components/v2/v2-books-hub";
import { V2StudyStrategyGuide } from "@/components/v2/v2-study-strategy-guide";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { CardGridSkeleton, StatTileSkeleton } from "@/components/patterns/page-skeleton";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Home } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * 3600s, not the previous 86400: the fix round that dropped this page's `notFound()` on an
 * empty catalogue (`58a2c6d`, "render graceful empty state for books") left the degrade
 * window at 24h. An empty catalogue is a real state (no book is published today), and a
 * build-time api outage bakes the same empty list into this route; either way the page renders
 * its "no books yet" state under `noindex`, and the first book should not wait a day to show.
 * 3600s matches this repo's own reference-list precedent (`lib/api/client.ts`'s
 * `CONTENT_REVALIDATE_SECONDS`).
 */
export const revalidate = 3600;

interface V2KitaplarPageProps {
  params: Promise<{ locale: Locale }>;
}

function slugForLocale(book: BookListItem, locale: Locale): string {
  return locale === "en" ? book.slugEn : book.slugTr;
}

async function loadBooks(locale: Locale) {
  const books = await getBooksResilient();
  return {
    books,
    items: books.map((book) => ({
      name: book.titleTr,
      path: `/kitaplar/${slugForLocale(book, locale)}`,
    })),
  };
}

const HUB_DESCRIPTION =
  "Coğrafya kitaplarının video çözümleri; her sorunun videoda başladığı an işaretli. Kitabı adına ya da yayınevine göre ara, çözüm videolarını aç.";

export async function generateMetadata({ params }: V2KitaplarPageProps): Promise<Metadata> {
  const { locale } = await params;

  // Fixed editorial copy (no book-level count is published), so the title never depends on
  // the catalogue: bailing to `{}` on an empty list once made Next fall back to the SITE'S
  // OWN homepage title on a page that is not the homepage.
  return buildMetadata({
    locale,
    // `trOnly` while a book is listed — the surface `app/sitemap.ts` publishes this URL
    // with — and `noindex` while the catalogue is empty and the sitemap leaves it out, so an
    // empty hub is never an indexed thin page (`lib/seo/book-sitemap.ts`).
    surface: bookHubSurface(await hasBooks()),
    hrefForLocale: () => "/kitaplar",
    title: "Coğrafya Kitaplarının Video Çözümleri",
    description: HUB_DESCRIPTION,
  });
}

async function BooksCountTile() {
  const { books } = await loadBooks("tr");
  return (
    <StatTile
      label="Çözümü yayında"
      value={books.length}
      unit="kitap"
      tone="primary"
      absent={{ label: "Liste okunamadı", hint: "Kitap listesi gelmedi" }}
    />
  );
}

async function BooksCatalogue({ locale }: { locale: Locale }) {
  const { books, items } = await loadBooks(locale);
  return (
    <>
      {books.length > 0 && (
        <JsonLd schema={[itemListJsonLd({ name: "Video Çözümlü Kitaplar", items })]} />
      )}
      <V2BooksHub books={books} locale={locale} />
    </>
  );
}

export default async function V2KitaplarPage({ params }: V2KitaplarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Awaited here rather than behind Suspense: it decides the page's robots surface, which the
  // breadcrumb trail below has to agree with. The layout already read it for the header, and
  // `hasBooks` is `cache()`-wrapped, so this costs no second request.
  const booksVisible = await hasBooks();

  return (
    <>
      {/* Structured Data / JSON-LD — only for the indexable, listing state */}
      {booksVisible && (
        <JsonLd
          schema={[
            collectionPageJsonLd({
              name: "Video Çözümlü Coğrafya Kitapları",
              description: HUB_DESCRIPTION,
              path: "/kitaplar",
              locale,
            }),
          ]}
        />
      )}

      <V2LiveTicker />

      <PageContainer>
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Kitaplar", path: "/kitaplar" },
            ]}
            locale={locale}
            surface={bookHubSurface(booksVisible)}
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Kitaplar ve Çözüm Videoları"
              lede={
                booksVisible ? (
                  <>
                    Coğrafya kitaplarının çözüm videoları burada. Videonun altındaki soru
                    numaralarından birine tıklarsan video o sorunun çözümüne atlar.
                  </>
                ) : (
                  <>Coğrafya kitaplarının çözüm videoları bu sayfada yayımlanacak.</>
                )
              }
            />

            {/* Dynamic Metric Strip from Real Data. Two of the four tiles carried
                `videoCount`/`questionCount` — DELETED with the fields (no book-level count is
                published any more).

                The old comment here claimed "9 sibling metric strips". It was wrong, and it
                was the evidence the whole adoption rested on: there are THIRTEEN, counted, plus
                the inverted facts sheet on `kitaplar/[slug]`. TWELVE of the thirteen now render
                `StatGrid` + `StatTile`; `deprem/fay-hatlari`'s is deliberately left hand-rolled
                under Ruling BG, because its three fault values are colour-coded identifiers that
                have to agree with the fault cards further down that page. So the claim this
                comment used to make by assertion is now made by the type, and the one exception
                is written down in the file that carries it.

                `sm:col-span-2` on each surviving tile is what filled all four tracks evenly
                with only two tiles. `StatGrid` has no per-tile escape hatch and `StatTile` has
                no `className` worth spending one on, so this grid takes `columns="2"` — two
                tracks at every width, which is the same rendering by the honest route. */}
            {/* The strip shows only while a book is listed. With none, "0 kitap" and a
                membership tile for videos that do not exist say nothing the empty state below
                does not; the page is `noindex` in that state and the catalogue says so in
                words. The `absent` copy is type-required and unreachable (`books.length` is a
                number by construction), so it is not shipped user-facing text. */}
            {booksVisible && (
              <StatGrid columns="2" gutter="hero">
                <Suspense fallback={<StatTileSkeleton />}>
                  <BooksCountTile />
                </Suspense>
                <StatTile label="Videoları izlemek için" fact="Ücretsiz üyelik" tone="primary" />
              </StatGrid>
            )}
          </Card>
        </div>

        {/* SECTION 1: DYNAMIC BOOKS CATALOGUE */}
        <Suspense fallback={<CardGridSkeleton columns="2" count={4} />}>
          <BooksCatalogue locale={locale} />
        </Suspense>

        {/* SECTION 2: STUDY STRATEGY & EXAM TOPIC GUIDE */}
        <V2StudyStrategyGuide />
      </PageContainer>
    </>
  );
}
