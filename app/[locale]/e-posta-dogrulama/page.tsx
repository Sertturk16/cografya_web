import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
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
    pathname: "/e-posta-dogrulama",
    title: t("verify.metaTitle"),
    description: t("verify.metaDescription"),
  });
}

/**
 * `/e-posta-dogrulama` · `/en/verify-email` (plan §4.1/§6.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`) — the standalone
 * verification screen a visitor reaches after a reload during `/kayit`'s step 2, or directly
 * from a mail link. A Server Component shell — no `cookies()`, no `getSession()` — that
 * mounts one `"use client"` island (`VerifyEmailForm`). The page therefore stays statically
 * rendered (`lib/auth/session.ts`'s R4 prohibition).
 */
export default async function VerifyEmailPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="container page">
      <h1>{t("verify.heading")}</h1>
      <VerifyEmailForm locale={locale} />
    </div>
  );
}
