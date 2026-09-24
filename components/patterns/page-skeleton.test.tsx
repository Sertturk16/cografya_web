import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import {
  BreadcrumbsSkeleton,
  CardGridSkeleton,
  HeroSkeleton,
  InlineSkeleton,
  PageSkeleton,
  PlateSkeleton,
  ProseSkeleton,
  StatTileSkeleton,
} from "./page-skeleton";

const SHAPES = ["hub", "detail", "account", "auth", "play"] as const;

function render(node: React.ReactNode, locale: "tr" | "en" = "tr") {
  const messages = locale === "tr" ? tr : en;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("PageSkeleton", () => {
  it.each(SHAPES)("shape %s announces exactly once and marks itself busy", (shape) => {
    const html = render(<PageSkeleton shape={shape} />);
    expect(count(html, 'role="status"')).toBe(1);
    expect(count(html, 'aria-busy="true"')).toBe(1);
    expect(html).toContain("Yükleniyor…");
  });

  it("reads the label from the active locale", () => {
    expect(render(<PageSkeleton shape="hub" />, "en")).toContain("Loading…");
  });

  it("hides every bar from assistive tech", () => {
    const html = render(<PageSkeleton shape="hub" />);
    const bars = html.match(/<(div|span)[^>]*data-slot="skeleton"[^>]*>/g) ?? [];
    expect(bars.length).toBeGreaterThan(5);
    for (const bar of bars) {
      expect(bar).toContain('aria-hidden="true"');
    }
  });

  it("uses no card surface token — the hand-drawn card counters must not see it", () => {
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./page-skeleton.tsx", import.meta.url)), "utf8"),
    );
    expect(source).not.toMatch(/\bbg-card\b/);
    expect(source).not.toMatch(/\bborder-border\b/);
    expect(source).not.toMatch(/\bdark:/);
  });

  it("offers no className escape hatch on any export", () => {
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./page-skeleton.tsx", import.meta.url)), "utf8"),
    );
    // Once in the shared `Announce` props (six pieces), once on `BreadcrumbsSkeleton`, once on
    // `PageSkeleton`. Every `export function` must reach one of the three.
    expect(source.match(/className\?: never/g)?.length).toBe(3);
    const exportsWithoutIt = [...source.matchAll(/export function (\w+)\(([^)]*)\)/g)]
      .filter(([, , params]) => !/Announce|className\?: never/.test(params ?? ""))
      .map(([, name]) => name);
    expect(exportsWithoutIt).toEqual([]);
  });

  it("InlineSkeleton is span-rooted so it can sit inside a <p>", () => {
    expect(render(<InlineSkeleton width="sm" />)).toMatch(/^<span role="status"/);
    expect(render(<InlineSkeleton width="sm" announce={false} />)).toMatch(/^<span /);
  });

  it("mirrors the live plates byte for byte", () => {
    const readSource = (name: string) =>
      stripComments(readFileSync(fileURLToPath(new URL(`../v2/${name}`, import.meta.url)), "utf8"));

    const earthquake = readSource("v2-earthquake-explorer.tsx");
    const marine = readSource("v2-marine-map-explorer.tsx");
    const toolWorkbench = readSource("v2-tool-workbench.tsx");
    const province = readSource("v2-province-locator-map.tsx");
    const turkey = readSource("v2-turkey-map-explorer.tsx");
    const world = readSource("v2-world-map-explorer.tsx");
    const continent = readSource("v2-continent-locator-map.tsx");
    const game = readSource("v2-game-screen.tsx");

    expect(earthquake).toContain("aspect-[1270/580]");
    expect(marine).toContain("aspect-[1270/580]");
    expect(toolWorkbench).toContain("aspect-[1270/580]");
    expect(province).toContain("aspect-[1270/580]");
    expect(turkey).toContain("aspect-square sm:aspect-[1270/580] sm:min-h-[420px]");
    expect(world).toContain("aspect-[1008/520]");
    expect(continent).toContain("aspect-[1000/521]");
    expect(game).toContain("aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]");

    expect(render(<PlateSkeleton aspect="map" />)).toContain("aspect-[1270/580]");
    expect(render(<PlateSkeleton aspect="turkey" />)).toContain(
      "aspect-square sm:aspect-[1270/580] sm:min-h-[420px]",
    );
    expect(render(<PlateSkeleton aspect="world" />)).toContain("aspect-[1008/520]");
    expect(render(<PlateSkeleton aspect="continent" />)).toContain("aspect-[1000/521]");
    expect(render(<PlateSkeleton aspect="game" />)).toContain(
      "aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]",
    );
  });

  it("the hub shape's plate defaults to map, and can be swapped for the turkey explorer's", () => {
    const defaultHtml = render(<PageSkeleton shape="hub" />);
    expect(defaultHtml).toContain("aspect-[1270/580]");
    expect(defaultHtml).not.toContain("aspect-square");

    const turkeyHtml = render(<PageSkeleton shape="hub" plate="turkey" />);
    expect(turkeyHtml).toContain("aspect-square sm:aspect-[1270/580]");
  });

  it("pieces can be silenced so a page announces once", () => {
    for (const piece of [
      <HeroSkeleton key="h" tier="hub" tiles={4} announce={false} />,
      <StatTileSkeleton key="s" announce={false} />,
      <PlateSkeleton key="p" aspect="map" announce={false} />,
      <ProseSkeleton key="r" lines={3} announce={false} />,
      <CardGridSkeleton key="c" columns="2" count={4} announce={false} />,
      <InlineSkeleton key="i" width="md" announce={false} />,
    ]) {
      expect(count(render(piece), 'role="status"')).toBe(0);
    }
    expect(count(render(<BreadcrumbsSkeleton />), 'role="status"')).toBe(0);
  });

  it("the hub hero renders the requested tile count inside the shared grid", () => {
    const html = render(<HeroSkeleton tier="hub" tiles={4} />);
    expect(count(html, 'data-skeleton="stat-tile"')).toBe(4);
    expect(html).toContain("grid-cols-2 sm:grid-cols-4");
  });

  it("the detail shape renders the band and the 12-column body", () => {
    const html = render(<PageSkeleton shape="detail" />);
    expect(html).toContain("lg:grid-cols-12");
    expect(html).toContain("lg:col-span-8");
    expect(html).toContain("lg:col-span-4");
  });
});
