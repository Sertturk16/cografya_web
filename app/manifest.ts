import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo/site";

/**
 * Web app manifest (App Router `manifest.ts` convention → `/manifest.webmanifest`
 * + auto `<link rel="manifest">`). A single, locale-agnostic file: `name` is
 * single-sourced from `siteConfig`; copy defaults to the TR (default-locale)
 * chrome. `theme_color`/`background_color` mirror the Terra tokens
 * (`--color-primary` / `--color-bg`). Placeholder brand — revisit on rebrand.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: "Coğrafya",
    description: "Ücretsiz, açık coğrafya eğitim platformu.",
    start_url: "/",
    display: "standalone",
    lang: "tr",
    background_color: "#fbf8f3",
    theme_color: "#b0522e",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
