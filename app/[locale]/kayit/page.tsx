import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthPlate } from "@/components/auth/auth-plate";
import panelStyles from "@/components/auth/auth-panel.module.css";
import { RegisterForm } from "@/components/auth/register-form";
import type { Locale } from "@/i18n/routing";
import { getProvinces } from "@/lib/api/provinces";
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
 * no `cookies()`, no `getSession()` — that reads the province list once and lays out the
 * two-panel auth surface: the survey plate (`AuthPlate`, pure presentation) and the form
 * column, which mounts one `"use client"` island (`RegisterForm`). The page no longer renders
 * its own `<h1>` — `RegisterForm` now renders it itself, inside its own card
 * (`.formHeader`), so the SAME component serves the page and the modal without a second
 * heading implementation.
 *
 * `force-dynamic`: the province list feeds a REQUIRED registration-form field (province is
 * not optional), so a build-time api outage baking an empty `[]` into this route would ship
 * a permanently broken sign-up form until the next ISR revalidation — up to an hour of
 * silent breakage after every deploy (T-020's bug class). This is a route-segment config
 * export, not a UI/CSS change, so it does not touch the V1-frozen surface: `RegisterForm`,
 * `AuthPlate` and `auth-panel.module.css` are all untouched.
 *
 * A11Y105-I1 fix: `formSlot` (carrying `RegisterForm`'s `<h1>`) is rendered BEFORE `plateSlot`
 * (carrying `AuthPlate`'s decorative `<h2>`) — DOM/reading order is viewport-independent, so
 * this keeps the page's real `<h1>` ahead of the plate's `<h2>` for a screen-reader user at
 * every breakpoint. The two-panel VISUAL arrangement (plate left, form right at `64rem`+) is
 * produced entirely by `auth-panel.module.css`'s explicit `order` values, not by source order.
 */
export const dynamic = "force-dynamic";

export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const provinces = await getProvinces();

  return (
    <div className="container page">
      <div className={panelStyles.layout}>
        <div className={panelStyles.formSlot}>
          <RegisterForm locale={locale} provinces={provinces} />
        </div>
        <div className={panelStyles.plateSlot}>
          <AuthPlate />
        </div>
      </div>
    </div>
  );
}
