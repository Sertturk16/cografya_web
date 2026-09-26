"use client";

import { useTranslations } from "next-intl";
import { isApplePlatform } from "@/lib/map/wheel-zoom";

/**
 * "Yakınlaştırmak için Ctrl + tekerlek" over a map after a plain wheel (T-116). Rendered only
 * while visible, which is only ever after a client-side wheel event, so reading `navigator` here
 * never differs between the server and the first client render. Hidden from screen readers: it
 * explains a pointer gesture, and the zoom buttons are the accessible path.
 */
export function MapWheelHint({ visible }: { visible: boolean }) {
  const t = useTranslations("Map");
  if (!visible) return null;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const key = isApplePlatform(nav.userAgentData?.platform || nav.platform) ? "⌘" : "Ctrl";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4"
    >
      <span className="rounded-2xl bg-ink-dark/95 px-3.5 py-2 text-sm text-white shadow-2xl ring-1 ring-white/15 animate-in fade-in-0 duration-150">
        {t("wheelHint", { key })}
      </span>
    </div>
  );
}
