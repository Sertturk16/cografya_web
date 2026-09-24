import { Suspense, type ReactNode } from "react";
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
 * Skeleton BARS are `bg-muted` only — never `bg-card` or `border-border` on a bar — so nothing here
 * enters the hand-drawn card counters; the real `Card` primitive is allowed where the live page
 * renders one.
 *
 * `useTranslations`, not `getTranslations`: a Suspense fallback must not itself suspend, and the
 * sync hook is legal in a Server Component (`map-attribution.tsx` is the precedent).
 */

const PLATE_ASPECT = {
  /** `V2EarthquakeExplorer`, `V2MarineMapExplorer`, `V2ToolWorkbench`, `V2ProvinceLocatorMap`,
   *  `V2RegionLocatorMap`. */
  map: "aspect-[1270/580]",
  /** `V2ContinentLocatorMap`. */
  continent: "aspect-[1000/521]",
  /** `V2GameScreen`'s figure plate. */
  game: "aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]",
  /** `V2TurkeyMapExplorer` — a square on a phone, the shared 1270/580 plate from `sm`. */
  turkey: "aspect-square sm:aspect-[1270/580] sm:min-h-[420px]",
  /** `V2WorldMapExplorer`. */
  world: "aspect-[1008/520]",
} as const;

/** The plate's corner radius, mirroring its source. Every plate is `rounded-2xl` except the
 * world map, which is edge-to-edge on a phone (`rounded-none`) and gains the radius back from
 * `sm`. */
const PLATE_RADIUS: Record<keyof typeof PLATE_ASPECT, string> = {
  map: "rounded-2xl",
  continent: "rounded-2xl",
  game: "rounded-2xl",
  turkey: "rounded-2xl",
  world: "rounded-none sm:rounded-2xl",
};

export type PlateAspect = keyof typeof PLATE_ASPECT;
export type PageSkeletonShape = "auth" | "play";

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

export function BreadcrumbsSkeleton({}: { readonly className?: never }) {
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
  tiles = 0,
  announce = true,
}: Announce & { readonly tier: "hub"; readonly tiles?: 0 | 4 }) {
  const body = (
    <>
      <div className="relative z-10 max-w-3xl space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="h-6 w-32 rounded-full" />
        </div>
        <Bar className="h-9 w-3/4 sm:h-12" />
        <div className="space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
        </div>
      </div>
      {tiles > 0 ? (
        <StatGrid columns="2-4" gutter="hero">
          {Array.from({ length: tiles }, (_, i) => (
            <StatTileSkeleton key={i} announce={false} />
          ))}
        </StatGrid>
      ) : null}
    </>
  );
  return (
    <Status announce={announce}>
      <Card variant="feature">{body}</Card>
    </Status>
  );
}

export function PlateSkeleton({
  aspect,
  announce = true,
}: Announce & { readonly aspect: PlateAspect }) {
  return (
    <Status announce={announce}>
      <Bar className={cn("w-full", PLATE_RADIUS[aspect], PLATE_ASPECT[aspect])} />
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
}: Announce & {
  readonly columns: keyof typeof GRID_COLUMNS;
  readonly count: number;
}) {
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

/** `V2RegisterCard`'s form shell — the one box on `/kayit` that isn't a summary card. */
export function FormCardSkeleton({ announce = true }: Announce) {
  return (
    <Status announce={announce}>
      <Bar className="h-[520px] w-full rounded-3xl" />
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

function AuthShape() {
  return (
    <PageContainer>
      <BreadcrumbsSkeleton />
      <div className="relative z-10 max-w-3xl space-y-4">
        <Bar className="h-9 w-64 sm:h-12" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 xl:col-span-5 w-full">
          <FormCardSkeleton announce={false} />
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 pb-24">
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
    </main>
  );
}

const SHAPES: Record<PageSkeletonShape, () => ReactNode> = {
  auth: AuthShape,
  play: PlayShape,
};

export function PageSkeleton({
  shape,
}: {
  readonly shape: PageSkeletonShape;
  readonly className?: never;
}) {
  return <Status announce>{SHAPES[shape]()}</Status>;
}

/**
 * The `(play)` Suspense boundary, one per game page (T-037 Task 13).
 *
 * Each `/oyun/*` page renders `<V2Header />` and `<V2LiveTicker />` as page-level chrome — moved
 * out of `V2GameScreen` itself, which used to render both unconditionally — and then this
 * boundary around the fetch-bound game section. Both branches it can show, the `"play"` skeleton
 * above and the `V2GameScreen` the section resolves to, own their own `max-w-7xl` wrapper, the
 * same shape `V2GameScreen` is already exempted for in
 * `components/v2/page-composition-containers.test.ts`'s `OUTSIDE_THE_BODY` table.
 *
 * Named rather than inline `<Suspense>` for exactly that exemption: `importBindingsOf` drops bare
 * package specifiers (`import { Suspense } from "react"` resolves to `null`), so a raw `<Suspense>`
 * at the top of a page can never be matched to a module+export pair and would read as an
 * uncontained render root forever, regardless of what it wraps. `PlaySuspense` is a local
 * component with a real file, so the same import-resolution path that already clears
 * `V2GameScreen` and `V2LiveTicker` clears this one too.
 */
export function PlaySuspense({
  children,
}: {
  readonly children: ReactNode;
  readonly className?: never;
}) {
  return <Suspense fallback={<PageSkeleton shape="play" />}>{children}</Suspense>;
}
