import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * WHAT THE HEADER COMBOBOX KEEPS NOW THAT ITS STYLESHEET IS GONE.
 *
 * T-033 task 5 converted `search-combobox.tsx` to bridge-token utilities and deleted
 * `site-search.module.css`. The floors and the one-ring arrangement this file used to pin
 * (`TRIGGER`, `CLOSE`, `INPUT_ROW`, `INPUT`) belonged to the `variant="default"` rendering path,
 * which no route mounted; T-054 deleted that path and its pins with it. What is left guards the
 * command dialog the header actually renders.
 */

const source = stripComments(
  readFileSync(new URL("./search-combobox.tsx", import.meta.url), "utf8"),
);

/**
 * The stylesheet is gone, and it does not come back through the import it used to arrive by.
 * Anti-vacuity: the reading runs against a source this file really read.
 */
describe("the stylesheet is not reachable from this component any more", () => {
  it("imports no CSS Module and reads no raw Terra token", () => {
    expect(source).not.toMatch(/site-search\.module\.css/);
    expect(source).not.toMatch(/var\(--color-/);
    expect(source.length, "search-combobox.tsx was not read").toBeGreaterThan(5000);
  });
});

/**
 * ONE rendering path. The `variant` prop selected between the command dialog and a second,
 * unmounted panel; with the second gone, a prop reappearing here means a dead branch is back.
 */
describe("the combobox renders one interface", () => {
  it("carries no variant prop", () => {
    expect(source).not.toMatch(/\bvariant\b/);
  });
});
