import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * Comments are stripped before every assertion below. Several of these cases assert the
 * ABSENCE of a string — no `<h1>` in the shell, no `sifre-sifirlama` in the password card —
 * and each of those strings appears in a docblock explaining why it is absent. Reading raw
 * source would make those cases fail on their own explanations.
 *
 * Nothing here computes a line number, which is what makes this safe: `stripComments`
 * collapses a block comment to a single space (T-043), so a line number taken off the
 * stripped text would not be the file's.
 */
const read = (name: string) => stripComments(readFileSync(join(__dirname, name), "utf8"));

const SHELL = read("v2-account-settings.tsx");
const CARD = read("v2-settings-card.tsx");
const PERSONAL = read("v2-settings-personal-card.tsx");
const EDUCATION = read("v2-settings-education-card.tsx");
const PASSWORD = read("v2-settings-password-card.tsx");
const ACCOUNT = read("v2-settings-account-card.tsx");
const PAGE = stripComments(
  readFileSync(join(__dirname, "../../app/[locale]/(site)/hesabim/ayarlar/page.tsx"), "utf8"),
);

/**
 * `/hesabim/ayarlar` (T-061). Vitest runs in the node environment here (no jsdom), so these
 * are source-contract assertions in the shape `v2-member-hub.test.ts` already uses — they pin
 * the decisions that are easy to undo by accident, not the markup.
 */
describe("the settings page's four sections", () => {
  it("renders all four for a student, in the ruled order", () => {
    const order = [
      "V2SettingsPersonalCard",
      "V2SettingsEducationCard",
      "V2SettingsPasswordCard",
      "V2SettingsAccountCard",
    ];
    const positions = order.map((name) => SHELL.indexOf(`<${name}`));
    expect(
      positions.every((position) => position > 0),
      `a section is missing: ${order}`,
    ).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("shows the education section to a STUDENT and a PARENT only", () => {
    // PARENT reuses the STUDENT branches of the API's profile matrix in full, so it gets the
    // same fields. TEACHER carries no education column at all.
    expect(SHELL).toContain(
      'profile.accountRole === "STUDENT" || profile.accountRole === "PARENT"',
    );
    expect(SHELL).toContain("{showsEducation && <V2SettingsEducationCard");
  });

  it("gives a teacher three populated sections rather than an empty-room message", () => {
    // The whole defect this page replaced: `/profil` showed a TEACHER one card whose entire
    // body was "Öğretmen hesabın için ek bir profil alanı bulunmuyor." Nothing here is gated
    // on role except the education card, so the other three always render.
    for (const card of [
      "V2SettingsPersonalCard",
      "V2SettingsPasswordCard",
      "V2SettingsAccountCard",
    ]) {
      const mount = SHELL.slice(SHELL.indexOf(`<${card}`) - 40, SHELL.indexOf(`<${card}`));
      expect(mount, `${card} is conditionally rendered`).not.toContain("&&");
    }
  });

  it("drops the section from the jump list when it is not rendered", () => {
    // A nav entry pointing at an anchor that does not exist is a link to nowhere.
    expect(SHELL).toContain('...(showsEducation ? [{ id: "egitim-bilgileri"');
  });

  it("carries no sign-out control — the header owns that", () => {
    for (const [name, source] of [
      ["shell", SHELL],
      ["personal", PERSONAL],
      ["education", EDUCATION],
      ["password", PASSWORD],
      ["account", ACCOUNT],
      ["page", PAGE],
    ] as const) {
      expect(source, `${name} signs out`).not.toContain('submitAuth("logout"');
      expect(source, `${name} signs out`).not.toContain("Çıkış");
    }
  });
});

describe("one heading, and it belongs to the page", () => {
  it("puts the h1 on the page, outside both branches", () => {
    // Two reachable h1 elements on mutually exclusive conditions is exactly the shape
    // `/profil` needed a named exemption for in `page-composition-headings.test.ts`, and that
    // exemption was deleted in this same change. A heading inside the loaded branch would
    // have rebuilt it under a new path.
    expect(PAGE).toContain('<H1>{t("heading")}</H1>');
    expect(PAGE.indexOf("<H1>")).toBeLessThan(PAGE.indexOf('result.kind === "unavailable"'));
    expect(SHELL).not.toContain("<h1");
    expect(SHELL).not.toContain("<H1");
  });

  it("uses the hub tier rather than inventing a spelling", () => {
    expect(PAGE).toContain('import { H1 } from "@/components/patterns/typography"');
  });

  it("gives every section an h2 through one shared shell", () => {
    // Four sections spelling their own header is four chances for the level to drift, on the
    // one page where four near-identical blocks sit directly above one another.
    expect(CARD).toContain("<h2 id={headingId}");
    for (const [name, source] of [
      ["personal", PERSONAL],
      ["education", EDUCATION],
      ["password", PASSWORD],
      ["account", ACCOUNT],
    ] as const) {
      expect(source, `${name} draws its own header`).toContain("<SettingsCard");
      expect(source, `${name} draws its own heading`).not.toContain("<h2");
    }
  });
});

describe("each section saves on its own", () => {
  it("sends the personal block to /api/account and the education block to /api/profile", () => {
    expect(PERSONAL).toContain("submitAccountReplacement");
    expect(EDUCATION).toContain("submitProfileReplacement");
  });

  it("changes the password through the authenticated BFF action, never the reset flow", () => {
    // The defect this card replaced: a signed-in member's "Şifre Değiştir" went to
    // `/sifre-sifirlama`, which asks for the e-mail address they are already signed in with.
    expect(PASSWORD).toContain('submitAuth("password/change"');
    expect(PASSWORD).not.toContain("sifre-sifirlama");
  });

  it("announces the new-password error as well as the rules", () => {
    // `aria-describedby` naming only the rules list would mark the field invalid and leave
    // the reason unspoken.
    expect(PASSWORD).toContain("`${IDS.newPassword}-rules ${IDS.newPassword}-error`");
  });

  it("clears every password field after a successful change", () => {
    // A filled password input left in the DOM after the change is the member's live secret
    // sitting there for no reason.
    const success = PASSWORD.slice(PASSWORD.indexOf("if (res.ok)"), PASSWORD.indexOf("} else {"));
    expect(success).toContain('setCurrentPassword("")');
    expect(success).toContain('setNewPassword("")');
    expect(success).toContain('setConfirmPassword("")');
  });

  it("refreshes the server render after a name change", () => {
    // The header greets the member by first name and reads it from the session on the server.
    expect(PERSONAL).toContain("router.refresh()");
  });

  it("clears the district when the province changes", () => {
    // Keeping the old district sends the API a pair its membership check refuses, and the
    // member is told a field they did not touch is wrong.
    expect(PERSONAL).toContain('setDistrictId(rows[0]?.id ?? "")');
  });
});

describe("the account section is read-only, and honest about it", () => {
  it("shows the e-mail without offering to change it", () => {
    expect(ACCOUNT).toContain("account.email");
    expect(ACCOUNT).toContain("account.emailNotice");
    expect(ACCOUNT).not.toContain("<form");
    expect(ACCOUNT).not.toContain("<Input");
  });
});
