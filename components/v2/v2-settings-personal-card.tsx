"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { useUnsavedChanges } from "@/lib/forms/use-unsaved-changes.client";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import type { Profile } from "@/lib/api/types";
import {
  canonicalizePhone,
  formatTurkishMobileInput,
  PHONE_INPUT_MAX_LENGTH,
} from "@/lib/auth/form-rules";
import { PROFILE_ERROR_MESSAGE_KEYS, submitAccountReplacement } from "@/lib/profile/client";
import type { ProfileBffCode } from "@/lib/profile/transport.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SettingsCard, SettingsFieldError, SettingsResult } from "./v2-settings-card";

export interface ProvinceOption {
  readonly plateCode: string;
  readonly nameTr: string;
}

export interface V2SettingsPersonalCardProps {
  readonly profile: Profile;
  readonly provinces: readonly ProvinceOption[];
}

type FieldKey = "firstName" | "lastName" | "phone" | "provincePlateCode" | "districtId";

const IDS: Record<FieldKey, string> = {
  firstName: "settings-first-name",
  lastName: "settings-last-name",
  phone: "settings-phone",
  provincePlateCode: "settings-province",
  districtId: "settings-district",
};

/**
 * "Profil bilgileri" — the personal block (T-061).
 *
 * Everyone sees this card, teacher included: it is what makes the settings page a real page
 * for an account with no education fields, rather than the empty room `/profil` used to show
 * a teacher.
 *
 * The district list is fetched per province rather than shipped whole (81 provinces × ~12
 * districts is a payload no one needs), and changing the province clears the district —
 * keeping the old one would send the API a pair it refuses, and the member would be told a
 * field they can see is wrong when the one they changed is the cause.
 */
