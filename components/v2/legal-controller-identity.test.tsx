import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGAL_CONTROLLER } from "@/lib/legal/controller";
import { LegalControllerIdentity } from "./legal-controller-identity";

const LABELS = {
  siteName: "Site",
  legalName: "Unvan",
  address: "Adres",
  phone: "Telefon",
  email: "E-posta",
};

describe("LegalControllerIdentity (T-101)", () => {
  it("renders the site name and a mailto link to the controller address", () => {
    const html = renderToStaticMarkup(<LegalControllerIdentity labels={LABELS} />);
    expect(html).toContain(LEGAL_CONTROLLER.siteName);
    expect(html).toContain(`href="mailto:${LEGAL_CONTROLLER.email}"`);
  });

  it("omits every field that is still null", () => {
    const html = renderToStaticMarkup(
      <LegalControllerIdentity
        labels={LABELS}
        controller={{ ...LEGAL_CONTROLLER, legalName: null, address: null, phone: null }}
      />,
    );
    expect(html).not.toContain(">Unvan<");
    expect(html).not.toContain(">Adres<");
    expect(html).not.toContain(">Telefon<");
  });

  it("renders unvan, adres and telefon once they are filled", () => {
    const html = renderToStaticMarkup(
      <LegalControllerIdentity
        labels={LABELS}
        controller={{
          ...LEGAL_CONTROLLER,
          legalName: "Örnek Yayıncılık Ltd. Şti.",
          address: "Örnek Mah. 1. Sok. No: 1, Ankara",
          phone: "0312 000 00 00",
        }}
      />,
    );
    expect(html).toContain("Örnek Yayıncılık Ltd. Şti.");
    expect(html).toContain("Örnek Mah. 1. Sok. No: 1, Ankara");
    expect(html).toContain("0312 000 00 00");
  });

  it("uses the site's published contact address", () => {
    expect(LEGAL_CONTROLLER.email).toBe("info@cografyagurmesi.com");
  });
});
