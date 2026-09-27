import { formatDuration } from "@/lib/book/duration";
import { videoFragment } from "@/lib/book/video-identity";
import { groupVideos, hasGroupHeadings } from "@/lib/book/workbench-model";
import type { BenchVideo } from "./bench-stage";
import { StatusIcon } from "./status-icon";

/**
 * The workbench's video list (T-128 spec §4.2), a SERVER component: every row is a real
 * `<a href="#video-N">` in the HTML, so the list reads and navigates without JavaScript. The
 * bench island owns what changes — `aria-current` on the selected row, `data-status` and
 * `--ring` for the status icon, the group progress text — by writing attributes on this markup.
 *
 * The row carries `data-deneme` (the island's one way of knowing which video a press belongs to)
 * and `data-video-id` (the key the progress rows arrive under).
 */

const ROW =
  "group/row flex min-h-14 items-center gap-3 px-4 py-2.5 text-foreground no-underline " +
  "transition-colors duration-150 hover:bg-muted aria-[current=true]:bg-primary/10";
const ROW_LABEL =
  "block text-sm font-semibold leading-snug group-aria-[current=true]/row:text-primary-strong";
const ROW_SUB = "block text-xs text-muted-foreground";
const ROW_DURATION = "ml-auto shrink-0 text-xs tabular-nums text-muted-foreground";
const GROUP_HEAD =
  "sticky top-0 z-10 m-0 flex items-baseline justify-between gap-2 bg-background px-4 pt-3 " +
  "pb-1.5 font-sans text-xs font-semibold text-muted-foreground";

export function WorkbenchList({
  videos,
  listLabel,
  markerCountLabel,
  onYoutubeLabel,
  doneLabel,
  partLabel,
}: {
  videos: readonly BenchVideo[];
  listLabel: string;
  markerCountLabel: (video: BenchVideo) => string;
  onYoutubeLabel: string;
  doneLabel: string;
  partLabel: string;
}) {
  const groups = groupVideos(videos);
  const headings = hasGroupHeadings(groups);
  return (
    <nav aria-label={listLabel}>
      {groups.map((group, index) => (
        <section key={`${group.title ?? "none"}-${index}`}>
          {headings && group.title !== null && (
            <h2 className={GROUP_HEAD}>
              <span>{group.title}</span>
              <span
                data-group-progress=""
                data-group-ids={group.items.map((video) => video.bookVideoId).join(" ")}
                className="tabular-nums"
              />
            </h2>
          )}
          <ul role="list" className="m-0 list-none p-0">
            {group.items.map((video) => (
              <li key={video.orderNo}>
                <a
                  id={videoFragment(video.orderNo)}
                  href={`#${videoFragment(video.orderNo)}`}
                  className={ROW}
                  data-video-row=""
                  data-deneme={video.orderNo}
                  data-video-id={video.bookVideoId}
                >
                  <StatusIcon doneLabel={doneLabel} partLabel={partLabel} />
                  <span className="min-w-0">
                    <span className={ROW_LABEL}>{video.label}</span>
                    <span className={ROW_SUB}>{markerCountLabel(video)}</span>
                  </span>
                  <span className={ROW_DURATION}>
                    {video.playable
                      ? video.durationSeconds !== null && formatDuration(video.durationSeconds)
                      : onYoutubeLabel}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
