"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Compass, GraduationCap, Users } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import type { AccountRole } from "@/lib/api/types";
import { ACCOUNT_ROLE_LABELS, ACCOUNT_ROLE_ORDER, renderLabel } from "@/lib/auth/profile-labels";

const ROLE_ICONS: Record<AccountRole, React.ReactNode> = {
  STUDENT: <GraduationCap className="size-3.5 shrink-0" />,
  TEACHER: <Briefcase className="size-3.5 shrink-0" />,
  PARENT: <Users className="size-3.5 shrink-0" />,
  ENTHUSIAST: <Compass className="size-3.5 shrink-0" />,
};

export interface AccountRolePickerProps {
  readonly locale: Locale;
  readonly idPrefix: string;
  readonly value: AccountRole;
  readonly onChange: (role: AccountRole) => void;
  readonly disabled?: boolean;
}

/**
 * The four account types as one radio group (T-103), used by registration step 1 and the
 * settings card. Roving tabindex with arrow keys, as the register card's two-option group had.
 * Labels wrap instead of truncating: "Coğrafya meraklısı" does not fit half a 320 px card.
 */
export function AccountRolePicker({
  locale,
  idPrefix,
  value,
  onChange,
  disabled = false,
}: AccountRolePickerProps) {
  const t = useTranslations("Auth");
  const labelId = `${idPrefix}-label`;

  const move = (from: number, delta: number, group: HTMLElement | null) => {
    const count = ACCOUNT_ROLE_ORDER.length;
    const index = (from + delta + count) % count;
    const next = ACCOUNT_ROLE_ORDER[index];
    if (next) onChange(next);
    (group?.children[index] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block text-xs font-bold text-foreground">
        {t("fields.accountRole")}
      </span>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-labelledby={labelId}>
        {ACCOUNT_ROLE_ORDER.map((role, idx) => {
          const checked = value === role;
          const label = renderLabel(locale, ACCOUNT_ROLE_LABELS[role]);
          return (
            <button
              key={role}
              id={`${idPrefix}-${role.toLowerCase()}`}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(role)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  move(idx, 1, e.currentTarget.parentElement);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  move(idx, -1, e.currentTarget.parentElement);
                }
              }}
              className={`min-h-10 p-2 rounded-xl border text-xs font-medium flex items-center gap-2 text-left transition-all ${
                checked
                  ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                  : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {ROLE_ICONS[role]}
              <span className="text-[11px] leading-tight" lang={label.lang}>
                {label.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
