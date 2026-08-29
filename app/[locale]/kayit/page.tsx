import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthPlate } from "@/components/auth/auth-plate";
import panelStyles from "@/components/auth/auth-panel.module.css";
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
 * `/kayit` · `/en/register` (uyelik-auth-redesign plan §5.1/§5.3, superseding the earlier
 * single-column shell `UYELIK-04-web-plan.md` originally shipped). A Server Component shell —
 * no `cookies()`, no `getSession()` — that reads the province list once (the same
 * `getProvincesResilient()` every enumerating build-time consumer in this repo already uses)
 * and lays out the two-panel auth surface: the survey plate (`AuthPlate`, pure presentation)
 * and the form column, which mounts one `"use client"` island (`RegisterForm`). The page no
 * longer renders its own `<h1>` — `RegisterForm` now renders it itself, inside its own card
 * (`.formHeader`), so the SAME component serves the page and the modal without a second
 * heading implementation. The page therefore stays statically rendered
 * (`lib/auth/session.ts`'s R4 prohibition).
 */
export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const provinces = await getProvincesResilient();

  return (
    <div className="container page">
      <div className={panelStyles.layout}>
        <div className={panelStyles.plateSlot}>
          <AuthPlate />
        </div>
        <div className={panelStyles.formSlot}>
          <RegisterForm locale={locale} provinces={provinces} />
        </div>
      </div>
    </div>
  );
}
