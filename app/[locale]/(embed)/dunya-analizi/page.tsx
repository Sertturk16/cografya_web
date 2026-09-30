import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { V2WorldMapFrame } from "@/components/v2/v2-world-map-frame";

/** Same words as the header's nav label (docs/copy.md, "One name per page"). */
const PAGE_TITLE = "Dünya Analizi";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    hrefForLocale: () => "/dunya-analizi",
    title: PAGE_TITLE,
    description:
      "Dünya genelinde rüzgârı, dalgaları ve okyanus akıntılarını harita üzerinde izle. Harita earth.nullschool.net'ten gelir.",
    // The page has no content of ours, only the frame.
    surface: "noindex",
  });
}

export default async function WorldAnalysisPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <h1 className="sr-only">{PAGE_TITLE}</h1>
      <V2WorldMapFrame title={PAGE_TITLE} />
    </>
  );
}
