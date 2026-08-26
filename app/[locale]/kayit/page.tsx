import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";
import type { Locale } from "@/i18n/routing";
import { getProvincesResilient } from "@/lib/api/provinces";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";

interface PageProps {
  readonly params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return buildAuthMetadata({
    locale,
    pathname: "/kayit",
    title: t("register.metaTitle"),
    description: t("register.metaDescription"),
  });
}

/**
 * `/kayit` · `/en/register` (plan §4.1/§6.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). A Server Component
 * shell — no `cookies()`, no `getSession()` — that reads the province list once (the same
 * `getProvincesResilient()` every enumerating build-time consumer in this repo already uses)
 * and mounts one `"use client"` island (`RegisterForm`), which owns everything else: the
 * dependent il→ilçe select, the lazily-fetched university/department lists, and the
 * two-step submit. The page therefore stays statically rendered
 * (`lib/auth/session.ts`'s R4 prohibition).
 */
export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  const provinces = await getProvincesResilient();

  return (
    <div className="container page">
      <h1>{t("register.heading")}</h1>
      <RegisterForm locale={locale} provinces={provinces} />
    </div>
  );
}
