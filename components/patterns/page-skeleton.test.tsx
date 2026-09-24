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
    const explorer = stripComments(
      readFileSync(
        fileURLToPath(new URL("../v2/v2-earthquake-explorer.tsx", import.meta.url)),
        "utf8",
      ),
    );
    const game = stripComments(
      readFileSync(fileURLToPath(new URL("../v2/v2-game-screen.tsx", import.meta.url)), "utf8"),
    );
    const continent = stripComments(
      readFileSync(
        fileURLToPath(new URL("../v2/v2-continent-locator-map.tsx", import.meta.url)),
        "utf8",
      ),
    );
    expect(explorer).toContain("aspect-[1270/580]");
    expect(game).toContain("aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]");
    expect(continent).toContain("aspect-[1000/521]");
    expect(render(<PlateSkeleton aspect="map" />)).toContain("aspect-[1270/580]");
    expect(render(<PlateSkeleton aspect="game" />)).toContain(
      "aspect-[2.33/1] min-h-[380px] sm:min-h-[480px]",
    );
    expect(render(<PlateSkeleton aspect="continent" />)).toContain("aspect-[1000/521]");
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