export function V2SettingsPersonalCard({ profile, provinces }: V2SettingsPersonalCardProps) {
  const t = useTranslations("Settings");
  const tAuth = useTranslations("Auth");
  const router = useRouter();

  const [firstName, setFirstName] = React.useState(profile.firstName);
  const [lastName, setLastName] = React.useState(profile.lastName);
  // MASKED ON THE WAY IN, NOT JUST ON THE WAY THROUGH (T-072). `profile.phone` arrives from
  // the api in its stored `+905XXXXXXXXX` form, and the field shows `5XX XXX XX XX` — so the
  // seed is formatted here and the baseline below is seeded from the SAME expression. Seeding
  // one and not the other would make the card claim an unsaved edit (T-062's warning) on first
  // paint, before the member has touched anything.
  const [phone, setPhone] = React.useState(() => formatTurkishMobileInput(profile.phone));
  const [plateCode, setPlateCode] = React.useState(profile.provincePlateCode);
  const [districtId, setDistrictId] = React.useState(profile.districtId);

  const [districts, setDistricts] = React.useState<Array<{ id: string; nameTr: string }>>([
    { id: profile.districtId, nameTr: profile.districtName },
  ]);
  const [loadedPlate, setLoadedPlate] = React.useState(profile.provincePlateCode);

  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<ProfileBffCode | null>(null);

  /**
   * What the fields above are compared against to decide "has this member typed something they
   * have not saved" (T-062). It starts at the server's values and moves to the saved values on a
   * successful submit, which is what makes the warning stop once the edit is safe — a comparison
   * against the `profile` prop alone would keep claiming unsaved edits after the save that
   * produced them, because a client-navigated `router.refresh()` does not remount this card.
   */
  const [baseline, setBaseline] = React.useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: formatTurkishMobileInput(profile.phone),
    provincePlateCode: profile.provincePlateCode,
    districtId: profile.districtId,
  });

  useUnsavedChanges(
    firstName !== baseline.firstName ||
      lastName !== baseline.lastName ||
      phone !== baseline.phone ||
      plateCode !== baseline.provincePlateCode ||
      districtId !== baseline.districtId,
  );

  React.useEffect(() => {
    if (plateCode === loadedPlate) return;
    let active = true;
    const controller = new AbortController();
    fetch(`/api/reference/districts/${encodeURIComponent(plateCode)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: unknown) => {
        if (!active || !Array.isArray(data)) return;
        const rows = data as Array<{ id: string; nameTr: string }>;
        setDistricts(rows);
        setDistrictId(rows[0]?.id ?? "");
        setLoadedPlate(plateCode);
      })
      .catch(() => {
        // A failed list leaves the previous one on screen; submitting then fails loudly on
        // the API's district/province check rather than writing a mismatched pair.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [plateCode, loadedPlate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSubmitError(null);

    const next: Partial<Record<FieldKey, string>> = {};
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = canonicalizePhone(phone);

    if (!cleanFirst) next.firstName = tAuth("fieldErrors.required");
    if (!cleanLast) next.lastName = tAuth("fieldErrors.required");
    if (!cleanPhone) next.phone = t("personal.phoneInvalid");
    if (!plateCode) next.provincePlateCode = tAuth("fieldErrors.required");
    if (!districtId) next.districtId = tAuth("fieldErrors.required");

    if (Object.keys(next).length > 0) {
      setErrors(next);
      const first = Object.keys(next)[0] as FieldKey | undefined;
      if (first) document.getElementById(IDS[first])?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitAccountReplacement({
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone as string,
        provincePlateCode: plateCode,
        districtId,
      });
      if (res.ok) {
        setSaved(true);
        setFirstName(res.profile.firstName);
        setLastName(res.profile.lastName);
        setPhone(formatTurkishMobileInput(res.profile.phone));
        setPlateCode(res.profile.provincePlateCode);
        setDistrictId(res.profile.districtId);
        setBaseline({
          firstName: res.profile.firstName,
          lastName: res.profile.lastName,
          phone: formatTurkishMobileInput(res.profile.phone),
          provincePlateCode: res.profile.provincePlateCode,
          districtId: res.profile.districtId,
        });
        // The header greets the member by first name and reads it from the session, so a
        // rename has to invalidate the server render, not just this card's state.
        router.refresh();
      } else {
        setSubmitError(res.code);
      }
    } catch {
      setSubmitError("errors.transport.unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SettingsCard
      id="profil-bilgileri"
      icon={<UserRound className="size-5" />}
      title={t("personal.title")}
      description={t("personal.description")}
    >
      <SettingsResult
        saved={saved}
        savedMessage={t("saved")}
        errorMessage={submitError ? tAuth(PROFILE_ERROR_MESSAGE_KEYS[submitError]) : null}
      />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={IDS.firstName} className="text-xs font-bold text-foreground">
              {t("personal.firstName")}
            </Label>
            <Input
              id={IDS.firstName}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={submitting}
              maxLength={100}
              autoComplete="given-name"
              isError={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? `${IDS.firstName}-error` : undefined}
            />
            <SettingsFieldError id={`${IDS.firstName}-error`} message={errors.firstName} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={IDS.lastName} className="text-xs font-bold text-foreground">
              {t("personal.lastName")}
            </Label>
            <Input
              id={IDS.lastName}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={submitting}
              maxLength={100}
              autoComplete="family-name"
              isError={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? `${IDS.lastName}-error` : undefined}
            />
            <SettingsFieldError id={`${IDS.lastName}-error`} message={errors.lastName} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={IDS.phone} className="text-xs font-bold text-foreground">
            {t("personal.phone")}
          </Label>
          <Input
            id={IDS.phone}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatTurkishMobileInput(e.target.value))}
            disabled={submitting}
            autoComplete="tel"
            inputMode="numeric"
            maxLength={PHONE_INPUT_MAX_LENGTH}
            placeholder="5xx xxx xx xx"
            isError={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${IDS.phone}-error` : undefined}
          />
          <SettingsFieldError id={`${IDS.phone}-error`} message={errors.phone} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={IDS.provincePlateCode} className="text-xs font-bold text-foreground">
              {t("personal.province")}
            </Label>
            <Select
              id={IDS.provincePlateCode}
              value={plateCode}
              onChange={(e) => setPlateCode(e.target.value)}
              disabled={submitting}
              isError={Boolean(errors.provincePlateCode)}
            >
              {provinces.map((p) => (
                <option key={p.plateCode} value={p.plateCode}>
                  {p.nameTr}
                </option>
              ))}
            </Select>
            <SettingsFieldError
              id={`${IDS.provincePlateCode}-error`}
              message={errors.provincePlateCode}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={IDS.districtId} className="text-xs font-bold text-foreground">
              {t("personal.district")}
            </Label>
            <Select
              id={IDS.districtId}
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              disabled={submitting}
              isError={Boolean(errors.districtId)}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameTr}
                </option>
              ))}
            </Select>
            <SettingsFieldError id={`${IDS.districtId}-error`} message={errors.districtId} />
          </div>
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={submitting}
            className="w-full sm:w-auto min-w-32 text-xs font-bold"
          >
            {t("save")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
