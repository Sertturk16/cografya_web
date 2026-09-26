/**
 * The book page's structural rules (T-128 spec §2): Book → Group → Video → Marker.
 *
 * Pure and framework-free so the page (server) and the bench island (client) read one answer.
 * Labels are NOT composed here — they need the translator; see `video-identity.ts`.
 */

export type MarkerLayout = "cards" | "grid" | "list";

/** Up to this many unnamed markers render as cards with their time; more become a dense grid. */
export const MARKER_CARD_LIMIT = 12;

/** A video is named when any marker carries its own name (konu anlatımı, tek video). */
export function isNamed(tags: readonly { readonly nameTr: string | null }[]): boolean {
  return tags.some((tag) => tag.nameTr !== null);
}

export function markerLayout(tags: readonly { readonly nameTr: string | null }[]): MarkerLayout {
  if (isNamed(tags)) return "list";
  return tags.length <= MARKER_CARD_LIMIT ? "cards" : "grid";
}

export interface VideoGroup<T> {
  readonly title: string | null;
  readonly items: readonly T[];
}

/** Consecutive videos sharing a `groupTitleTr` form one group, in the order given. */
export function groupVideos<T extends { readonly groupTitleTr: string | null }>(
  videos: readonly T[],
): VideoGroup<T>[] {
  const groups: { title: string | null; items: T[] }[] = [];
  for (const video of videos) {
    const last = groups.at(-1);
    if (last !== undefined && last.title === video.groupTitleTr) last.items.push(video);
    else groups.push({ title: video.groupTitleTr, items: [video] });
  }
  return groups;
}

/** Headings render unless the whole book is one untitled group. */
export function hasGroupHeadings<T>(groups: readonly VideoGroup<T>[]): boolean {
  return groups.some((group) => group.title !== null);
}

export function neighbours(
  orderNos: readonly number[],
  current: number,
): { prev: number | null; next: number | null } {
  const index = orderNos.indexOf(current);
  if (index === -1) return { prev: null, next: null };
  return { prev: orderNos[index - 1] ?? null, next: orderNos[index + 1] ?? null };
}

/** The video auto-next may load: the next one in book order, only if it plays in the page. */
export function nextPlayable<T extends { readonly orderNo: number; readonly playable: boolean }>(
  videos: readonly T[],
  current: number,
): T | null {
  const index = videos.findIndex((video) => video.orderNo === current);
  const next = index === -1 ? undefined : videos[index + 1];
  return next !== undefined && next.playable ? next : null;
}
