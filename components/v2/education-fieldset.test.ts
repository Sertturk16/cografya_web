import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_EDUCATION_SELECTION,
  educationSelectionFromProfile,
  missingEducationFields,
  type EducationSelection,
} from "./education-fieldset";

const SOURCE = readFileSync(join(__dirname, "education-fieldset.tsx"), "utf8");

function selection(overrides: Partial<EducationSelection> = {}): EducationSelection {
  return { ...EMPTY_EDUCATION_SELECTION, ...overrides };
}

/**
 * `missingEducationFields` is the required-field matrix both consumers share — the settings
 * card and step 2 of registration. It mirrors the API's `isProfileShapeValid`, so a branch
 * that disagrees here is a 400 the member sees instead of a field the form marks.
 */
describe("missingEducationFields — the branch matrix", () => {
  it("asks for the level first, and says nothing else while it is unchosen", () => {
    // Listing every field of every branch on an empty form would mark six inputs the member
    // cannot even see yet.
    expect(missingEducationFields(selection())).toEqual(["educationLevel"]);
  });

  describe("SECONDARY", () => {
    it("requires grade and stream", () => {
      expect(missingEducationFields(selection({ educationLevel: "SECONDARY" }))).toEqual([
        "gradeLevel",
        "studyStream",
      ]);
    });

    it("is satisfied by grade and stream alone — school is optional", () => {
      expect(
        missingEducationFields(
          selection({
            educationLevel: "SECONDARY",
            gradeLevel: "GRADE_12",
            studyStream: "SAYISAL",
          }),
        ),
      ).toEqual([]);
    });

    it("never asks for university or department", () => {
      const missing = missingEducationFields(selection({ educationLevel: "SECONDARY" }));
      expect(missing).not.toContain("universityName");
      expect(missing).not.toContain("departmentName");
    });
  });

  describe("UNDERGRADUATE", () => {
    it("requires university and department", () => {
      expect(missingEducationFields(selection({ educationLevel: "UNDERGRADUATE" }))).toEqual([
        "universityName",
        "departmentName",
      ]);
    });

    it("is satisfied once both are chosen", () => {
      expect(
        missingEducationFields(
          selection({
            educationLevel: "UNDERGRADUATE",
            universityName: "Boğaziçi Üniversitesi",
            departmentName: "Coğrafya Öğretmenliği",
          }),
        ),
      ).toEqual([]);
    });

    it("never asks for the secondary trio", () => {
      const missing = missingEducationFields(selection({ educationLevel: "UNDERGRADUATE" }));
      expect(missing).not.toContain("gradeLevel");
      expect(missing).not.toContain("studyStream");
    });
  });

  describe("GRADUATE", () => {
    it("requires the university but NOT the department", () => {
      // The API's matrix leaves department optional on this branch. Requiring it here would
      // block a member from declaring a university they have because of a programme they have
      // not picked from a list.
      expect(missingEducationFields(selection({ educationLevel: "GRADUATE" }))).toEqual([
        "universityName",
      ]);
    });

    it("is satisfied by the university alone", () => {
      expect(
        missingEducationFields(
          selection({ educationLevel: "GRADUATE", universityName: "Boğaziçi Üniversitesi" }),
        ),
      ).toEqual([]);
    });
  });
});

describe("educationSelectionFromProfile", () => {
  it("turns every null into the empty string a <select> can hold", () => {
    expect(
      educationSelectionFromProfile({
        educationLevel: null,
        gradeLevel: null,
        studyStream: null,
        schoolName: null,
        universityName: null,
        departmentName: null,
      }),
    ).toEqual(EMPTY_EDUCATION_SELECTION);
  });

  it("carries real values through unchanged", () => {
    expect(
      educationSelectionFromProfile({
        educationLevel: "UNDERGRADUATE",
        gradeLevel: null,
        studyStream: null,
        schoolName: null,
        universityName: "Boğaziçi Üniversitesi",
        departmentName: "Coğrafya Öğretmenliği",
      }),
    ).toEqual({
      educationLevel: "UNDERGRADUATE",
      gradeLevel: "",
      studyStream: "",
      schoolName: "",
      universityName: "Boğaziçi Üniversitesi",
      departmentName: "Coğrafya Öğretmenliği",
    });
  });
});

describe("the fieldset's source contract", () => {
  it("clears the whole selection when the level changes", () => {
    // Keeping a stale `gradeLevel` after switching to UNDERGRADUATE sends the API a shape its
    // profile matrix refuses outright, and the member is told a field they can no longer see
    // is wrong. Spreading EMPTY over the new level is what makes that impossible.
    expect(SOURCE).toContain(
      "onChange({ ...EMPTY_EDUCATION_SELECTION, educationLevel: nextLevel })",
    );
  });

  it("prefixes every element id, so two mounts on one page cannot collide", () => {
    for (const field of [
      "education-level",
      "grade-level",
      "study-stream",
      "school-name",
      "university-name",
      "department-name",
    ]) {
      expect(SOURCE, `${field} is not prefixed`).toContain(`\${idPrefix}-${field}`);
    }
    // And no hardcoded survivor of the component it was extracted from.
    expect(SOURCE).not.toContain('"v2-profile-');
  });

  it("does not suppress the focus ring T-053 gave the whole site", () => {
    // The form this was extracted from wrote `focus-visible:outline-none` plus its own ring.
    // T-053 made the global indicator the one that renders; a local `outline-none` here would
    // put this fieldset back outside it.
    expect(SOURCE).not.toContain("outline-none");
  });

  it("fetches each reference list only on the branch that needs it", () => {
    expect(SOURCE).toContain("if (!needsUniversity || universities !== null || universityFailed)");
    expect(SOURCE).toContain("if (!needsUniversity || departments !== null || departmentFailed)");
  });
});
