import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { V2LiveTicker } from "@/components/v2/v2-live-ticker";
import { V2SourcesSection } from "@/components/v2/v2-sources-section";
import type { BenchVideo } from "@/components/book/bench-stage";
import { DenemeMeta } from "@/components/book/deneme-meta";
import { VideoBench } from "@/components/book/video-bench";
import { ProseNote } from "@/components/prose-note";
import { PageContainer } from "@/components/patterns/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/patterns/breadcrumbs";
import { routing, type Locale } from "@/i18n/routing";
import { getBookBySlug, getBooksResilient } from "@/lib/api/books";
import { formatDuration } from "@/lib/book/duration";
import { PUBLISHED_DATE_FORMAT } from "@/lib/book/published-date";
import { tagFragment, videoFragment, videoTitle } from "@/lib/book/video-identity";
import { isPlayable, resolveVideoState } from "@/lib/book/video-state";
import type { BookDetail, BookListItem } from "@/lib/api/types";
import { bookJsonLd, JsonLd, videoObjectJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BookOpen, Video, Home, ExternalLink, ShoppingBag, PlayCircle } from "lucide-react";
export const revalidate = 86400;

/**
 * `book-detail.module.css`'s fourteen live classes, in bridge tokens (T-033 task 8).
 *
 * ## Why they are hoisted rather than written inline
 *
 * This page lives under `app/`, and `vitest.config.ts` includes only `lib/`, `components/` and
 * `tools/`. Nothing under this directory is ever executed by a test, so the floors below have no
 * unit cover of their own and the census that used to hold two of them
 * (`components/css-module-fixed-widths.test.ts`) can only read CSS Modules. What replaces both is
 * `components/book/book-detail-floors.test.ts`, which reads THIS FILE's source — and
 * `lib/test-support/converted-floor.ts`'s extractor finds a value only in a top-level
 * `const NAME = "…";`. A floor left inline on a JSX `className` hands it back `null` and every
 * assertion built on it asserts nothing, silently. Hoisting is therefore the precondition for the
 * pin, not a style preference.
 *
 * ## The colour mapping, and the two places it is not the plan's first column
 *
 * `--color-border` → `border-border`, `--color-slate` → `text-muted-foreground`,
 * `--color-primary` → `border-primary`, `#fff` → `bg-card`: all four are the same paint in light
 * mode as the rule they replace. Two are the refinements tasks 3, 4, 6 and 7 already measured
 * and landed:
 *
 * · `--color-primary-dark` → `text-primary-strong`, not `text-primary`. `--primary-strong` IS
 *   `var(--color-primary-dark)` in the light block (`app/globals.css`), so #7e3a1e does not move;
 *   `text-primary` would have re-coloured every heading and tile label to #b0522e for no reason.
 * · `--color-surface` → `bg-muted`, not the table's `bg-card`. `--muted` is #f1e9de in light —
 *   the same paint `--color-surface` is — and `bg-card` is what the tile is ALREADY filled with,
 *   so mapping the hover to it would have deleted the hover rather than translated it.
 *
 * `--color-taupe` → `text-muted-foreground` is the one deliberate colour change: the fact strip's
 * separator dot goes #8a8078 → #57504a in light. It is `aria-hidden` decoration, taupe measured
 * 3.64:1 on `--color-bg` (sub-AA, which is what the token's own rule says it is for), and the
 * SECOND dot on that same line — `DenemeMeta`'s, converted in task 7 — is already
 * `text-muted-foreground`. The two dots agree now; before this they did not.
 *
 * ## Sizes are arbitrary, and that is deliberate
 *
 * `text-[0.95rem]`, `text-[1.05rem]` and `text-[0.85rem]` rather than `text-sm`/`text-base`: a
 * named Tailwind size carries a line-height the stylesheet never set. Measured on this page — the
 * fact strip inherits 1.6 from `body` and renders 13.6px/21.76px, where `text-sm` would make it
 * 14px/20px and reflow all thirty rows; the two headings take 1.15 from `@layer base`'s heading
 * rule and render 15.2px/17.48px and 16.8px/19.32px.
 */

/** The jump strip's own block. `<nav>` has no UA margin, so `mb-6` is the whole rule. */
const JUMP = "mb-6";

/**
 * `mb-2.5` and NOT `m-0 mb-2.5`: `@layer base` already gives every heading `margin: 0 0 0.5em`,
 * so top/right/left are 0 before this class is applied and only the bottom (7.6px → 10px) moves.
 * `.denemeHeading` below is the opposite case and does need its `m-0`.
 */
