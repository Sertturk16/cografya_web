import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every shadcn alias in `components.json` points at a directory that exists. The CLI writes
 * files through these; `hooks` pointed at a non-existent `@/hooks` until T-113. Hooks live in
 * `lib/<domain>/use-*.client.ts`, so the alias is `@/lib`. `utils` names a module, not a
 * directory.
 */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(`${repoRoot}components.json`, "utf8")) as {
  aliases: Record<string, string>;
};

describe("components.json aliases", () => {
  it.each(Object.entries(config.aliases))("%s → %s exists", (key, alias) => {
    expect(alias.startsWith("@/"), `${key} is not an @/ alias`).toBe(true);
    const path = `${repoRoot}${alias.slice(2)}`;
    if (key === "utils") {
      expect(existsSync(`${path}.ts`), `${alias}.ts`).toBe(true);
    } else {
      expect(existsSync(path) && statSync(path).isDirectory(), `${alias} is a directory`).toBe(
        true,
      );
    }
  });
});
