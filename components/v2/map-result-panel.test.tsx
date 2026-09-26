import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapResultPanel } from "./map-result-panel";

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
