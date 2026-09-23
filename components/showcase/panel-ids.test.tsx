import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import messages from "@/messages/tr.json";
import { CATEGORIES } from "./registry";
import { specimensFor } from "./specimens";
import { ThemePair } from "./theme-pair";

/**
 * `ThemePair` renders its child TWICE, once per panel. Any id the child carries is therefore
 * printed twice unless the specimen derives it from the panel, and every IDREF (`for`,
 * `aria-labelledby`, `aria-describedby`, ...) then resolves to the FIRST copy: the dark panel's
 * FAQ section was named by the light panel's heading, and clicking a dark panel's label focused
 * the light panel's input.
 *
 * This suite renders the whole registry, so a specimen added later with a literal `id="..."` fails
 * here the day it lands rather than on a browser sweep.
 */

/** Attributes whose value is a space-separated list of ids on the same page. */
const IDREF_ATTRIBUTES = [
  "for",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-activedescendant",
  "aria-errormessage",
  "aria-details",
  "aria-flowto",
  "headers",
  "list",
  "form",
] as const;

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** `null` is "outside every panel" — the Specimen heading, the page chrome. */
type Panel = string | null;

interface IdGraph {
  /** Every `id` in document order, with the panel it sits in. */
  readonly ids: readonly { readonly id: string; readonly panel: Panel }[];
  readonly refs: readonly {
    readonly attr: string;
    readonly target: string;
    readonly panel: Panel;
  }[];
  /** How many `data-theme-panel` elements were opened, by value. */
  readonly panels: Readonly<Record<string, number>>;
}

/**
 * A tag-stack walk over React's static markup, which is well-formed and escapes `<`, `>` and `"`
 * in text and attribute values — so a regex tokenizer is exact here, where it would not be over
 * arbitrary HTML. `<script>` and `<style>` bodies are skipped whole: they are the one place raw
 * text can contain a `<`.
 */
function idGraph(html: string): IdGraph {
  const ids: { id: string; panel: Panel }[] = [];
  const refs: { attr: string; target: string; panel: Panel }[] = [];
  const panels: Record<string, number> = {};
  const stack: { name: string; panel: Panel }[] = [];
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)>/g;

  for (let match = tag.exec(html); match !== null; match = tag.exec(html)) {
    const [, closing, rawName, rawAttributes, selfClosing] = match;
    const name = rawName!.toLowerCase();

    if (closing) {
      const at = stack.map((entry) => entry.name).lastIndexOf(name);
      if (at !== -1) stack.length = at;
      continue;
    }

    const attributes = new Map<string, string>();
    for (const attr of rawAttributes!.matchAll(/\s([^\s=]+)(?:="([^"]*)")?/g)) {
      attributes.set(attr[1]!, attr[2] ?? "");
    }

    const inherited = stack.length > 0 ? stack[stack.length - 1]!.panel : null;
    const ownPanel = attributes.get("data-theme-panel");
    const panel = ownPanel ?? inherited;
    if (ownPanel !== undefined) panels[ownPanel] = (panels[ownPanel] ?? 0) + 1;

    const id = attributes.get("id");
    if (id !== undefined) ids.push({ id, panel });
    for (const attr of IDREF_ATTRIBUTES) {
      const value = attributes.get(attr);
      if (value === undefined) continue;
      for (const target of value.split(/\s+/).filter(Boolean)) refs.push({ attr, target, panel });
    }
    // An in-page link is a reference too: `FormErrorSummary` links each error to its field.
    const href = attributes.get("href");
    if (href !== undefined && href.length > 1 && href.startsWith("#")) {
      refs.push({ attr: "href", target: href.slice(1), panel });
    }

    if (name === "script" || name === "style") {
      const end = html.indexOf(`</${name}>`, tag.lastIndex);
      tag.lastIndex = end === -1 ? html.length : end + name.length + 3;
      continue;
    }
    if (!selfClosing && !VOID_ELEMENTS.has(name)) stack.push({ name, panel });
  }

  return { ids, refs, panels };
}

function duplicateIds(graph: IdGraph): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const { id } of graph.ids) {
    if (seen.has(id)) duplicated.add(id);
    seen.add(id);
  }
  return [...duplicated];
}

/**
 * Targets that live in a PORTAL, which server markup never contains: the portal mounts into
 * `document.body` after hydration, outside both panels by design. Listed by prefix, with the
 * reason, rather than by a blanket "unresolved is fine" — that rule would also wave through a
 * reference to an id nobody renders at all.
 *
 *   - `tooltip-`: `components/ui/tooltip.tsx` points the trigger's `aria-describedby` at a
 *     `keepMounted` popup built from `React.useId()`, so the id is already unique per panel.
 */
