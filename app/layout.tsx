import type { Metadata } from "next";

// NOTE (PR-0w scaffold): minimal placeholder metadata only. The full SEO surface
// (metadataBase, templated titles, canonical, hreflang, JSON-LD) and the next-intl
// i18n layer arrive in PR-2w — do not extend metadata here.
export const metadata: Metadata = {
  title: "Coğrafya Platform",
  description: "Coğrafya eğitim platformu — geliştirme iskeleti (PR-0w).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