const JUMP_HEADING = "font-heading text-[0.95rem] text-primary-strong mb-2.5";

/**
 * INTRINSIC, NOT A BREAKPOINT — the rule the stylesheet's own comment made and this keeps.
 * `docs/design.md` pins ONE breakpoint (64rem) and forbids a second without a measurement in both
 * locales; `auto-fill` + `minmax` sets the column count from the available width instead.
 *
 * `min(2.75rem,100%)` and not a bare 2.75rem: a floor wider than the container keeps its width
 * and pushes the row past the viewport, which is the horizontal overflow the 320px sweep exists
 * to catch. Pinned in `components/book/book-detail-floors.test.ts`.
 */
const JUMP_LIST =
  "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(2.75rem,100%),1fr))] gap-1.5 p-0";

/**
 * 44×44, WCAG 2.2 §2.5.5 (AAA) rather than the 24×24 §2.5.8 floor — `docs/design.md`'s "controls
 * with room to be generous" class, the same call the question cells below make. `tabular-nums` so
 * two-digit numbers sit on one optical grid rather than jittering.
 *
 * `hover:bg-muted`, not `hover:bg-card`: see the mapping note above. `rounded-lg` is
 * `var(--radius-lg)`, which is `var(--radius)`, which is the 10px the stylesheet asked for.
 */
const JUMP_ITEM =
  "flex min-h-11 items-center justify-center rounded-lg border border-border bg-card p-1 " +
  "text-[0.95rem] font-semibold tabular-nums text-primary-strong no-underline " +
  "hover:border-primary hover:bg-muted";

/**
 * TWO COLUMNS FROM 64rem, ONE BELOW IT, and `lg:` IS that 64rem — Tailwind's default `lg`
 * breakpoint, unchanged in this repo's `@theme`. No second breakpoint is introduced.
 *
 * THE 40% IS DERIVED, NOT PICKED, and the derivation is unchanged from the rule this replaces:
 * the stage must stay at least 200×200 (the provider's Required Minimum Functionality floor) and
 * the index's six question cells must sit on one row, which at the 88px cell floor plus the 6px
 * gap needs 6×88 + 5×6 = 558px of index column. At the narrowest two-column viewport (1024px →
 * 984px of content, minus the 24px gap) a 40% stage leaves the index 566px.
 *
 * NO `overflow` ANYWHERE ON THIS CHAIN, and that is load-bearing rather than tidy: `position:
 * sticky` resolves against the nearest scrollport, so an ancestor with `overflow: hidden` would
 * silently kill the sticky stage with nothing erroring.
 *
 * `items-start` computes to `flex-start` where the stylesheet wrote `start`. The two are the same
 * alignment in grid layout, and it is measured rather than assumed: every box on this page is
 * identical before and after at all four widths, both themes and both session states.
 */
const WORKBENCH = "grid items-start gap-6 lg:grid-cols-[minmax(0,40%)_minmax(0,1fr)]";

/** `min-w-0` so a long row inside the grid item cannot push the column past its track — a grid
 *  item's default `min-width: auto` is what lets that happen silently. */
const INDEX = "min-w-0";

/**
 * Hairlines between rows rather than a box around the list, and NO horizontal padding: at 320px
 * the four pixels a side the accordion used to carry decided whether three question cells fit on
 * a line or two (three cells at the 88px floor need 276px; the inset left 272px).
 */
const DENEME = "block border-t border-border pt-2.5 pb-3 last-of-type:border-b";

/** THE ROW HEAD — heading and fact strip on one wrapping line. `gap-x-3`/`gap-y-0.5` are the
 *  stylesheet's 12px column gap and 2px row gap. */
const DENEME_HEAD = "flex flex-wrap items-baseline gap-x-3 gap-y-0.5";

