import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * The book workbench's structural contract (T-128), read from source because vitest runs in a
 * node environment with no DOM and nothing under `app/` executes in a test.
 *
 * Three promises are pinned here. Every video row and every marker of every video is a real
 * server-rendered `<a href>` (the page must read and navigate without JavaScript). The island is
 * the one delegated listener and never loads a player from a hash alone. The workbench is one
 * screen tall with a floor, and the two mobile steps split only below `lg`.
 */

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const flat = (relative: string) => stripComments(sourceOf(relative)).replace(/\s+/g, " ");

const PAGE = flat("../../app/[locale]/(site)/kitaplar/[slug]/page.tsx");
const BENCH = flat("./video-bench.tsx");
const STAGE = flat("./bench-stage.tsx");
const LIST = flat("./workbench-list.tsx");
const MARKERS = flat("./marker-panels.tsx");
const STATUS = flat("./status-icon.tsx");

describe("the workbench keeps every link crawlable", () => {
  it("renders every video row as a real fragment link from the server", () => {
    expect(LIST).toContain("href={`#${videoFragment(video.orderNo)}`}");
    expect(LIST).toContain('data-video-row=""');
    expect(LIST).toContain("data-deneme={video.orderNo}");
    expect(sourceOf("./workbench-list.tsx")).not.toContain('"use client"');
  });

  it("renders every marker of every video, hiding only the unselected panels", () => {
    expect(MARKERS).toContain("videos.map((video) =>");
    expect(MARKERS).toContain("hidden={video.orderNo !== defaultOrderNo}");
    expect(MARKERS).toContain("href: `#${fragment}`");
    expect(MARKERS).toContain("const fragment = tagFragment(video.orderNo, tag, video.tags);");
    expect(sourceOf("./marker-panels.tsx")).not.toContain('"use client"');
  });

  it("hands both server trees to the island rather than rendering them behind a condition", () => {
    expect(PAGE).toContain("list={ <WorkbenchList");
    expect(PAGE).toContain("markers={ <MarkerPanels");
  });

  it("names each video once, through the shared builder, for rows, stage and VideoObject", () => {
    expect(PAGE).toContain("label: videoTitle(t, locale, video, kind)");
    expect(PAGE).toContain("videoTitle(t, locale, video, book.contentKind)");
    expect(STAGE).not.toContain("videoTitle(");
  });
});

describe("the island stays the one delegated listener", () => {
  it("acts only on the three data hooks", () => {
    expect(BENCH).toContain('closest<HTMLElement>("[data-video-row]")');
    expect(BENCH).toContain('closest<HTMLElement>("[data-second], [data-player-open]")');
  });

  it("resolves the video from the DOM rather than from a parsed fragment", () => {
    expect(BENCH).toContain('node.closest<HTMLElement>("[data-deneme]")');
  });

  it("loads no player from a hash alone", () => {
    const start = BENCH.indexOf("const id = window.location.hash.slice(1);");
    expect(start).toBeGreaterThan(-1);
    const effect = BENCH.slice(start, BENCH.indexOf("}, [", start));
    expect(effect).not.toContain("openVideo(");
  });

  it("pushes a marked history entry on selection, and keeps replaceState for a marker press", () => {
    expect(BENCH).toContain("window.history.pushState({ [BENCH_HISTORY_MARK]: true }");
    expect(BENCH).toContain('window.history.replaceState(null, "", fragment)');
  });

  it("clears the store when the bench leaves the page", () => {
    expect(BENCH).toContain("useEffect(() => resetBench, [])");
  });

  it("auto-next never loads a video the provider refuses to embed", () => {
    expect(BENCH).toContain("const next = nextPlayable(videos, orderNo);");
    expect(BENCH).toContain("if (!autoNext) return;");
  });
});

describe("the one-screen frame", () => {
  it("sizes the workbench to the viewport below the header, with a floor", () => {
    expect(BENCH).toContain("h-[calc(100dvh-var(--header-height))] min-h-[30rem]");
    expect(BENCH).toContain("lg:min-h-[36rem]");
  });

  it("splits the two steps only below lg", () => {
    expect(BENCH).toContain("group-data-[step=watch]/bench:max-lg:hidden");
    expect(BENCH).toContain("group-data-[step=pick]/bench:max-lg:hidden");
  });

  it("scrolls the list and the marker strip inside their own boxes", () => {
    expect(BENCH).toMatch(/min-h-0 flex-1 overflow-y-auto/);
    expect(STAGE).toMatch(/flex-1 overflow-y-auto/);
  });

  it("keeps every marker target at least 44px", () => {
    expect(MARKERS).toContain("minmax(2.75rem,1fr)");
    expect(MARKERS).toContain("min-h-11");
    expect(MARKERS).toContain("min-h-14");
  });

  it("reserves the status icon's slot from first paint", () => {
    expect(STATUS).toContain("invisible size-5");
    expect(STATUS).toContain("group-data-[status=part]/row:visible");
    expect(STATUS).toContain("group-data-[status=done]/row:block");
  });
});
