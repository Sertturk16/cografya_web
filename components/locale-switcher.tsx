"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import styles from "./site-header.module.css";

/**
 * Client-side language switcher. Keeps the user on the SAME page across locales by
 * re-localizing the current internal pathname + params (this is the documented
 * next-intl pattern). Purely a UX affordance — the authoritative locale mapping for
 * crawlers is the server-rendered hreflang set in <head>.
 */
export function LocaleSwitcher() {
  const t = useTranslations("Common");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const params = useParams();

  return (
    <nav aria-label={t("localeSwitcherLabel")} className={styles.localeSwitcher}>
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          // @ts-expect-error -- pathname+params always match for the current route,
          // so re-localizing across locales is safe; TS can't prove the pairing.
          href={{ pathname, params }}
          locale={locale}
          hrefLang={locale}
          aria-current={locale === currentLocale ? "true" : undefined}
          className={locale === currentLocale ? styles.localeActive : undefined}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
