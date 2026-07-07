import { Fraunces, Nunito_Sans } from "next/font/google";

/**
 * Terra visual identity typography (DEC 2026-07-07), loaded via `next/font` so the
 * fonts are self-hosted and preloaded — NOT a render-blocking Google Fonts <link>
 * (CONVENTIONS §6 #9, CWV budget). Both are variable fonts, so no discrete `weight`
 * is requested (the full weight axis ships in one file per family).
 *
 * `latin-ext` is REQUIRED alongside `latin`: Turkish glyphs (İ, ı, ğ, ş, ç, ö, ü)
 * live in the latin-ext subset. Omitting it would break TR rendering / cause CLS.
 */
export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
});

export const nunitoSans = Nunito_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nunito-sans",
  display: "swap",
});
