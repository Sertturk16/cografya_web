"use client";

import { useTranslations } from "next-intl";
import { IdCard } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/api/types";
import { SettingsCard, SettingsReadOnlyField } from "./v2-settings-card";

export interface V2SettingsAccountCardProps {
  readonly locale: Locale;
  readonly profile: Profile;
}

/**
 * "Hesap" — the three facts a member can read about their account and change nowhere (T-061).
 *
 * The e-mail address is here rather than in the editable card above it because changing it
 * needs a proof-of-mailbox round trip to the NEW address, which is its own flow; the API's
 * `PUT /auth/account` has no `email` field at all. Showing it read-only is still worth a
 * section: before T-061 a member could not see which address their account uses from
 * anywhere in the product.
 */
export function V2SettingsAccountCard({ locale, profile }: V2SettingsAccountCardProps) {
  const t = useTranslations("Settings");

  const roleLabel =
    profile.accountRole === "TEACHER"
      ? t("account.roleTeacher")
      : profile.accountRole === "PARENT"
        ? t("account.roleParent")
        : t("account.roleStudent");

  const memberSince = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(profile.createdAt));

  return (
    <SettingsCard
      id="hesap"
      icon={<IdCard className="size-5" />}
      title={t("account.title")}
      description={t("account.description")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SettingsReadOnlyField label={t("account.email")} value={profile.email} />
        <SettingsReadOnlyField label={t("account.role")} value={roleLabel} />
        <SettingsReadOnlyField label={t("account.memberSince")} value={memberSince} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t("account.emailNotice")}
      </p>
    </SettingsCard>
  );
}
