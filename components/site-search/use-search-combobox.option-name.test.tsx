import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import type { SearchEntityKind } from "@/lib/search/types";
import { useSearchCombobox } from "./use-search-combobox";

/**
 * T-170: each search option's accessible name is "name, kind" ("Ege Bölgesi, Bölge"), not the
 * name and the kind badge run together ("Ege BölgesiBölge"). Both boxes spread the same
 * `optionProps`, so rendering one option through the hook pins the name both boxes expose.
 */

function OptionProbe({ name, kind }: { name: string; kind: SearchEntityKind }) {
  const combobox = useSearchCombobox({
    open: true,
    hasQuery: true,
    panelState: "results",
    optionCount: 1,
    onSelect: () => {},
  });
  return (
    <div {...combobox.optionProps(0, { name, kind })}>
      <span>{name}</span>
      <span>badge</span>
    </div>
  );
}

function renderOption(locale: "tr" | "en", name: string, kind: SearchEntityKind): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "tr" ? trMessages : enMessages}
      timeZone="Europe/Istanbul"
    >
      <OptionProbe name={name} kind={kind} />
    </NextIntlClientProvider>,
  );
}

describe("a search option's accessible name", () => {
  it("reads the place name, a comma, then the kind (TR)", () => {
    const html = renderOption("tr", "Ege Bölgesi", "r");
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-label="Ege Bölgesi, Bölge"');
  });

  it("reads the place name, a comma, then the kind (EN)", () => {
    expect(renderOption("en", "Aegean Region", "r")).toContain(
      'aria-label="Aegean Region, Region"',
    );
  });

  it("names every kind with its own label", () => {
    const expected: Record<SearchEntityKind, string> = {
      p: "İl",
      c: "Ülke",
      r: "Bölge",
      k: "Kıta",
      s: "Deniz",
      t: "Araç",
      g: "Sayfa",
    };
    for (const [kind, label] of Object.entries(expected)) {
      expect(renderOption("tr", "Ad", kind as SearchEntityKind)).toContain(
        `aria-label="Ad, ${label}"`,
      );
    }
  });
});
