import { formatDuration } from "@/lib/book/duration";
import { tagFragment } from "@/lib/book/video-identity";
import { markerLayout } from "@/lib/book/workbench-model";
import type { BenchVideo } from "./bench-stage";

/**
 * Every video's markers (T-128 spec §4.4), a SERVER component: all of them are real
 * `<a href="#video-N-etiket-M">` links in the HTML, and only the selected video's panel is
 * visible — the rest carry `hidden`, which the bench island moves on selection. The island also
 * owns `aria-current` on the current marker; the fill that follows it is the page's one bold
 * element.
 *
 * Three layouts from `markerLayout`: saatli cards for up to twelve questions, a dense number grid
 * above that (time in the accessible name and `title`), a timed list for named markers. Every
 * target is at least 44px (`docs/design.md`, generous controls).
 */

const CARDS =
  "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(5.5rem,100%),1fr))] gap-2 p-0";
const CARD =
  "group/marker flex min-h-14 flex-col items-center justify-center rounded-lg border " +
  "border-border bg-card text-primary-strong no-underline tabular-nums transition-colors " +
  "duration-150 hover:border-primary aria-[current=true]:border-primary " +
  "aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground";
const CARD_NO = "text-base font-semibold leading-tight";
const CARD_TIME =
  "text-xs text-muted-foreground group-aria-[current=true]/marker:text-primary-foreground";
const GRID = "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 p-0";
const CELL =
  "flex min-h-11 items-center justify-center rounded-lg border border-border bg-card text-sm " +
  "font-semibold text-primary-strong no-underline tabular-nums transition-colors duration-150 " +
  "hover:border-primary aria-[current=true]:border-primary aria-[current=true]:bg-primary " +
  "aria-[current=true]:text-primary-foreground";
const LIST = "m-0 flex list-none flex-col gap-0.5 p-0";
const LIST_ROW =
  "flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm " +
  "text-foreground no-underline transition-colors duration-150 hover:bg-muted " +
  "aria-[current=true]:bg-primary/10 aria-[current=true]:text-primary-strong";

type Tag = BenchVideo["tags"][number];

export function MarkerPanels({
  videos,
  defaultOrderNo,
  markerLabel,
  markerAria,
  panelLabel,
}: {
  videos: readonly BenchVideo[];
  defaultOrderNo: number;
  /** "Soru 3", or the marker's own name. */
  markerLabel: (tag: Tag) => string;
  /** "Soru 3, videoda 2:29". */
  markerAria: (tag: Tag) => string;
  panelLabel: (video: BenchVideo) => string;
}) {
  return videos.map((video) => {
    const layout = markerLayout(video.tags);
    return (
      <div
        key={video.orderNo}
        data-marker-panel=""
        data-deneme={video.orderNo}
        hidden={video.orderNo !== defaultOrderNo}
        role="group"
        aria-label={panelLabel(video)}
      >
        <ul role="list" className={layout === "cards" ? CARDS : layout === "grid" ? GRID : LIST}>
          {video.tags.map((tag, index) => {
            const fragment = tagFragment(video.orderNo, tag, video.tags);
            const common = {
              id: fragment,
              href: `#${fragment}`,
              "data-second": tag.second,
              "data-marker-index": index,
              "aria-label": video.playable ? markerAria(tag) : undefined,
            };
            return (
              <li key={tag.orderNo}>
                {layout === "cards" && (
                  <a {...common} className={CARD}>
                    <span className={CARD_NO}>{tag.orderNo}</span>
                    <span className={CARD_TIME}>{formatDuration(tag.second)}</span>
                  </a>
                )}
                {layout === "grid" && (
                  <a {...common} className={CELL} title={markerAria(tag)}>
                    {tag.orderNo}
                  </a>
                )}
                {layout === "list" && (
                  <a {...common} className={LIST_ROW}>
                    <span className="min-w-0">{markerLabel(tag)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDuration(tag.second)}
                    </span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  });
}
