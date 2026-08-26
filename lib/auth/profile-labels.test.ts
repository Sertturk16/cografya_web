import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GRADE_LEVEL_LABELS,
  renderLabel,
  STUDY_STREAM_LABELS,
  UNIVERSITY_GROUP_LABELS,
  USER_TYPE_LABELS,
} from "./profile-labels";

/**
 * G8 (plan §9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`): the four
 * label tables are exhaustive over their generated enums (compile time — a missing member
 * fails `tsc`, not this file) and every `tr` value is non-empty; university grouping puts
 * `type:"KKTC"` under `KKTC` and every other type under `Türkiye`; `Yurt dışı` appears
 * nowhere in this module's source (`SOV129-I1`).
 */

function nonEmptyTr(table: Record<string, { readonly tr: string }>): void {
  for (const [key, label] of Object.entries(table)) {
    expect(label.tr.trim().length, `${key}.tr is empty`).toBeGreaterThan(0);
  }
}

describe("USER_TYPE_LABELS", () => {
  it("carries all four options with a non-empty tr", () => {
    expect(Object.keys(USER_TYPE_LABELS).sort()).toEqual(
      ["graduate", "secondary", "teacher", "undergraduate"].sort(),
    );
    nonEmptyTr(USER_TYPE_LABELS);
  });

  it("also carries en for all four (plan §4.3.4 — this axis is exercised in both modes)", () => {
    for (const [key, label] of Object.entries(USER_TYPE_LABELS)) {
      expect(label.en, `${key}.en is missing`).toBeTruthy();
    }
  });
});

describe("GRADE_LEVEL_LABELS / STUDY_STREAM_LABELS", () => {
  it("gradeLevel has 11 entries, all with a non-empty tr", () => {
    expect(Object.keys(GRADE_LEVEL_LABELS)).toHaveLength(11);
    nonEmptyTr(GRADE_LEVEL_LABELS);
  });

  it("studyStream has 10 entries, all with a non-empty tr", () => {
    expect(Object.keys(STUDY_STREAM_LABELS)).toHaveLength(10);
    nonEmptyTr(STUDY_STREAM_LABELS);
  });

  it("neither table carries en ([TEYİT GEREK] — GLOSSARY.md §4.4)", () => {
    for (const label of Object.values(GRADE_LEVEL_LABELS)) expect(label.en).toBeUndefined();
    for (const label of Object.values(STUDY_STREAM_LABELS)) expect(label.en).toBeUndefined();
  });

  it("the ordinal-space typography rule holds (GLOSSARY.md §4.4 — '5. Sınıf', not '5.Sınıf')", () => {
    expect(GRADE_LEVEL_LABELS.GRADE_5.tr).toBe("5. Sınıf");
    expect(GRADE_LEVEL_LABELS.GRADE_12.tr).toBe("12. Sınıf");
  });
});

describe("UNIVERSITY_GROUP_LABELS — the KKTC group rule (gate G8's revert-to-red target)", () => {
  it("KKTC groups under KKTC", () => {
    expect(UNIVERSITY_GROUP_LABELS.KKTC.tr).toBe("KKTC");
  });

  it.each(["DEVLET", "VAKIF", "VAKIF_MYO"] as const)("%s groups under Türkiye", (type) => {
    expect(UNIVERSITY_GROUP_LABELS[type].tr).toBe("Türkiye");
  });

  it("carries exactly two distinct group labels", () => {
    const distinct = new Set(Object.values(UNIVERSITY_GROUP_LABELS).map((label) => label.tr));
    expect(distinct).toEqual(new Set(["Türkiye", "KKTC"]));
  });

  it("'Yurt dışı' appears nowhere in this module's DATA (SOV129-I1)", () => {
    // Comments are stripped first (the `no-browser-storage.test.ts` pattern): this
    // module's own docblock names the forbidden term in PROSE (to explain why it is
    // forbidden), which must not self-trigger the scan.
    const raw = readFileSync(
      fileURLToPath(new URL("./profile-labels.ts", import.meta.url)),
      "utf8",
    );
    const source = raw
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    expect(source).not.toContain("Yurt dışı");
  });
});

describe('renderLabel — the lang="tr" fallback (WCAG 3.1.2)', () => {
  it("tr locale always renders the tr string, no lang override", () => {
    expect(renderLabel("tr", { tr: "Sayısal" })).toEqual({ text: "Sayısal" });
  });

  it("en locale with an en value renders it, no lang override", () => {
    expect(renderLabel("en", USER_TYPE_LABELS.teacher)).toEqual({ text: "Teacher" });
  });

  it('en locale with NO en value falls back to tr, wrapped lang="tr"', () => {
    expect(renderLabel("en", GRADE_LEVEL_LABELS.GRADE_5)).toEqual({ text: "5. Sınıf", lang: "tr" });
    expect(renderLabel("en", UNIVERSITY_GROUP_LABELS.KKTC)).toEqual({ text: "KKTC", lang: "tr" });
  });
});
