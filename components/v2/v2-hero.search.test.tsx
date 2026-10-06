import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
import { V2Hero } from "./v2-hero";

/**
 * T-168: the homepage hero's search box gives the same keyboard and screen-reader behaviour as
 * the header box. Both use `useSearchCombobox` (the keys and the announcement are unit-tested
 * in `lib/search/`); this pins that the hero renders the combobox it provides. The open panel
 * needs interaction, so its listbox and options are pinned in the source and checked in the
 * browser.
 */

function renderHero(): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <V2Hero title="Başlık" lede="Lede" stats={null} />
    </NextIntlClientProvider>,
  );
}

function inputTag(html: string): string {
  return html.match(/<input[^>]*>/)?.[0] ?? "";
}

describe("the hero search box (closed, as first rendered)", () => {
  const html = renderHero();
  const input = inputTag(html);

  it("is an ARIA combobox that controls a listbox and says it is collapsed", () => {
    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-expanded="false"');
    expect(input).toContain('aria-autocomplete="list"');
    expect(input).toMatch(/aria-controls="[^"]+-listbox"/);
    expect(input).not.toContain("aria-activedescendant");
  });

  it("keeps the accessible name that says what is searchable", () => {
    expect(input).toContain(`aria-label="${trMessages.Search.label}"`);
  });

  it("has a polite status region for the result count", () => {
    expect(html).toMatch(/<div role="status" aria-live="polite" class="sr-only"><\/div>/);
  });

  it("draws the placeholder at full muted-foreground (4.5:1 in both themes, measured)", () => {
    expect(input).toContain("placeholder:text-muted-foreground ");
    expect(input).not.toMatch(/placeholder:text-muted-foreground\/\d+/);
  });
});

describe("the hero's suggestion panel (source)", () => {
  const code = stripComments(readFileSync(new URL("./v2-hero.tsx", import.meta.url), "utf8"));
  const flat = code.replace(/\s+/g, " ");

  it("uses the header's shared combobox behaviour", () => {
    expect(code).toContain('from "@/components/site-search/use-search-combobox"');
    expect(code).toContain("useSearchCombobox({");
    expect(code).toContain("{...combobox.inputProps}");
    expect(code).toContain("combobox.handleKey(e)");
  });

  it("renders the hits as options owned by a listbox", () => {
    expect(flat).toContain("<ul {...combobox.listboxProps}");
    expect(flat).toContain('<li key={hit.path} role="presentation">');
    expect(flat).toContain("{...combobox.optionProps(index)}");
    expect(flat).not.toMatch(/<button[^>]*onClick=\{\(\) => handleNavigate/);
  });

  it("closes the panel on Escape, since the hero has no dialog to own it", () => {
    expect(flat).toMatch(/e\.key === "Escape"\) \{ setIsOpen\(false\);/);
  });
});
