import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getBooksResilient } from "@/lib/api/books";
import type { BookListItem } from "@/lib/api/types";
import {
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
  type ItemListEntry,
} from "@/lib/seo/json-ld";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2BooksHub } from "@/components/v2/v2-books-hub";
import { V2StudyStrategyGuide } from "@/components/v2/v2-study-strategy-guide";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Home, ChevronRight } from "lucide-react";

export const revalidate = 86400;

interface V2KitaplarPageProps {
  params: Promise<{ locale: Locale }>;
}

function slugForLocale(book: BookListItem, locale: Locale): string {
  return locale === "en" ? book.slugEn : book.slugTr;
}

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
      path: `/v2/kitaplar/${slugForLocale(book, locale)}`,
    })),
    videoCount: books.reduce((total, book) => total + book.videoCount, 0),
    questionCount: books.reduce((total, book) => total + book.questionCount, 0),
  };
}

export async function generateMetadata({ params }: V2KitaplarPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { books, videoCount, questionCount } = await loadBooks(locale);
  if (books.length === 0) return {};

  return {
    title: "Video Çözümlü Coğrafya Kitapları v2 — AYT & TYT Branş Denemeleri",
    description: `Coğrafya kitaplarının soru bazlı ayrıntılı video çözümleri, ${videoCount} video ve ${questionCount} soru çözümü, konu kazanım analizleri ve sınav hazırlık rehberi.`,
    alternates: {
      canonical: "/v2/kitaplar",
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function V2KitaplarPage({ params }: V2KitaplarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { books, items, videoCount, questionCount } = await loadBooks(locale);
  if (books.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Structured Data / JSON-LD */}
      <JsonLd
        schema={[
          collectionPageJsonLd({
            name: "Video Çözümlü Coğrafya Kitapları v2",
            description: `Coğrafya kitaplarının soru bazlı video çözümleri, ${videoCount} video ve ${questionCount} soru çözümü ile sınav hazırlık rehberi.`,
            path: "/v2/kitaplar",
            locale,
          }),
          itemListJsonLd({
            name: "Video Çözümlü Kitaplar",
            items,
          }),
        ]}
      />

      {/* V2 Header & Telemetry */}
      <V2Header />
      <V2LiveTicker />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-12">
        {/* Breadcrumb & Header Hero */}
        <div className="space-y-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link
              href="/v2"
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
                  Dijital Eğitim Platformu v2
                </Badge>
                <Badge variant="secondary" size="sm">
                  AYT &bull; TYT &bull; YKS
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight text-[var(--color-primary-dark,#7e3a1e)] leading-tight">
                Video Çözümlü Coğrafya Kitapları
              </h1>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Yayımlanan Coğrafya branş denemelerinin soru bazlı ayrıntılı video çözümleri, zaman
                çizelgesi atlama noktaları ve sınav hazırlık stratejileri.
              </p>
            </div>

            {/* Dynamic Metric Strip from Real Data */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-primary block">
                  {books.length} Kitap
                </span>
                <span className="text-xs text-muted-foreground font-medium">Yayın Kataloğu</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-secondary block">
                  {videoCount} Video
                </span>
                <span className="text-xs text-muted-foreground font-medium">Çözümlü Deneme</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-accent block">
                  {questionCount} Soru
                </span>
                <span className="text-xs text-muted-foreground font-medium">Ayrıntılı Çözüm</span>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-primary-dark,#7e3a1e)] block">
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
      </main>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
