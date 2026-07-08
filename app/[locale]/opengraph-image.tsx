import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { brandGlyphDataUri } from "@/lib/brand/glyph";
import { routing, type Locale } from "@/i18n/routing";
import { siteConfig } from "@/lib/seo/site";

// Default social share image for every page under `[locale]` (App Router
// `opengraph-image` convention → og:image AND twitter:image are injected
// automatically, resolved absolute via `metadataBase`). Placeholder Terra brand
// card — owner-approved until the brand lands.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = siteConfig.name;

// Prebuild one card per locale (SSG); keeps the route static, not on-demand.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OpengraphImage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  // Locale-aware: the tagline is the only per-locale line (brand name is invariant).
  const t = await getTranslations({ locale, namespace: "Footer" });
  const tagline = t("tagline");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#fbf8f3",
        color: "#2b2622",
        borderTop: "16px solid #b0522e",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* next/og (satori) renders a raw <img>; next/image is not available here. */}
        <img
          src={brandGlyphDataUri({ size: 104, radiusRatio: 0.22 })}
          width={104}
          height={104}
          alt=""
        />
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#7e3a1e" }}>
          {siteConfig.name}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 62,
          fontWeight: 700,
          lineHeight: 1.15,
          maxWidth: 980,
          color: "#2b2622",
        }}
      >
        {tagline}
      </div>
    </div>,
    { ...size },
  );
}
