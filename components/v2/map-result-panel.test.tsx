import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapResultAction, MapResultPanel } from "./map-result-panel";

/** T-121: the hint line can carry a warning (the area tool's crossing edges) as well as a nudge. */
const render = (hintTone?: "muted" | "warning") =>
  renderToStaticMarkup(
    <MapResultPanel
      label="Ölçüm sonucu"
      summary="—"
      details="x"
      actions={null}
      hint="Kenarlar kesişiyor, alan yazılmaz."
      hintTone={hintTone}
      status="Kenarlar kesişiyor, alan yazılmaz."
    />,
  );
const hintClass = (html: string) => /<p data-result-hint="" class="([^"]*)"/.exec(html)?.[1] ?? "";

describe("MapResultPanel hint tone", () => {
  it("is muted by default", () => {
    expect(hintClass(render())).toMatch(/\btext-muted-foreground\b/);
    expect(hintClass(render())).not.toMatch(/\btext-warning-strong\b/);
  });

  it("uses the warning colour when asked", () => {
    expect(hintClass(render("warning"))).toMatch(/\btext-warning-strong\b/);
    expect(hintClass(render("warning"))).not.toMatch(/\btext-muted-foreground\b/);
  });
});

describe("MapResultPanel action labels", () => {
  it("shows the button text by the panel's own width, not the viewport's", () => {
    // On the map the panel is 320 px at any viewport; text buttons there left the summary ~100 px
    // and pushed "135.476,1 km²" under "Geri Al" (T-121). A container query keys the labels to the
    // panel, so the wide panel under the map keeps them.
    const html = renderToStaticMarkup(
      <MapResultPanel
        label="Ölçüm sonucu"
        summary="—"
        details="x"
        actions={<MapResultAction icon={null} label="Geri Al" onClick={() => {}} />}
        status="—"
      />,
    );
    expect(html).toMatch(/role="group"[^>]*class="@container /);
    expect(html).toContain('<span class="sr-only @sm:not-sr-only">Geri Al</span>');
    expect(html).not.toMatch(/\ssm:px-3/);
    expect(html).toContain(" @sm:px-3 ");
  });
});
