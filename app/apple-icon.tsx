import { ImageResponse } from "next/og";
import { brandGlyphDataUri } from "@/lib/brand/glyph";

// App Router apple-touch-icon convention → emits a PNG + <link rel="apple-touch-icon">.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon. iOS applies its own rounded corner mask and dislikes
 * transparency, so this is a FULL-BLEED Terra square (radiusRatio 0) with the
 * white ◭ mark. Placeholder brand (owner-approved) — swap on rebrand.
 */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >
      {/* next/og (satori) renders a raw <img>; next/image is not available here. */}
      <img src={brandGlyphDataUri({ size: 180, radiusRatio: 0 })} width={180} height={180} alt="" />
    </div>,
    { ...size },
  );
}
