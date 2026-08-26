import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";
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
    pathname: "/sifre-sifirlama",
    title: t("reset.metaTitle"),
    description: t("reset.metaDescription"),
  });
}

/**
 * `/sifre-sifirlama` · `/en/reset-password` (plan §4.1/§6.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). A static Server
 * Component shell mounting one client island.
 */
export default async function PasswordResetRequestPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="container page">
      <h1>{t("reset.heading")}</h1>
      <PasswordResetRequestForm />
    </div>
  );
}