/**
 * `m-0` IS LOAD-BEARING HERE, unlike on `JUMP_HEADING`: `@layer base` gives every heading
 * `margin: 0 0 0.5em`, so without it this `<h3>` takes an 8.4px bottom margin the stylesheet's
 * `margin: 0` was cancelling, and every one of the thirty rows grows by it.
 *
 * `scroll-mt-[…]` has ONE addend. `#video-12` is an IA fragment, so the target has to land below
 * the sticky header at every viewport; the accordion's open row was `position: sticky` and needed
 * a second addend, and that row is gone. `components/anchor-offset-token.test.ts` is the tripwire
 * for the failure mode that makes this silent — `var()` on an undefined property invalidates the
 * whole `calc()`, the declaration is dropped, and the offset becomes zero with nothing erroring.
 *
 * `min-w-[6.5rem]` = 104px, A FIXED FLOOR SO EVERY ROW WRAPS THE SAME WAY, and the number is
 * measured rather than picked: Fraunces' digits are proportional and span 86.6px ("Deneme 1") to
 * 102.4px ("Deneme 40"), which put 25 rows on two lines and 5 on one in no order a reader could
 * infer. `font-variant-numeric: tabular-nums` was tried first and rejected — the computed style
 * applies but the widths do not move, because the self-hosted Fraunces subset carries no `tnum`
 * feature. Pinned in `components/book/book-detail-floors.test.ts`.
 */
const DENEME_HEADING =
  "m-0 min-w-[6.5rem] scroll-mt-[calc(var(--header-height)+1rem)] font-heading " +
  "text-[1.05rem] text-primary-strong";

/**
 * THE FACT STRIP, and the wrapping here is its OWN rather than the row's. The heading-and-strip
 * pair wraps on `DENEME_HEAD`'s line; `flex-wrap` on this element is what lets the three facts
 * break INSIDE the strip when the strip alone overruns the line — the English page at 320px,
 * where the row is three lines tall rather than two.
 *
 * `text-muted-foreground` is `--color-slate`'s bridge: measured **7.48:1 light / 8.53:1 dark** on
 * the page's `--background`, which is what this strip actually sits on — neither the row nor the
 * index around it paints a fill. The retired raw token measured 2.36:1 in dark.
 */
const DENEME_FACTS = "flex flex-wrap items-baseline gap-1.5 text-[0.85rem] text-muted-foreground";

/** The decorative dot. THE SAME SPELLING `components/book/deneme-meta.tsx`'s `META_SEPARATOR`
 *  carries, and the two sit on ONE line inside one fact strip, so a separator that drifted in one
 *  file would split that line into two colours — which is exactly what the retired
 *  `--color-taupe` was doing. Both are `aria-hidden` decorative marks. */
const FACT_SEPARATOR = "text-muted-foreground";

/**
 * THE CELL FLOOR IS MEASURED IN BOTH LOCALES, and the two do not agree — which is why it is a
 * floor rather than a fixed width. At the used face and size (600 13.6px Nunito Sans) the label
 * measures 41.0px in Turkish (`Soru 1`) and 71.0px in English (`Question 1`), so with 6px×2
 * padding and 1px×2 border a cell needs 59px in TR and **85px in EN**. English is the binding
 * case. `auto-fit` and not `auto-fill`: `auto-fill` keeps an empty track and leaves a seventh
 * cell's worth of hole on the right, where `auto-fit` collapses it and the six stretch to fill.
 *
 * `mx-0 mb-0` beside `mt-2` rather than `mt-2` alone: the stylesheet wrote `margin: 8px 0 0` on a
 * `<ul>`, whose UA margin is block-axis `1em`. Spelling out the three zeros is what keeps this a
 * translation rather than a bet on preflight.
 *
 * This is the one declaration `components/css-module-fixed-widths.test.ts` was still pinning when
 * the file went; it is pinned in `components/book/book-detail-floors.test.ts` now, bidirectionally.
 */
const QUESTION_GRID =
  "mt-2 mx-0 mb-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(88px,100%),1fr))] " +
  "gap-1.5 p-0";

/**
 * 44px KEPT, and kept deliberately against the mockup that proposed 36px. WCAG 2.2 §2.5.8 (AA)
 * would allow 24×24 and 36 would have passed it, but `docs/design.md` puts this class in the
 * "controls with room to be generous" bucket that takes §2.5.5 (AAA) 44×44, and a page that is
 * mostly these controls is the last place to spend that. The page-length saving is taken from the
 * WIDTH instead (see the floor above), which costs a reader nothing.
 *
 * `p-1.5` is 6px, not 8: the two pixels are what put the English label's requirement at 85px
 * instead of 89px, and 89 was a third of a pixel too wide for the 1024px index column.
 *
 * `scroll-mt-[…]` for the same reason `DENEME_HEADING` carries it — `#video-12-etiket-3` is an IA
 * fragment and this element carries the id, so this is the element that has to end up visible
 * below the site header.
 */
