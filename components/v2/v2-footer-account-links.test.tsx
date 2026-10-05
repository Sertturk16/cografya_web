import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
import { V2FooterAccountLinks, V2FooterAccountLinksView } from "./v2-footer-account-links";

/**
 * T-163: the footer's account rows followed no session at all, so a signed-in reader was offered
 * "Giriş Yap / Ücretsiz Kayıt Ol". The footer stays a server component (the `(site)` layout's ISR
 * pages must stay static); the two rows are a client island reading the shared session store.
 */

function render(element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="tr" messages={trMessages} timeZone="Europe/Istanbul">
      <ul>{element}</ul>
    </NextIntlClientProvider>,
  );
}

describe("V2FooterAccountLinksView", () => {
  it("a guest keeps the two links the footer always had", () => {
    const html = render(<V2FooterAccountLinksView state="anonymous" />);
    expect(html).toContain('href="/giris"');
    expect(html).toContain(">Giriş Yap<");
    expect(html).toContain('href="/kayit"');
    expect(html).toContain(">Ücretsiz Kayıt Ol<");
    expect(html).not.toContain("/hesabim");
  });

  it("a signed-in reader gets Hesabım and Ayarlar, and no sign-out (the header menu owns it)", () => {
    const html = render(<V2FooterAccountLinksView state="authenticated" />);
    expect(html).toContain('href="/hesabim"');
    expect(html).toContain(">Hesabım<");
    expect(html).toContain('href="/hesabim/ayarlar"');
    expect(html).toContain(">Ayarlar<");
    expect(html).not.toContain("Giriş Yap");
    expect(html).not.toContain("Kayıt Ol");
    expect(html).not.toContain("Çıkış");
  });

  it("while the session check runs, two hidden rows hold the place and no link shows", () => {
    const html = render(<V2FooterAccountLinksView state="checking" />);
    expect(html.match(/<li aria-hidden="true"/g)).toHaveLength(2);
    expect(html).not.toContain("<a");
    expect(html).not.toContain("Giriş Yap");
    expect(html).not.toContain("Hesabım");
  });
});

describe("V2FooterAccountLinks", () => {
  it("renders the checking placeholder on the server, so a member never sees Giriş Yap flash", () => {
    const html = render(<V2FooterAccountLinks />);
    expect(html).toBe(render(<V2FooterAccountLinksView state="checking" />));
    expect(html).not.toContain("Giriş Yap");
  });
});

describe("the footer itself stays static", () => {
  const footer = stripComments(readFileSync(new URL("./v2-footer.tsx", import.meta.url), "utf8"));

  it("renders the island instead of hard-coded account links", () => {
    expect(footer).toContain("<V2FooterAccountLinks />");
    expect(footer).not.toContain('"/giris"');
    expect(footer).not.toContain('"/kayit"');
  });

  it("reads no request state (its pages are ISR)", () => {
    expect(footer).not.toContain("cookies(");
    expect(footer).not.toContain("getSession");
    expect(footer).not.toContain('"use client"');
  });
});
