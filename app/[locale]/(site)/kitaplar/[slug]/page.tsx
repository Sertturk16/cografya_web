import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { BenchVideo } from "@/components/book/bench-stage";
import { MarkerPanels } from "@/components/book/marker-panels";
import { VideoBench } from "@/components/book/video-bench";
import { WorkbenchList } from "@/components/book/workbench-list";
import { ProseNote } from "@/components/prose-note";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { PageContainer } from "@/components/patterns/page-container";
import { routing, type Locale } from "@/i18n/routing";
import { getBookBySlug, getBooksResilient } from "@/lib/api/books";
import { formatDuration } from "@/lib/book/duration";
import { PUBLISHED_DATE_FORMAT } from "@/lib/book/published-date";
import { videoTitle } from "@/lib/book/video-identity";
import { isPlayable, resolveVideoState } from "@/lib/book/video-state";
import { isNamed } from "@/lib/book/workbench-model";
import type { BookDetail, BookListItem } from "@/lib/api/types";
import { bookJsonLd, JsonLd, videoObjectJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { ExternalLink, Home } from "lucide-react";
export const revalidate = 86400;

/**
 * The book page (T-128): a one-screen workbench — the book bar, the video list and the stage with
 * its marker strip — followed by the book's own information and the source credits.
 *
 * Everything a crawler or a reader without JavaScript needs is server markup: `WorkbenchList`
 * and `MarkerPanels` render every video row and every marker of every video as real fragment
 * links, and they are handed to the `VideoBench` island as finished trees. The island only moves
 * attributes on them (see its docblock). `#kitap-bilgisi` holds the intro prose and the four
 * fact cards, unchanged in content, below the workbench rather than above it.
 */

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
      pathname: "/kitaplar/[slug]",
      params: { slug: slugForLocale(book, l) },
    }),
    // `metaTitleTr`/`metaDescriptionTr` render verbatim on BOTH locales on purpose (API
    // contract docblock, `lib/api/schema.ts`): a Turkish exam-prep book's own title/description
    // has no EN counterpart by owner ruling, so the EN page renders the TR book content rather
    // than inventing a translation.
    //
    // The trailing chrome label is gone rather than localized: it said "V2 Kitaplar", naming a
    // route prefix T-032 PR3 retired, and it sat in front of the root layout's own
    // `%s · Coğrafya Gurmesi` template — two brand suffixes for one title.
    title: book.metaTitleTr,
    description: book.metaDescriptionTr,
    openGraphType: "article",
    // T-032 PR3: this page lived under `/v2`, whose layout marked the whole tree
    // `noindex`. It now serves the canonical URL, so it carries the surface its V1
    // counterpart did — `app/sitemap.ts` already publishes this URL, and a `noindex`
    // page in the sitemap is a SEO-POLICY B6 6.8 blocker.
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
  const path = `/kitaplar/${slugForLocale(book, locale)}`;

  const introText = locale === "tr" ? book.introTr : null;
  const videoStates = book.videos.map((video) => ({ video, state: resolveVideoState(video) }));

  const kind = book.contentKind;

  const benchVideos: BenchVideo[] = videoStates.map(({ video, state }) => ({
    orderNo: video.orderNo,
    bookVideoId: video.bookVideoId,
    titleTr: video.titleTr,
    titleEn: video.titleEn,
    groupTitleTr: video.groupTitleTr,
    label: videoTitle(t, locale, video, kind),
    markerCount: video.tags.length,
    durationSeconds: state.kind === "rich" ? state.youtube.durationSeconds : null,
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

  const defaultOrderNo = benchVideos[0]?.orderNo;
  const namedKey = (video: BenchVideo) => (isNamed(video.tags) ? "yes" : "no");
  const totalMarkers = benchVideos.reduce((sum, video) => sum + video.markerCount, 0);
  const anyNamed = benchVideos.some((video) => isNamed(video.tags));

  const attributionRows = book.attribution.filter(
    (row) => row.providerId !== "youtube" || book.videos.length > 0,
  );

  const videoSchemas = videoStates.flatMap(({ video, state }) => {
    if (state.kind !== "rich") return [];
    const schema = videoObjectJsonLd({
      name: `${title} — ${videoTitle(t, locale, video, book.contentKind)}`,
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
    <>
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

      {defaultOrderNo !== undefined && (
        <VideoBench
          videos={benchVideos}
          kind={kind}
          bookSlug={book.slugTr}
          barProps={{
            title,
            coverImagePath: book.coverImagePath,
            coverAlt: t("coverAlt", { title }),
            examTrack: book.examTrack,
            summary: t("bookSummary", {
              count: benchVideos.length,
              kind,
              markers: totalMarkers,
              named: anyNamed ? "yes" : "no",
            }),
            infoLabel: t("bookInfo"),
            purchaseUrl: book.purchaseUrl,
            purchaseLabel: t("purchase"),
            purchaseAria: t("purchaseAria"),
          }}
          list={
            <WorkbenchList
              videos={benchVideos}
              listLabel={t("listLabel", { kind })}
              markerCountLabel={(video) =>
                t("markerCount", { count: video.markerCount, named: namedKey(video) })
              }
              onYoutubeLabel={t("onYoutube")}
              doneLabel={t("statusDone")}
              partLabel={t("statusPart")}
            />
          }
          markers={
            <MarkerPanels
              videos={benchVideos}
              defaultOrderNo={defaultOrderNo}
              markerLabel={(tag) => tag.nameTr ?? t("tagLabel", { no: tag.orderNo })}
              markerAria={(tag) =>
                tag.nameTr === null
                  ? t("tagLabelAria", { no: tag.orderNo, time: formatDuration(tag.second) })
                  : t("tagNamedAria", { name: tag.nameTr, time: formatDuration(tag.second) })
              }
              panelLabel={(video) => video.label}
            />
          }
        />
      )}

      <PageContainer space="default">
        <section
          id="kitap-bilgisi"
          aria-labelledby="kitap-bilgisi-heading"
          className="scroll-mt-[calc(var(--header-height)+1rem)] space-y-6"
        >
          {/* The breadcrumb trail and its BreadcrumbList sit here since T-128: the book bar
              replaced the hero it used to open, and the header nav already carries "Kitaplar". */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Kitaplar", href: "/kitaplar", path: "/kitaplar" },
              { label: title, path },
            ]}
            locale={locale}
            surface="trOnly"
          />
          <h2 id="kitap-bilgisi-heading">{t("bookInfo")}</h2>
          {introText && (
            <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <ProseNote text={introText} className="space-y-2" />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* NO `|| "Murat Karagöz, Murat Çakır"`. That fallback printed two real people as the
                authors of whichever book arrived without an author list — the same invention as
                `|| "Dünya Bankası"` on the country page, except the subject is a person. An em
                dash would be no better: a "Yazarlar" cell is itself the claim, so the cell goes.
                Its siblings already render raw values with no fallback, and the 2/4-column grid
                reflows. Same reasoning as the province page's Köppen row. */}
            {book.authorNames.length > 0 && (
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-medium block">
                  Yazarlar
                </span>
                <span className="font-heading font-bold text-sm text-foreground block truncate mt-0.5">
                  {book.authorNames.join(", ")}
                </span>
              </div>
            )}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Yayınevi</span>
              <span className="font-heading font-bold text-sm text-foreground block truncate mt-0.5">
                {book.publisherName}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">
                Sayfa sayısı
              </span>
              <span className="font-heading font-bold text-sm text-foreground block mt-0.5">
                {book.pageCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">ISBN-13</span>
              <span className="font-mono font-bold text-xs text-primary block truncate mt-0.5">
                {book.isbn13}
              </span>
            </div>
          </div>
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
      </PageContainer>
    </>
  );
}
