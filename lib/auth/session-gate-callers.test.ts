import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * T-162 (T-165 added the measurement save): the login-gated presses go through the shared session gate
 * (`useSessionGate` / `gateOnAuthSession` in `use-session.client.ts`), which waits while the
 * session is `"checking"`. A direct `requestAuth(` call in these files is the old
 * `authState !== "authenticated"` branch coming back: it opens the dialog for a signed-in reader
 * who pressed before the session check answered.
 */
const GATED = [
  "components/v2/v2-game-screen.tsx",
  "components/v2/v2-favorite-button.tsx",
  "components/book/video-bench.tsx",
  "components/v2/v2-tool-workbench.tsx",
] as const;

describe("login-gated presses use the session gate", () => {
  it.each(GATED)("%s opens the dialog only through the gate", (path) => {
    const code = stripComments(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
    expect(code).not.toMatch(/\brequestAuth\(/);
    expect(code).toMatch(/\b(useSessionGate|gateOnAuthSession)\(/);
  });
});

describe("the auth dialog's safety net", () => {
  // A request opened by any other path while the session was still `"checking"` (the header's
  // "Giriş Yap" in its first moment, a not-yet-gated control) is resolved, not left showing
  // "Zaten Giriş Yaptın", once the session settles as authenticated: the requester then resumes.
  it("resolves an open request when the session becomes authenticated", () => {
    const code = stripComments(
      readFileSync(new URL("../../components/v2/v2-auth-dialog.tsx", import.meta.url), "utf8"),
    ).replace(/\s+/g, " ");
    expect(code).toContain('if (modal.open && authState === "authenticated") resolveAuth();');
  });
});
