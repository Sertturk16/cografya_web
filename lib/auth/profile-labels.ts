import type { Locale } from "@/i18n/routing";
import type {
  AccountRole,
  EducationLevel,
  GradeLevel,
  InstitutionType,
  ReferralSource,
  StudyStream,
  TeacherSubject,
  UniversityType,
} from "@/lib/api/types";

/**
 * Label tables for the four closed sets the registration screen renders (plan §4.3.4,
 * `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`) — the "Kullanıcı tipi"
 * control, `gradeLevel`, `studyStream`, and the university list's `<optgroup>` grouping.
 * `GLOSSARY.md` §4.4 / §7.1 / §7.2 is the canonical source for every string below; nothing
 * here is minted.
 *
 * A row with no `en` renders `tr` with `lang="tr"` on the EN page (WCAG 3.1.2) — the same
 * treatment `app/[locale]/(site)/hakkimizda/page.tsx` and `components/marine/marine-attribution.tsx`
 * already give untranslated strings, and the one `GLOSSARY.md` §4.4 asks for explicitly:
 * "**Her iki tablonun EN karşılıkları `[TEYİT GEREK]`'tir** … EN sütunu bu yüzden açılmadı."
 * `renderLabel` is the ONE place that decision is made — a caller never re-implements it.
 */
export interface ProfileLabel {
  readonly tr: string;
  readonly en?: string;
}

export interface RenderedLabel {
  readonly text: string;
  /** Set to `"tr"` when the EN page is rendering a TR-only string — pass straight to a
   *  `lang` attribute; `undefined` means "no override needed". */
  readonly lang?: "tr";
}

export function renderLabel(locale: Locale, label: ProfileLabel): RenderedLabel {
  if (locale === "en") {
    return label.en !== undefined ? { text: label.en } : { text: label.tr, lang: "tr" };
  }
  return { text: label.tr };
}

/** The four declared account types, in the order the picker shows them (T-103). */
export const ACCOUNT_ROLE_ORDER: readonly AccountRole[] = [
  "STUDENT",
  "TEACHER",
  "PARENT",
  "ENTHUSIAST",
];

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, ProfileLabel> = {
  STUDENT: { tr: "Öğrenci", en: "Student" },
  TEACHER: { tr: "Öğretmen", en: "Teacher" },
  PARENT: { tr: "Veli", en: "Parent" },
  ENTHUSIAST: { tr: "Coğrafya meraklısı", en: "Geography enthusiast" },
};

/** A teacher's branch (T-103). Key order is display order. */
export const TEACHER_SUBJECT_LABELS: Record<TeacherSubject, ProfileLabel> = {
  COGRAFYA: { tr: "Coğrafya", en: "Geography" },
  SOSYAL_BILGILER: { tr: "Sosyal bilgiler", en: "Social studies" },
  DIGER: { tr: "Diğer", en: "Other" },
};

/** Where a teacher works (T-103). Key order is display order. */
export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, ProfileLabel> = {
  DEVLET_OKULU: { tr: "Devlet okulu", en: "State school" },
  OZEL_OKUL: { tr: "Özel okul", en: "Private school" },
  DERSHANE_KURS: { tr: "Dershane / kurs", en: "Tutoring centre" },
  DIGER: { tr: "Diğer", en: "Other" },
};

/** "Bizi nereden duydun?" (T-103). Key order is display order. */
export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, ProfileLabel> = {
  OGRETMEN: { tr: "Öğretmenim", en: "My teacher" },
  ARKADAS: { tr: "Arkadaşım", en: "A friend" },
  YOUTUBE: { tr: "YouTube", en: "YouTube" },
  INSTAGRAM: { tr: "Instagram", en: "Instagram" },
  GOOGLE: { tr: "Google", en: "Google" },
  KITAP: { tr: "Kitap", en: "A book" },
  DIGER: { tr: "Diğer", en: "Other" },
};

