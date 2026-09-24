import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageContainer } from "./page-container";
import { StatGrid } from "./stat-grid";

/**
 * The loading state of a reading page, and the pieces it is made of.
 *
 * Every piece mirrors one T-035 component's measured geometry — `PageHero`, `StatTile`,
 * `StatGrid`, the explorer plates — so that the content which replaces it lands in the same box.
 * A `loading.tsx` renders `PageSkeleton` with the shape its family of pages has; a Suspense
 * fallback inside a page renders one piece. Because both draw from this file, the swap from the
 * route-level skeleton to the page shell with its section fallbacks moves nothing.
 *
 * Only `bg-muted` (through `Skeleton`) — never `bg-card` or `border-border`. The card counters in
 * `components/v2/page-composition-cards.test.ts` walk `components/patterns/` too, and a skeleton
 * that borrowed a card's tokens would enter them as a hand-drawn card.
 *
 * `useTranslations`, not `getTranslations`: a Suspense fallback must not itself suspend, and the
 * sync hook is legal in a Server Component (`map-attribution.tsx` is the precedent).
 */

const PLATE_ASPECT = {
  /** `V2EarthquakeExplorer`, `V2MarineMapExplorer`, `V2TurkeyMapExplorer`, `V2ToolWorkbench`,
   *  `V2ProvinceLocatorMap`, `V2RegionLocatorMap`. */
  map: "aspect-[1270/580]",
  /** `V2ContinentLocatorMap`. */
  continent: "aspect-[1000/521]",
  /** `V2GameScreen`'s figure plate. */
  game: "aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]",
} as const;

export type PlateAspect = keyof typeof PLATE_ASPECT;
export type PageSkeletonShape = "hub" | "detail" | "account" | "auth" | "play";

interface Announce {
  /** `false` inside a tree that already carries one `role="status"`. */
  readonly announce?: boolean;
  /** No escape hatch — the rule `PageContainer`, `PageHero` and `StatTile` carry. */
  readonly className?: never;
}

function Status({
  announce,
  as: Tag = "div",
  children,
}: {
  announce: boolean;
  /** `span` for a piece that renders inside a `<p>` — a `<div>` there is invalid HTML. */
  as?: "div" | "span";
  children: ReactNode;
}) {
  const t = useTranslations("Common");
  if (!announce) return <>{children}</>;
  return (
    <Tag role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      {children}
    </Tag>
  );
}

function Bar({ className }: { className: string }) {
  return <Skeleton aria-hidden="true" className={className} />;
}

export function BreadcrumbsSkeleton(_props: { readonly className?: never }) {
  return (
    <div className="flex items-center gap-2 text-xs" aria-hidden="true">
      <Bar className="h-3 w-16" />
      <Bar className="h-3 w-3 rounded-full" />
      <Bar className="h-3 w-24" />
    </div>
  );
}

export function StatTileSkeleton({ announce = true }: Announce) {
  return (
    <Status announce={announce}>
      <div data-skeleton="stat-tile" className="flex flex-col rounded-2xl bg-muted/40 p-4">
        <Bar className="h-8 w-20 sm:h-9" />
        <Bar className="mt-1.5 h-4 w-28" />
      </div>
    </Status>
  );
}

export function HeroSkeleton({
  tier,
  tiles = 0,
  announce = true,
}: Announce & { readonly tier: "hub" | "detail"; readonly tiles?: 0 | 2 | 4 }) {
  const heading = tier === "hub" ? "h-9 w-3/4 sm:h-12" : "h-10 w-2/3 sm:h-[60px]";
  const body = (
    <>
      <div className="relative z-10 max-w-3xl space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="h-6 w-32 rounded-full" />
        </div>
        <Bar className={heading} />
        <div className="space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
        </div>
      </div>
      {tiles > 0 ? (
        <StatGrid columns={tiles === 2 ? "2" : "2-4"} gutter="hero">
          {Array.from({ length: tiles }, (_, i) => (
            <StatTileSkeleton key={i} announce={false} />
          ))}
        </StatGrid>
      ) : null}
    </>
  );
  return (
    <Status announce={announce}>
      {tier === "hub" ? <Card variant="feature">{body}</Card> : body}
    </Status>
  );
}

export function PlateSkeleton({
  aspect,
  announce = true,
}: Announce & { readonly aspect: PlateAspect }) {
  return (
    <Status announce={announce}>
      <Bar className={cn("w-full rounded-2xl", PLATE_ASPECT[aspect])} />
    </Status>
  );
}

