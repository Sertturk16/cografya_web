import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordResetConfirmForm } from "@/components/auth/password-reset-confirm-form";
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
    pathname: "/sifre-sifirlama/yeni",
    title: t("resetNew.metaTitle"),
    description: t("resetNew.metaDescription"),
  });
}

/**
 * `/sifre-sifirlama/yeni` · `/en/reset-password/new` (plan §4.1/§6.2,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). A static Server
 * Component shell mounting one client island, which reads `?token=` itself (§4.1's
 * `useSyncExternalStore` idiom) — the page never reads the query string server-side.
 */
export default async function PasswordResetConfirmPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="container page">
      <h1>{t("resetNew.heading")}</h1>
      <PasswordResetConfirmForm />
    </div>
  );
}
