import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getBooksResilient } from "@/lib/api/books";
import type { BookListItem } from "@/lib/api/types";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2BooksHub } from "@/components/v2/v2-books-hub";
import { V2StudyStrategyGuide } from "@/components/v2/v2-study-strategy-guide";
import { PageContainer } from "@/components/patterns/page-container";
import { PageHero } from "@/components/patterns/page-hero";
import { StatGrid } from "@/components/patterns/stat-grid";
import { StatTile } from "@/components/patterns/stat-tile";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { Home } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * 3600s, not the previous 86400: the fix round that dropped this page's `notFound()` on an
 * empty catalogue (`58a2c6d`, "render graceful empty state for books") left the degrade
 * window at 24h. A build-time api outage still bakes an empty book list into this route —
 * `V2BooksHub` below now renders an honest "henüz kitap yayımlanmadı" state for that case
 * (see its own comment) rather than the old misleading "no search results" copy, so the
 * degrade is legible, but a whole day of it is still needlessly long. 3600s matches this
 * repo's own reference-list precedent (`lib/api/client.ts`'s `CONTENT_REVALIDATE_SECONDS`).
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

export async function generateMetadata({ params }: V2KitaplarPageProps): Promise<Metadata> {
  const { locale } = await params;

  // Fixed editorial copy (no book-level count is published — see the comment below), so
  // this never depends on the catalogue fetch succeeding. Previously this bailed to `{}`
  // whenever `getBooksResilient()` came back empty (a real, reachable state: any build-time
  // api hiccup degrades the catalogue to `[]`, see the `revalidate` comment above) — Next
  // then fell back to the root layout's `title.default`, the SITE'S OWN homepage title, on
  // a page that is not the homepage. A page-specific title must hold regardless of whether
  // the catalogue itself loaded.
  return buildMetadata({
    locale,
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
    surface: "trOnly",
    hrefForLocale: () => "/kitaplar",
    title: "Video Çözümlü Coğrafya Kitapları — AYT & TYT Branş Denemeleri",
    // No book-level count is published any more (P0 generic-catalogue cut-over,
    // `DEC 2026-09-10c` md.1) — fixed editorial copy, no interpolated numbers.
    description:
      "Coğrafya kitaplarının soru bazlı ayrıntılı video çözümleri, konu kazanım analizleri ve sınav hazırlık rehberi.",
  });
}

export default async function V2KitaplarPage({ params }: V2KitaplarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { books, items } = await loadBooks(locale);

  return (
    <>
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Video Çözümlü Coğrafya Kitapları",
            description:
              "Coğrafya kitaplarının soru bazlı video çözümleri ve sınav hazırlık rehberi.",
            path: "/kitaplar",
            locale,
          }),
          itemListJsonLd({
            name: "Video Çözümlü Kitaplar",
            items,
          }),
        ]}
      />

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
            surface="trOnly"
          />

          <Card variant="feature">
            <PageHero
              tier="hub"
              heading="Kitaplar ve Çözüm Videoları"
              lede={
                <>
                  Deneme kitaplarının çözüm videoları burada. Videonun altındaki soru numaralarından
                  birine tıklarsan video o sorunun çözümüne atlar.
                </>
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
            <StatGrid columns="2" gutter="hero">
              {/* NO `books.length > 0 ? … : null`. An earlier round had one, and it was the
                  clearest case against the whole idea: this page deliberately does NOT
                  `notFound()` on an empty catalogue, so zero books is a LEGITIMATE READING, and
                  rendering "Katalog boş / Yayın listesi gelmedi" over it invents a fetch failure
                  that did not happen — T-024's defect with the sign flipped. `dev` printed
                  "0 Kitap" and so does this. See `turkiye/page.tsx` for the rule all four
                  data-backed tiles now share — including that the `absent` copy below is
                  type-required and currently unreachable (`books.length` is a number by
                  construction), so it is not shipped user-facing text. */}
              <StatTile
                label="Çözümü yayında"
                value={books.length}
                unit="kitap"
                tone="primary"
                absent={{ label: "Liste okunamadı", hint: "Kitap listesi gelmedi" }}
              />
              <StatTile label="Videoları izlemek için" fact="Ücretsiz üyelik" tone="primary" />
            </StatGrid>
          </Card>
        </div>

        {/* SECTION 1: DYNAMIC BOOKS CATALOGUE */}
        <V2BooksHub books={books} locale={locale} />

        {/* SECTION 2: STUDY STRATEGY & EXAM TOPIC GUIDE */}
        <V2StudyStrategyGuide />
      </PageContainer>
    </>
  );
}