const PORTALED_TARGETS = [/^tooltip-/];

/** Every IDREF that does not land on exactly one id in the SAME panel as the element citing it. */
function strayReferences(graph: IdGraph): string[] {
  return graph.refs
    .filter(({ target, panel }) => {
      const hits = graph.ids.filter((entry) => entry.id === target);
      if (hits.length === 0 && PORTALED_TARGETS.some((prefix) => prefix.test(target))) {
        return false;
      }
      return hits.length !== 1 || hits[0]!.panel !== panel;
    })
    .map(({ attr, target, panel }) => `${attr}="${target}" in panel ${String(panel)}`);
}

/** A stand-in for `FaqSection`'s shape: a section named by a heading it carries the id of. */
function Labelled({ id }: { readonly id: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Heading</h2>
    </section>
  );
}

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );

describe("the id checker itself", () => {
  it("catches the defect: a literal id in a ThemePair child is printed twice", () => {
    const graph = idGraph(render(<ThemePair>{<Labelled id="x" />}</ThemePair>));
    expect(duplicateIds(graph)).toEqual(["x", "x-heading"]);
    // The dark panel's section is named by the LIGHT panel's heading, or by nothing unique.
    expect(strayReferences(graph)).toHaveLength(2);
  });

  it("skips script bodies and understands void and self-closing tags", () => {
    const graph = idGraph(
      '<div data-theme-panel="a"><input id="i"><svg><path d="M0"/></svg>' +
        '<script>if (a<b) {}</script><label for="i"></label></div><p id="out"></p>',
    );
    expect(graph.ids).toEqual([
      { id: "i", panel: "a" },
      { id: "out", panel: null },
    ]);
    expect(strayReferences(graph)).toEqual([]);
  });
});

describe("ThemePair scopes ids per panel", () => {
  it("marks both panels so each id can be attributed to one", () => {
    const graph = idGraph(render(<ThemePair>{"x"}</ThemePair>));
    expect(graph.panels).toEqual({ light: 1, dark: 1 });
  });

  it("hands a render-function child an id helper that differs per panel", () => {
    const graph = idGraph(
      render(<ThemePair>{(panel) => <Labelled id={panel.id("x")} />}</ThemePair>),
    );
    expect(graph.ids.filter((entry) => entry.panel === "light")).toHaveLength(2);
    expect(graph.ids.filter((entry) => entry.panel === "dark")).toHaveLength(2);
    expect(duplicateIds(graph)).toEqual([]);
    expect(strayReferences(graph)).toEqual([]);
  });

  it("keeps the light panel's id as written, so an anchor to it still lands", () => {
    const html = render(<ThemePair>{(panel) => <Labelled id={panel.id("x")} />}</ThemePair>);
    expect(html).toContain('id="x"');
  });
});

describe("every /design-system category", () => {
  it("positive control — the id-bearing specimens were actually rendered in both panels", () => {
    const graph = idGraph(render(specimensFor("duzen", "tr")));
    const faq = graph.ids.filter((entry) => entry.id.startsWith("ornek-sss-liste"));
    expect(new Set(faq.map((entry) => entry.panel))).toEqual(new Set(["light", "dark"]));
    expect(graph.refs.length).toBeGreaterThan(4);
  });

  it("positive control — in-page links are followed, not just aria-* references", () => {
    const graph = idGraph(render(specimensFor("formlar", "tr")));
    const links = graph.refs.filter((ref) => ref.attr === "href");
    expect(new Set(links.map((ref) => ref.panel))).toEqual(new Set(["light", "dark"]));
  });

  it("a reference to an id nobody renders is still caught — only listed portal targets pass", () => {
    const graph = idGraph(
      '<div data-theme-panel="light"><button aria-describedby="tooltip-a"></button>' +
        '<input aria-describedby="missing"></div>',
    );
    expect(strayReferences(graph)).toEqual(['aria-describedby="missing" in panel light']);
  });

  it.each(CATEGORIES.map((category) => category.slug))(
    "%s prints every id once and resolves every IDREF inside its own panel",
    (slug) => {
      const graph = idGraph(render(specimensFor(slug, "tr")));
      expect(duplicateIds(graph), "duplicate ids").toEqual([]);
      expect(strayReferences(graph), "IDREFs that miss their own panel").toEqual([]);
    },
  );
});