/**
 * `gradeLevel` — 11 values, `GLOSSARY.md` §4.4 verbatim including its own typography ruling
 * ("`5. Sınıf`, `5.Sınıf` değil" — the space after the ordinal is load-bearing). TR only:
 * §4.4's own `[TEYİT GEREK]` umbrella covers this table's EN column, so none is minted here.
 */
export const GRADE_LEVEL_LABELS: Record<GradeLevel, ProfileLabel> = {
  GRADE_5: { tr: "5. Sınıf" },
  GRADE_6: { tr: "6. Sınıf" },
  GRADE_7: { tr: "7. Sınıf" },
  GRADE_8: { tr: "8. Sınıf" },
  GRADE_9: { tr: "9. Sınıf" },
  GRADE_10: { tr: "10. Sınıf" },
  GRADE_11: { tr: "11. Sınıf" },
  GRADE_12: { tr: "12. Sınıf" },
  MEZUN: { tr: "Mezun" },
  KPSS: { tr: "KPSS" },
  DIGER: { tr: "Diğer" },
};

/** `studyStream` — 10 values, `GLOSSARY.md` §4.4 verbatim. TR only, same umbrella as above. */
export const STUDY_STREAM_LABELS: Record<StudyStream, ProfileLabel> = {
  SAYISAL: { tr: "Sayısal" },
  SOZEL: { tr: "Sözel" },
  ESIT_AGIRLIK: { tr: "Eşit Ağırlık" },
  TYT: { tr: "TYT" },
  DIL: { tr: "Dil" },
  LGS: { tr: "LGS" },
  MSU: { tr: "MSÜ" },
  ARA_SINIF: { tr: "Ara Sınıf" },
  KPSS: { tr: "KPSS" },
  DIGER: { tr: "Diğer" },
};

/**
 * The university list's `<optgroup>` heading, DERIVED from `UniversityDto.type`
 * (`GLOSSARY.md` §7.2, → `DEC 2026-08-21h`): `type === "KKTC"` → group label `KKTC`,
 * every other type → `Türkiye`. `DEVLET`/`VAKIF`/`VAKIF_MYO` are never shown as their own
 * label — §7.2's table says so explicitly — and `Yurt dışı` is forbidden (`SOV129-I1`). No
 * `en`: both headings stay Turkish on the EN page too, the same convention province names
 * already use (`ProvinceListItemDto` publishes no `nameEn`) — `renderLabel` applies the same
 * `lang="tr"` treatment here as it does for the two tables above. `GLOSSARY.md` §7.3: this
 * `<optgroup>` heading is the ONLY reader surface on the whole platform where the
 * abbreviation `KKTC` is printed; the exception is not widened past it.
 */
export const UNIVERSITY_GROUP_LABELS: Record<UniversityType, ProfileLabel> = {
  DEVLET: { tr: "Türkiye" },
  VAKIF: { tr: "Türkiye" },
  VAKIF_MYO: { tr: "Türkiye" },
  KKTC: { tr: "KKTC" },
};

/**
 * `educationLevel` — the three values `GLOSSARY.md` §7.1's own table fixes
 * (Ortaöğretim → SECONDARY, Lisans → UNDERGRADUATE, Lisansüstü → GRADUATE). CARRIES `en`,
 * for the same reason `ACCOUNT_ROLE_LABELS` above does and unlike `GRADE_LEVEL_LABELS` /
 * `STUDY_STREAM_LABELS`: §7.1's own text rules these EN forms usable — "Ürün terimi
 * oldukları için §4'ün kurum-yayını şartı burada uygulanmıyor; bu bir hüküm, bir eksiklik
 * değil" — so they are NOT under §4.4's `[TEYİT GEREK]` umbrella.
 *
 * Answers "what is your education level" for a member who declared Öğrenci.
 */
export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, ProfileLabel> = {
  SECONDARY: { tr: "Ortaöğretim", en: "Secondary" },
  UNDERGRADUATE: { tr: "Lisans", en: "Undergraduate" },
  GRADUATE: { tr: "Lisansüstü", en: "Graduate" },
};