const QUESTION_LINK =
  "flex min-h-11 items-center justify-center scroll-mt-[calc(var(--header-height)+1rem)] " +
  "rounded-lg border border-border bg-card p-1.5 text-[0.85rem] font-semibold " +
  "text-primary-strong no-underline hover:border-primary hover:bg-muted";

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

      <V2LiveTicker />

      {/* HERO BANNER SECTION */}
      <section className="relative border-b border-border bg-gradient-to-b from-primary/5 via-background to-background pt-6 sm:pt-10 pb-10 overflow-hidden">
        <PageContainer space="band">
          {/* Breadcrumb Navigation */}
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/", path: "/", icon: <Home className="size-3.5" /> },
              { label: "Video Çözümlü Kitaplar", href: "/kitaplar", path: "/kitaplar" },
              { label: title, path },
            ]}
            locale={locale}
            surface="trOnly"
          />

          {/* Book Hero Card */}
          <div className="flex flex-col md:flex-row gap-8 items-start bg-card border border-border p-6 sm:p-8 rounded-3xl shadow-lg">
            {/* Book Cover Image. The alt comes from the catalogue, never a literal: the V2
                rewrite hardcoded the Turkish wording, so the English page read
                "<title> kapak görseli". */}
            {book.coverImagePath && (
              <div className="relative w-36 sm:w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border border-border/80 shrink-0 bg-muted">
                <Image
                  src={book.coverImagePath}
                  alt={t("coverAlt", { title })}
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
        </PageContainer>
      </section>

      {/* BODY. T-046: this page carried no body container at all. T-032 (`d2039b6`) de-nested
          the `<main>` landmark into `(site)/layout.tsx` and deleted the
          `<main className="container mx-auto px-4 max-w-7xl py-10 space-y-12">` that used to
          wrap everything below the hero, without replacing the width, the padding or the
          rhythm — so the body rendered edge-to-edge at viewport width with no gutter. `default`
          is 56px between sections where the deleted wrapper was 48px: `PageContainer`'s rhythm
          union is closed on purpose and has no 48px member, and reopening it for 8px would
          reopen the passthrough it exists to close. */}
      <PageContainer space="default">
        {/* MAIN WORKBENCH SECTION */}
        <section className="space-y-6">
          <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm" icon={<Video className="size-3.5" />}>
                  İnteraktif Video Çözüm Merkezi
                </Badge>
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-1">
                Soru Bazlı Video Çözüm &amp; Zaman Çizelgesi
              </h2>
            </div>
          </div>

          {/* Jump Strip Navigation */}
          <nav id="denemeye-atla" className={JUMP} aria-labelledby="denemeye-atla-heading">
            <h3 id="denemeye-atla-heading" className={JUMP_HEADING}>
              {t("jumpHeading")}
            </h3>
            <ul role="list" className={JUMP_LIST}>
              {jumpNumbers.map((no) => (
                <li key={no}>
                  <a className={JUMP_ITEM} href={`#${videoFragment(no)}`}>
                    <span className="sr-only">{t("videoFallbackHeading", { no })}</span>
                    <span aria-hidden="true">{no}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Video Bench Player and Question Matrix (With Auth Gating) */}
          {defaultOrderNo !== null && (
            <VideoBench
              className={WORKBENCH}
              indexClassName={INDEX}
              videos={benchVideos}
              defaultOrderNo={defaultOrderNo}
              bookSlug={book.slugTr}
            >
              {videoStates.map(({ video, state }) => {
                const playable = isPlayable(state);
                return (
                  <article
                    key={video.orderNo}
                    className={DENEME}
                    aria-labelledby={videoFragment(video.orderNo)}
                    data-deneme={video.orderNo}
                  >
                    <div className={DENEME_HEAD}>
                      <h3 id={videoFragment(video.orderNo)} className={DENEME_HEADING}>
                        {videoTitle(t, locale, video)}
                      </h3>
                      <span className={DENEME_FACTS}>
                        <span>{t("videoTagCount", { count: video.tags.length })}</span>
                        {state.kind === "rich" && (
                          <>
                            <span className={FACT_SEPARATOR} aria-hidden="true">
                              ·
                            </span>
                            <DenemeMeta state={state} />
                          </>
                        )}
                      </span>
                    </div>

                    <ul role="list" className={QUESTION_GRID}>
                      {video.tags.map((tag) => {
                        const fragment = tagFragment(video.orderNo, tag, video.tags);
                        return (
                          <li key={tag.orderNo}>
                            <a
                              id={fragment}
                              href={`#${fragment}`}
                              className={QUESTION_LINK}
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
      </PageContainer>
    </>
  );
}
