import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { V2Header } from "@/components/v2/v2-header";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import { V2Footer } from "@/components/v2/v2-footer";
import type { BenchVideo } from "@/components/book/bench-stage";
import { DenemeMeta } from "@/components/book/deneme-meta";
import { VideoBench } from "@/components/book/video-bench";
import { ProseNote } from "@/components/prose-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
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
import {
  BookOpen,
  Video,
  GraduationCap,
  Home,
  ChevronRight,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  PlayCircle,
  HelpCircle,
  FileText,
  User,
  Building,
} from "lucide-react";
import styles from "../../../kitaplar/[slug]/book-detail.module.css";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

const BOOK_LANGUAGE = "tr";

function slugForLocale(book: BookDetail | BookListItem, locale: Locale): string {
  return locale === "en" ? book.slugEn : book.slugTr;
}

export async function generateStaticParams() {
  const books = await getBooksResilient();
  return routing.locales.flatMap((locale) =>
    books.map((book) => ({ locale, slug: slugForLocale(book, locale) })),
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return {};

  return buildMetadata({
    locale,
    hrefForLocale: (l) => ({
      pathname: "/v2/kitaplar/[slug]",
      params: { slug: slugForLocale(book, l) },
    }),
    title: `${book.metaTitleTr} | V2 Kitaplar`,
    description: book.metaDescriptionTr,
    openGraphType: "article",
    surface: "trOnly",
  });
}

export default async function V2BookDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  if (!book) {
    notFound();
  }

  const t = await getTranslations("BookDetail");
  const format = await getFormatter();

  const title = book.titleTr;
  const path = `/v2/kitaplar/${slugForLocale(book, locale)}`;

  const introText = locale === "tr" ? book.introTr : null;
  const videoStates = book.videos.map((video) => ({ video, state: resolveVideoState(video) }));

  const jumpNumbers = Array.from({ length: book.coverage.denemeCount }, (_, index) => index + 1);
  const coveredDenemeNumbers = new Set(videoStates.map(({ video }) => video.denemeNo));

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

  const defaultDenemeNo = benchVideos[0]?.denemeNo ?? null;

  const videoSchemas = videoStates.flatMap(({ video, state }) => {
    if (state.kind !== "rich") return [];
    const schema = videoObjectJsonLd({
      name: `${title} — ${videoTitle(t, video)}`,
      thumbnailUrl: state.youtube.thumbnailUrl,
      uploadDate: state.youtube.publishedAtUtc,
      duration: state.youtube.durationIso,
      embedUrl: canonicalEmbedUrl(video.youtubeVideoId),
    });
    return schema === null ? [] : [schema];
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <JsonLd
        schema={bookJsonLd({
          name: title,
          path,
          inLanguage: BOOK_LANGUAGE,
          authorNames: book.authorNames,
          publisherName: book.publisherName,
          isbn: book.isbn13,
          numberOfPages: book.pageCount,
          dateModified: book.updatedAt,
        })}
      />
      {videoSchemas.length > 0 && <JsonLd schema={videoSchemas} />}

      <V2Header />
      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section className="relative border-b border-border bg-gradient-to-b from-amber-500/10 via-background to-background pt-8 pb-12 overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl relative z-10 space-y-6">
          {/* Breadcrumb Bar */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <Link href="/v2" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <Link href="/v2/kitaplar" className="hover:text-foreground transition-colors">
              Kitaplar &amp; Denemeler
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold truncate max-w-xs">{title}</span>
          </nav>

          {/* Book Hero Card */}
          <div className="flex flex-col md:flex-row gap-8 items-start bg-card/85 backdrop-blur-md border border-border p-6 sm:p-8 rounded-3xl shadow-lg">
            {/* Book Cover Image */}
            {book.coverImagePath && (
              <div className="relative w-36 sm:w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border border-border/80 shrink-0 bg-muted">
                <Image
                  src={book.coverImagePath}
                  alt={`${title} kapak görseli`}
                  fill
                  sizes="(max-width: 40rem) 144px, 192px"
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Book Details */}
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="primary" size="sm" icon={<BookOpen className="size-3.5" />}>
                  {book.examTrack || "AYT / TYT"}
                </Badge>
                <Badge variant="secondary" size="sm">
                  {book.coverage.videoCount} Video Çözüm
                </Badge>
                <Badge variant="outline" size="sm" className="font-mono">
                  {book.coverage.questionCount} Soru
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                {title}
              </h1>

              {introText && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {introText}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                {book.purchaseUrl && (
                  <a
                    href={book.purchaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <Button variant="primary" size="sm" leftIcon={<ShoppingBag className="size-4" />} rightIcon={<ExternalLink className="size-3.5 opacity-60" />}>
                      Kitabı Satın Al
                    </Button>
                  </a>
                )}
                <a href="#denemeye-atla">
                  <Button variant="outline" size="sm" leftIcon={<PlayCircle className="size-4" />}>
                    Video Çözümlere Git
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Book Metadata Facts Sheet */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground block">Yazar</span>
              <span className="font-heading font-bold text-sm text-foreground block truncate">
                {book.authorNames.join(", ") || "Murat Şenocak"}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground block">Yayınevi</span>
              <span className="font-heading font-bold text-sm text-foreground block truncate">
                {book.publisherName}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground block">Deneme / Sayfa</span>
              <span className="font-heading font-bold text-sm text-foreground block">
                {book.denemeCount} Deneme &bull; {book.pageCount} Sayfa
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground block">ISBN-13</span>
              <span className="font-mono font-bold text-xs text-primary block truncate">
                {book.isbn13}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN WORKBENCH SECTION */}
      <main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">
        <section className="space-y-6">
          <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Video className="size-3.5" />}>
                  İnteraktif Çözüm Tezgahı
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">1–40 Deneme Soru Havuzu</span>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-1">
                Soru Bazlı Video Çözüm &amp; Zaman Çizelgesi
              </h2>
            </div>
          </div>

          {/* Jump Strip Navigation */}
          <nav id="denemeye-atla" className={styles.jump} aria-labelledby="denemeye-atla-heading">
            <h3 id="denemeye-atla-heading" className={styles.jumpHeading}>
              {t("jumpHeading")}
            </h3>
            <ul role="list" className={styles.jumpList}>
              {jumpNumbers.map((no) => {
                const covered = coveredDenemeNumbers.has(no);
                return (
                  <li key={no}>
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

          {/* Video Bench Player and Question Matrix */}
          {defaultDenemeNo !== null && (
            <VideoBench
              className={styles.workbench}
              indexClassName={styles.index}
              videos={benchVideos}
              defaultDenemeNo={defaultDenemeNo}
            >
              {videoStates.map(({ video, state }) => {
                const playable = isPlayable(state);
                return (
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
                      <span className={styles.denemeFacts}>
                        <span>{t("denemeQuestionCount", { count: video.questions.length })}</span>
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

        {/* DATA SOURCES & CITATIONS (KAYNAKÇA) */}
        <V2SourcesSection scope="kitaplar" />
      </main>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
