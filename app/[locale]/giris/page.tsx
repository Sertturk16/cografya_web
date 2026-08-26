import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import type { Locale } from "@/i18n/routing";
import { buildAuthMetadata } from "@/lib/auth/auth-metadata";

interface PageProps {
  readonly params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return buildAuthMetadata({
    locale,
    pathname: "/giris",
    title: t("login.metaTitle"),
    description: t("login.metaDescription"),
  });
}

/**
 * `/giris` · `/en/login` (plan §4.1/§6.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). A Server Component
 * shell — no `cookies()`, no `getSession()` — that mounts one `"use client"` island
 * (`LoginForm`), which reads the session and the `?returnTo=` query string itself. The page
 * therefore stays statically rendered (`lib/auth/session.ts`'s R4 prohibition).
 */
export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="container page">
      <h1>{t("login.heading")}</h1>
      <LoginForm locale={locale} />
    </div>
  );
}
