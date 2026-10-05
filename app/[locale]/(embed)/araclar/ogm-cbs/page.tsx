import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";
import { OGM_CBS_PATHNAME } from "@/lib/tools/tool-registry";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OGM_CBS_URL, V2OgmCbsFrame } from "@/components/v2/v2-ogm-cbs-frame";

/** Same words as the links that lead here (docs/copy.md, "One name per page"). */
const PAGE_TITLE = "OGM Materyal CBS";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildMetadata({
    locale,
    hrefForLocale: () => OGM_CBS_PATHNAME,
    title: PAGE_TITLE,
    description:
      "Millî Eğitim Bakanlığı Ortaöğretim Genel Müdürlüğü'nün coğrafi bilgi sistemi: harita katmanı oluştur, il ve ilçe verisini haritada göster, ölçüm ve analiz yap.",
    // The page has no content of ours, only the frame.
    surface: "noindex",
  });
}

/**
 * A bar under the header that names the platform and links out, and the framed platform filling
 * the rest. Below `md` the frame is not rendered (`V2OgmCbsFrame`), so the bar becomes the whole
 * page: the same heading, a fuller description and the link.
 */
export default async function OgmCbsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex h-full flex-col">
      <div className="overflow-y-auto md:shrink-0 md:border-b md:border-border md:bg-card">
        <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-10 sm:px-6 md:max-w-7xl lg:px-8 md:flex-row md:items-center md:justify-between md:gap-6 md:py-2.5">
          <div className="min-w-0 space-y-2 md:space-y-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-lg">
              {PAGE_TITLE}
            </h1>
            <p className="text-sm text-muted-foreground">
              Millî Eğitim Bakanlığı Ortaöğretim Genel Müdürlüğü&apos;nün coğrafi bilgi sistemi.
            </p>
            <p className="text-sm text-muted-foreground md:hidden">
              Haritaya nokta, çizgi ve alan çiz; il ya da ilçe verisi olan bir Excel dosyasını
              yükleyip haritada göster. Harita ekranı geniş olduğu için telefonda yeni sekmede
              açılır.
            </p>
          </div>
          <a
            href={OGM_CBS_URL}
            target="_blank"
            rel="noopener"
            className={cn(
              buttonVariants({ variant: "primary", size: "md" }),
              // The header's "Üye Ol" size from `md` up; a full-width 44px target on phones.
              "min-h-11 w-full shrink-0 md:h-8 md:min-h-0 md:w-auto md:px-3 md:text-xs md:font-semibold md:shadow-xs",
            )}
          >
            Yeni Sekmede Aç
            <ExternalLink className="size-4 md:size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="relative hidden min-h-0 flex-1 md:block">
        <V2OgmCbsFrame title={PAGE_TITLE} />
      </div>
    </div>
  );
}
