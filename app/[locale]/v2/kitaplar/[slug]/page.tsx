import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment } from "react";
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
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getBookBySlug, getBooksResilient } from "@/lib/api/books";
import { formatDuration } from "@/lib/book/duration";
import { PUBLISHED_DATE_FORMAT } from "@/lib/book/published-date";
import { tagFragment, videoFragment, videoTitle } from "@/lib/book/video-identity";
import { isPlayable, resolveVideoState } from "@/lib/book/video-state";
import type { BookDetail, BookListItem } from "@/lib/api/types";
import { bookJsonLd, JsonLd, videoObjectJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  BookOpen,
  Video,
  Home,
  ChevronRight,
  ExternalLink,
  ShoppingBag,
  PlayCircle,
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
    surface: "noindex",
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

  // No book-level count is published any more (P0 generic-catalogue cut-over, `DEC 2026-09-10c`
  // md.1), so the jump strip is derived entirely from the blocks that actually render — see the
  // primary `/kitaplar/[slug]` page's own comment for the full reasoning.
  const jumpNumbers = videoStates.map(({ video }) => video.orderNo);

  const benchVideos: BenchVideo[] = videoStates.map(({ video, state }) => ({
    orderNo: video.orderNo,
    bookVideoId: video.bookVideoId,
    titleTr: video.titleTr,
    titleEn: video.titleEn,
    playable: isPlayable(state),
    tags: video.tags.map((tag) => ({
      orderNo: tag.orderNo,
      second: tag.startSecond,
      nameTr: tag.nameTr,
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

  const defaultOrderNo = benchVideos[0]?.orderNo ?? null;

  const attributionRows = book.attribution.filter(
    (row) => row.providerId !== "youtube" || book.videos.length > 0,
  );

  const videoSchemas = videoStates.flatMap(({ video, state }) => {
    if (state.kind !== "rich") return [];
    const schema = videoObjectJsonLd({
      name: `${title} — ${videoTitle(t, locale, video)}`,
      thumbnailUrl: state.youtube.thumbnailUrl,
      uploadDate: state.youtube.publishedAtUtc,
      duration: state.youtube.durationIso,
      // NO embedUrl (P2, Option C — `DEC 2026-09-09b` md.2/md.4). Same reasoning as the
      // primary `/kitaplar/[slug]` page: the anonymous payload no longer carries the video id,
      // and this page's api call is the same SSG/ISR-cached one, so there is no address to
      // give the builder on any request.
    });
    return schema === null ? [] : [schema];
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 pb-20">
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
      <section className="relative border-b border-border bg-gradient-to-b from-primary/5 via-background to-background pt-6 sm:pt-10 pb-10 overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl relative z-10 space-y-6">
          {/* Breadcrumb Navigation */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap"
          >
            <Link
              href="/v2"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Home className="size-3.5" />
              <span>Ana Sayfa</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <Link href="/v2/kitaplar" className="hover:text-foreground transition-colors">
              Video Çözümlü Kitaplar
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-foreground font-semibold truncate max-w-xs">{title}</span>
          </nav>

          {/* Book Hero Card */}
          <div className="flex flex-col md:flex-row gap-8 items-start bg-card border border-border p-6 sm:p-8 rounded-3xl shadow-lg">
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
                  {book.examTrack}
                </Badge>
              </div>

              <h1 className="font-heading text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                {title}
              </h1>

              {introText && (
                <div className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  <ProseNote text={introText} className="space-y-2" />
                </div>
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
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<ShoppingBag className="size-4" />}
                      rightIcon={<ExternalLink className="size-3.5 opacity-70" />}
                    >
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
              <span className="text-[11px] text-muted-foreground font-medium block">Yazarlar</span>
              <span className="font-heading font-bold text-sm text-foreground block truncate mt-0.5">
                {book.authorNames.join(", ") || "Murat Karagöz, Murat Çakır"}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Yayınevi</span>
              <span className="font-heading font-bold text-sm text-foreground block truncate mt-0.5">
                {book.publisherName}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Kapsam</span>
              <span className="font-heading font-bold text-sm text-foreground block mt-0.5">
                {book.pageCount} Sayfa
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">ISBN-13</span>
              <span className="font-mono font-bold text-xs text-primary block truncate mt-0.5">
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
                  İnteraktif Video Çözüm Tezgâhı
                </Badge>
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
              {jumpNumbers.map((no) => (
                <li key={no}>
                  <a className={styles.jumpItem} href={`#${videoFragment(no)}`}>
                    <span className={styles.srOnly}>{t("videoFallbackHeading", { no })}</span>
                    <span aria-hidden="true">{no}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Video Bench Player and Question Matrix (With Auth Gating) */}
          {defaultOrderNo !== null && (
            <VideoBench
              className={styles.workbench}
              indexClassName={styles.index}
              videos={benchVideos}
              defaultOrderNo={defaultOrderNo}
            >
              {videoStates.map(({ video, state }) => {
                const playable = isPlayable(state);
                return (
                  <article
                    key={video.orderNo}
                    className={styles.deneme}
                    aria-labelledby={videoFragment(video.orderNo)}
                    data-deneme={video.orderNo}
                  >
                    <div className={styles.denemeHead}>
                      <h3 id={videoFragment(video.orderNo)} className={styles.denemeHeading}>
                        {videoTitle(t, locale, video)}
                      </h3>
                      <span className={styles.denemeFacts}>
                        <span>{t("videoTagCount", { count: video.tags.length })}</span>
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
                      {video.tags.map((tag) => {
                        const fragment = tagFragment(video.orderNo, tag, video.tags);
                        return (
                          <li key={tag.orderNo}>
                            <a
                              id={fragment}
                              href={`#${fragment}`}
                              className={styles.questionLink}
                              data-second={tag.startSecond}
                              aria-label={
                                playable
                                  ? t("tagLabelAria", {
                                      no: tag.orderNo,
                                      time: formatDuration(tag.startSecond),
                                    })
                                  : undefined
                              }
                            >
                              {t("tagLabel", { no: tag.orderNo })}
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

        {/* OFFICIAL ATTRIBUTION AND PARTNER NOTICES */}
        {attributionRows.length > 0 && (
          <div className="p-4 rounded-2xl bg-card border border-border/80 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground">{t("sourcesLabel")}:</span>
            {attributionRows.map((row, index) => (
              <Fragment key={row.providerId}>
                {index > 0 && <span aria-hidden="true"> &bull; </span>}
                {row.providerId === "youtube" && row.channelUrl !== null ? (
                  <a
                    className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                    href={row.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Image
                      src="/marka/yt_icon_red_digital.png"
                      alt=""
                      width={1255}
                      height={1075}
                      sizes="24px"
                      className="w-4 h-auto inline-block"
                    />
                    <span lang="tr">{row.requiredNoticeTr}</span>
                    <ExternalLink className="size-3 opacity-60 ml-0.5" />
                  </a>
                ) : (
                  <span lang="tr">{row.requiredNoticeTr}</span>
                )}
              </Fragment>
            ))}
          </div>
        )}

        {/* SCIENTIFIC DATA SOURCES & CITATIONS (KAYNAKÇA) */}
        <V2SourcesSection scope="kitaplar" />
      </main>

      {/* Modern V2 Footer */}
      <V2Footer />
    </div>
  );
}
