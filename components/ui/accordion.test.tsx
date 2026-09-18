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

function markup() {
  return renderToStaticMarkup(
    <Accordion defaultValue={["open"]}>
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

/** The opening tag of the element that directly wraps `text` — i.e. the panel's own `<div`. */
function openTagBefore(html: string, text: string): string {
  const upTo = html.slice(0, html.indexOf(text));
  return upTo.slice(upTo.lastIndexOf("<div"));
}

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
    const HIDDEN_ATTR = /\shidden=/;
    expect(openTagBefore(html, CLOSED_BODY)).toMatch(HIDDEN_ATTR);
    // And the OPEN one is not hidden: without this the assertion above would pass on a
    // component that hid every panel unconditionally.
    expect(openTagBefore(html, OPEN_BODY)).not.toMatch(HIDDEN_ATTR);
  });

  it("gives every trigger a heading, so the questions reach the document outline", () => {
    expect(markup().match(/<h3/g)).toHaveLength(2);
  });
});
