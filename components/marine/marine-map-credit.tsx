import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MARINE_SOURCES_ANCHOR } from "@/lib/marine/attribution-anchor";

/**
 * The sea readings' line in the map's fullscreen credit (T-119). On the page they are credited by
 * `MarineDataNotice`, which is off screen in fullscreen; this line names the two providers and
 * links to the same central licence block (`/hakkimizda`) the notice links to.
 */
export function MarineMapCredit() {
  const t = useTranslations("Map");
  return (
    <span>
      {t.rich("attributionMarine", {
        sources: (chunks) => (
          <Link href={MARINE_SOURCES_ANCHOR} className="underline hover:no-underline">
            {chunks}
          </Link>
        ),
      })}
    </span>
  );
}
