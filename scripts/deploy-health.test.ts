import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const DEPLOY = read("../.github/workflows/deploy.yml");
const DOCKERFILE = read("../Dockerfile");

/**
 * The deploy used to `sleep 5` after `up -d web` and print `ps`, so a container that never came
 * up still finished green. These pin the replacement: the deploy waits for the new container to
 * answer `/api/health` from inside, then for Caddy to reach it, and fails if either never does.
 */
describe("deploy waits for a healthy web container", () => {
  it("no longer waits a fixed time", () => {
    expect(DEPLOY).not.toMatch(/^\s*sleep 5\s*$/m);
  });

  it("polls the in-image health probe inside the new container", () => {
    expect(DEPLOY).toContain("exec -T web node healthcheck.mjs </dev/null");
  });

  it("fails the deploy when the probe never succeeds", () => {
    // lastIndexOf: an earlier comment in the script names the same command.
    const afterUp = DEPLOY.slice(DEPLOY.lastIndexOf("up -d --no-deps web"));
    expect(afterUp).toMatch(/exit 1/);
  });

  it("never lets a `docker compose exec` read the script's stdin", () => {
    // The remote script is ssh's stdin; `exec` forwards stdin into the container, so an `exec`
    // without `</dev/null` swallows every line after it and the deploy exits 0 unchecked.
    const execLines = DEPLOY.split("\n").filter(
      (line) => !line.trim().startsWith("#") && /docker compose .*\bexec\b/.test(line),
    );
    expect(execLines.length, "exec lines found").toBeGreaterThanOrEqual(2);
    for (const line of execLines) expect(line, line.trim()).toContain("</dev/null");
  });

  it("checks that Caddy reaches the new container", () => {
    expect(DEPLOY).toContain("exec -T caddy wget -q -T 25 -O - http://127.0.0.1/api/health");
  });
});

describe("the image carries the probe", () => {
  it("copies healthcheck.mjs into the runner and declares a HEALTHCHECK with it", () => {
    expect(DOCKERFILE).toMatch(/COPY[^\n]*scripts\/healthcheck\.mjs \.\/healthcheck\.mjs/);
    expect(DOCKERFILE).toMatch(
      /HEALTHCHECK[^\n]*\\?\s*\n?[^\n]*CMD \["node", "healthcheck\.mjs"\]/,
    );
  });
});
