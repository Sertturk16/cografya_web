"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/api/types";
import { V2SettingsAccountCard } from "./v2-settings-account-card";
import { V2SettingsEducationCard } from "./v2-settings-education-card";
import { V2SettingsPersonalCard, type ProvinceOption } from "./v2-settings-personal-card";
import { V2SettingsPasswordCard } from "./v2-settings-password-card";

export interface V2AccountSettingsProps {
  readonly locale: Locale;
  readonly profile: Profile;
  readonly provinces: readonly ProvinceOption[];
}

/**
 * `/hesabim/ayarlar` (T-061) — one page, four independent sections.
 *
 * **Why sections and not tabs.** The hub next door already uses tabs, for content a member
 * browses. Settings are not browsed: a member arrives wanting one specific change, and a
 * tabbed settings page hides three quarters of what they might have come for behind a click.
 * Four stacked cards with a jump list put every section one glance (or one anchor) away.
 *
 * **Why four saves and not one.** Each card owns its own submit and its own result line,
 * because the blocks go to three different endpoints. A single page-level save would either
 * send three requests and have to explain a partial failure, or discard a member's edits in
 * one block because another block was invalid.
 *
 * The education section is absent for a `TEACHER`. That is the whole fix for the "öğretmen
 * için düzenlenecek alan yok" dead end: a teacher gets three full sections instead of one
 * page explaining that it has nothing for them.
 */
export function V2AccountSettings({ locale, profile, provinces }: V2AccountSettingsProps) {
  const t = useTranslations("Settings");

  const showsEducation = profile.accountRole === "STUDENT" || profile.accountRole === "PARENT";

  const sections = [
    { id: "profil-bilgileri", label: t("personal.title") },
    ...(showsEducation ? [{ id: "egitim-bilgileri", label: t("education.title") }] : []),
    { id: "guvenlik", label: t("password.title") },
    { id: "hesap", label: t("account.title") },
  ];

  // The page owns the `<h1>`, not this component. Both of the page's branches — the loaded
  // settings and the "could not load" alert — need exactly one heading between them, and a
  // heading rendered inside the success branch would give the page two reachable `<h1>`
  // elements on mutually exclusive conditions. That is precisely the shape `/profil` used to
  // carry, and the shape whose exemption T-061 deleted; recreating it here would have been
  // the same defect under a new path.
  return (
    <div>
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* A jump list, not a navigation landmark inside a page that already has one: these
            are same-page anchors, so they are announced as links in a list and nothing more. */}
        <nav aria-label={t("sectionNavLabel")} className="hidden lg:block lg:sticky lg:top-24">
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6 min-w-0">
          <V2SettingsPersonalCard profile={profile} provinces={provinces} />
          {showsEducation && <V2SettingsEducationCard locale={locale} profile={profile} />}
          <V2SettingsPasswordCard />
          <V2SettingsAccountCard locale={locale} profile={profile} />
        </div>
      </div>
    </div>
  );
}
