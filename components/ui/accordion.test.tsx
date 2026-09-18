import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * The property the Base UI rebuild exists to buy: a CLOSED answer is still in the document.
 *
 * The hand-rolled accordion this replaced returned `null` from `AccordionContent` while closed,
 * so a FAQ rendered through it served its questions and none of its answers — and
 * `components/patterns/faq-section.tsx` emits `FAQPage` JSON-LD from the very array it renders,
 * where structured data without visible text on the page is the defect, not a nicety.
 *
 * Asserted through `renderToStaticMarkup` rather than a browser because that IS the surface in
 * question: what a crawler, a reader mode and the initial HTML payload actually receive.
 *
 * MEASURED, and worth knowing before someone asserts the literal string: on the SERVER the closed
 * panel ships `hidden=""` (the boolean), not `hidden="until-found"`. Base UI 1.7 upgrades the
 * attribute in a layout effect, so `until-found` — and with it find-in-page expansion — is a
 * client-side upgrade. The property this file pins is the one that does hold on the server and is
 * the one that matters to a crawler: the answer TEXT is in the document either way.
 */
const OPEN_BODY = "Acik panelin govdesi.";
const CLOSED_BODY = "Kapali panelin govdesi.";

function markup(open: readonly string[] = ["open"]) {
  return renderToStaticMarkup(
    <Accordion defaultValue={open.length === 0 ? undefined : [...open]}>
      <AccordionItem value="open">
        <AccordionTrigger>Acik soru?</AccordionTrigger>
        <AccordionContent>{OPEN_BODY}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="closed">
        <AccordionTrigger>Kapali soru?</AccordionTrigger>
        <AccordionContent>{CLOSED_BODY}</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

/**
 * The opening tag of the element carrying `slot` that most closely precedes `text`.
 *
 * Two slots matter here and they are two different elements: `accordion-content` is the PANEL,
 * the element Base UI hides, and `accordion-content-inner` is the wrapper that holds the padding.
 * Matching on the slot with its closing quote keeps `accordion-content` from also matching
 * `accordion-content-inner`.
 */
function tagBefore(html: string, text: string, slot: string): string {
  const upTo = html.slice(0, html.indexOf(text));
  const at = upTo.lastIndexOf(`data-slot="${slot}"`);
  return upTo.slice(upTo.lastIndexOf("<div", at), upTo.indexOf(">", at) + 1);
}

const HIDDEN_ATTR = /\shidden=/;

describe("Accordion", () => {
  it("keeps a closed panel's text in the server-rendered HTML", () => {
    const html = markup();
    expect(html).toContain(OPEN_BODY);
    expect(html).toContain(CLOSED_BODY);
  });

  it("hides the closed panel with `hidden`, not by dropping it", () => {
    const html = markup();
    // `\shidden=` and not `toContain("hidden")`: the item wrapper carries `data-hidden` and the
    // class list carries `overflow-hidden`, either of which would satisfy a substring check on a
    // component that had dropped the panel entirely.
    expect(tagBefore(html, CLOSED_BODY, "accordion-content")).toMatch(HIDDEN_ATTR);
    // And the OPEN one is not hidden: without this the assertion above would pass on a
    // component that hid every panel unconditionally.
    expect(tagBefore(html, OPEN_BODY, "accordion-content")).not.toMatch(HIDDEN_ATTR);
  });

  it("keeps every panel closed when no defaultValue is given", () => {
    const html = markup([]);
    // Both bodies still ship — the whole point — and both panels are hidden.
    expect(html).toContain(OPEN_BODY);
    expect(html).toContain(CLOSED_BODY);
    expect(tagBefore(html, OPEN_BODY, "accordion-content")).toMatch(HIDDEN_ATTR);
    expect(tagBefore(html, CLOSED_BODY, "accordion-content")).toMatch(HIDDEN_ATTR);
    // Zero open: `data-open` marks an open item, and the all-closed default must produce none.
    // This is the shape every live caller uses — `/deniz`'s eight items open nothing by default.
    expect(html.match(/data-open=""/g)).toBeNull();
    expect(html.match(/data-closed=""/g)).toHaveLength(6);
  });

  it("gives every trigger a heading, so the questions reach the document outline", () => {
    expect(markup().match(/<h3/g)).toHaveLength(2);
  });

  /**
   * THE HIDDEN ELEMENT'S OWN BOX MUST BE EMPTY, and this is the assertion that says why.
   *
   * `hidden=""` and `hidden="until-found"` are not the same hiding. The boolean resolves to
   * `display: none` — no box, so padding on the element costs nothing. `until-found` resolves to
   * `content-visibility: hidden`, which skips the element's CONTENTS but keeps its own box: any
   * padding written on the panel becomes a visible strip on every closed item, appearing at
   * hydration as the attribute is upgraded. Since the server renders the boolean and the client
   * renders `until-found`, that defect is invisible in SSR output and invisible in a static
   * review — it only shows up in a browser, after hydration, as blank space and a layout shift.
   *
   * So the panel carries the animated height and nothing with a size, and the padding lives on
   * the inner wrapper. Measured on `/deniz` after the fix: eight closed panels, all
   * `hidden="until-found"`, all 0px tall.
   */
  it("puts no padding on the panel Base UI hides, only on the wrapper inside it", () => {
    const html = markup();
    const panel = tagBefore(html, CLOSED_BODY, "accordion-content");
    expect(panel, "a padding utility on the hidden panel").not.toMatch(/\sp[xybtlre]?-\d/);
    expect(panel, "the animated height belongs on the panel").toContain("--accordion-panel-height");
    const inner = tagBefore(html, CLOSED_BODY, "accordion-content-inner");
    expect(inner).toContain("px-4");
    expect(inner).toContain("pb-4");
    expect(inner, "the wrapper is inside the hidden element, never hidden itself").not.toMatch(
      HIDDEN_ATTR,
    );
  });
});