export function ProseSkeleton({
  lines,
  heading = true,
  announce = true,
}: Announce & { readonly lines: 2 | 3 | 4 | 6; readonly heading?: boolean }) {
  return (
    <Status announce={announce}>
      <div className="space-y-3">
        {heading ? <Bar className="h-7 w-1/2" /> : null}
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </Status>
  );
}

const GRID_COLUMNS = {
  "2": "grid-cols-1 sm:grid-cols-2",
  "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  "2-4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function CardGridSkeleton({
  columns,
  count,
  announce = true,
}: Announce & { readonly columns: keyof typeof GRID_COLUMNS; readonly count: number }) {
  return (
    <Status announce={announce}>
      <div className={cn("grid gap-5", GRID_COLUMNS[columns])}>
        {Array.from({ length: count }, (_, i) => (
          <Bar key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    </Status>
  );
}

const INLINE_WIDTH = { sm: "w-16", md: "w-32", lg: "w-56" } as const;

/**
 * One line of text still in flight — a lede variant, a stat trio, a footer credit. Renders a
 * `<span>`, not the `Skeleton` div, because its callers put it inside a `<p>` (`PageHero`'s lede).
 * The class string is `Skeleton`'s own three tokens; `components/ui/skeleton.tsx` is CLI-managed
 * and cannot grow an `as` prop without risking an overwrite.
 */
export function InlineSkeleton({
  width,
  announce = true,
}: Announce & { readonly width: keyof typeof INLINE_WIDTH }) {
  return (
    <Status announce={announce} as="span">
      <span
        data-slot="skeleton"
        aria-hidden="true"
        className={cn(
          "inline-block h-4 align-middle animate-pulse rounded-md bg-muted",
          INLINE_WIDTH[width],
        )}
      />
    </Status>
  );
}

function HubShape() {
  return (
    <PageContainer>
      <div className="space-y-4">
        <BreadcrumbsSkeleton />
        <HeroSkeleton tier="hub" tiles={4} announce={false} />
      </div>
      <PlateSkeleton aspect="map" announce={false} />
    </PageContainer>
  );
}

function DetailShape() {
  return (
    <>
      <section className="relative overflow-hidden py-10 sm:py-14">
        <PageContainer space="band">
          <BreadcrumbsSkeleton />
          <HeroSkeleton tier="detail" tiles={4} announce={false} />
        </PageContainer>
      </section>
      <PageContainer space="default">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-8">
            <Bar className="h-64 rounded-3xl" />
            <Bar className="h-48 rounded-3xl" />
          </div>
          <div className="lg:col-span-4">
            <Bar className="h-96 rounded-3xl" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function AccountShape() {
  return (
    <PageContainer space="tight">
      <BreadcrumbsSkeleton />
      <div className="space-y-1.5">
        <Bar className="h-9 w-64 sm:h-12" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <CardGridSkeleton columns="2" count={4} announce={false} />
    </PageContainer>
  );
}

function AuthShape() {
  return (
    <PageContainer>
      <BreadcrumbsSkeleton />
      <HeroSkeleton tier="hub" announce={false} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 xl:col-span-5">
          <Bar className="h-[520px] rounded-3xl" />
        </div>
        <div className="lg:col-span-6 xl:col-span-7">
          <Bar className="h-[520px] rounded-3xl" />
        </div>
      </div>
    </PageContainer>
  );
}

function PlayShape() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BreadcrumbsSkeleton />
        <div className="flex gap-2">
          <Bar className="h-8 w-28 rounded-lg" />
          <Bar className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <Bar className="h-24 rounded-3xl" />
      <div className="space-y-5 rounded-3xl bg-muted/30 p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Bar key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <PlateSkeleton aspect="game" announce={false} />
      </div>
    </div>
  );
}

const SHAPES: Record<PageSkeletonShape, () => ReactNode> = {
  hub: HubShape,
  detail: DetailShape,
  account: AccountShape,
  auth: AuthShape,
  play: PlayShape,
};

export function PageSkeleton({
  shape,
}: {
  readonly shape: PageSkeletonShape;
  readonly className?: never;
}) {
  const Shape = SHAPES[shape];
  return (
    <Status announce>
      <Shape />
    </Status>
  );
}
