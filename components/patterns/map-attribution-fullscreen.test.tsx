import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { collapsesCredit, MapAttribution } from "./map-attribution";

/**
 * T-117. In fullscreen the credit starts open and then shrinks to an ⓘ button in the map's corner
 * (the OSMF Attribution Guidelines' "hide on interaction or after 5 seconds, keep it reachable
 * behind an (i)" route). The timer and the collapse run in the browser; what a node render can pin
 * is the first frame and the page view it must not disturb.
 */
const render = (fullscreen: boolean) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages}>
      <MapAttribution inlandWater context fullscreen={fullscreen} />
    </NextIntlClientProvider>,
  );

describe("MapAttribution in fullscreen", () => {
  const html = render(true);

  it("opens with the full credit and an expanded ⓘ button that controls it", () => {
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-expanded="true"');
    expect(button).toContain(`aria-label="${trMessages.Map.attributionToggle}"`);
    const controls = button.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls, "the button names the panel it opens").toBeTruthy();
    expect(html).toMatch(new RegExp(`<p[^>]*id="${controls}"[^>]*>[\\s\\S]*OpenStreetMap`));
  });

  it("keeps the licensor's English wording marked as English", () => {
    expect(html).toContain('<span lang="en">');
  });

  it("carries the same lines as the page view", () => {
    const text = (s: string) => s.replace(/<[^>]+>/g, "");
    expect(text(html)).toContain(text(render(false)));
  });
});

describe("MapAttribution outside fullscreen", () => {
  it("is the plain credit paragraph, with no toggle", () => {
    const html = render(false);
    expect(html.startsWith("<p ")).toBe(true);
    expect(html).not.toContain("<button");
  });
});

describe("collapsesCredit", () => {
  it("collapses on a press, wheel or key anywhere on the map", () => {
    expect(collapsesCredit({ type: "pointerdown", insideCredit: false })).toBe(true);
    expect(collapsesCredit({ type: "wheel", insideCredit: false })).toBe(true);
    expect(collapsesCredit({ type: "keydown", key: "+", insideCredit: false })).toBe(true);
  });

  it("leaves the credit alone while someone uses the credit itself", () => {
    expect(collapsesCredit({ type: "pointerdown", insideCredit: true })).toBe(false);
    expect(collapsesCredit({ type: "keydown", key: "Enter", insideCredit: true })).toBe(false);
  });

  it("does not treat moving focus with Tab as using the map", () => {
    expect(collapsesCredit({ type: "keydown", key: "Tab", insideCredit: false })).toBe(false);
    expect(collapsesCredit({ type: "keydown", key: "Shift", insideCredit: false })).toBe(false);
  });
});
