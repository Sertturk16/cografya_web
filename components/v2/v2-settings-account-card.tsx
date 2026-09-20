"use client";

import { useTranslations } from "next-intl";
import { IdCard } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { Profile } from "@/lib/api/types";
import { SettingsCard, SettingsReadOnlyField } from "./v2-settings-card";
import { formatDay } from "@/lib/text/format-date";

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

  // ONE zone, not the runtime's (T-064). This line formatted `createdAt` with no `timeZone`, so
  // the UTC container and the reader's Europe/Istanbul browser produced different calendar days
  // for any account created after 21:00 UTC — the server wrote `19 Eylül 2026`, the browser wrote
  // `20 Eylül 2026`, and React threw #418 and re-rendered the tree on every single load.
  const memberSince = formatDay(profile.createdAt, locale);

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
