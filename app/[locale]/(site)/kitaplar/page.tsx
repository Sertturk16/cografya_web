import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getBooksResilient } from "@/lib/api/books";
import type { BookListItem } from "@/lib/api/types";
import { collectionPageJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2BooksHub } from "@/components/v2/v2-books-hub";
import { V2StudyStrategyGuide } from "@/components/v2/v2-study-strategy-guide";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Home, ChevronRight } from "lucide-react";

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

      {/* V2 Header & Telemetry */}
      <V2LiveTicker />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-12">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">Video Çözümlü Kitaplar</span>
          </nav>

          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-card to-muted/30 p-6 sm:p-10 shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
                  Dijital Eğitim Platformu
                </Badge>
                <Badge variant="secondary" size="sm">
                  AYT &bull; TYT &bull; YKS
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
                Video Çözümlü Coğrafya Kitapları
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Yayımlanan Coğrafya branş denemelerinin soru bazlı ayrıntılı video çözümleri, zaman
                çizelgesi atlama noktaları ve sınav hazırlık stratejileri.
              </p>
            </div>

            {/* Dynamic Metric Strip from Real Data. Two of the four tiles carried
                `videoCount`/`questionCount` — DELETED with the fields (P0 generic-catalogue
                cut-over, `DEC 2026-09-10c` md.1: no book-level count is published any more).
                The grid stays byte-identical to the 9 sibling metric strips elsewhere in /v2
                (`DESIGN.md` §4's established-component-pattern precedent, → PR #103 review
                DF103-I1) — `sm:col-span-2` on each surviving tile fills all four tracks evenly
                instead of inventing a page-local two-column variant (fix round, PR #134 review
                DES134-I1). */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs sm:col-span-2">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  {books.length} Kitap
                </span>
                <span className="text-xs text-muted-foreground font-medium">Yayın Kataloğu</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs sm:col-span-2">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  ÖSYM / MEB
                </span>
                <span className="text-xs text-muted-foreground font-medium">Müfredat Uyumu</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: DYNAMIC BOOKS CATALOGUE */}
        <V2BooksHub books={books} locale={locale} />

        {/* SECTION 2: STUDY STRATEGY & EXAM TOPIC GUIDE */}
        <V2StudyStrategyGuide />

        {/* SECTION 3: SCIENTIFIC ATTRIBUTIONS & SOURCES (KAYNAKÇA) */}
        <V2SourcesSection scope="kitaplar" />
      </div>
      {/* Modern V2 Footer */}
    </>
  );
}
