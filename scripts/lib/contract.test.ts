import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { diffContract, findApiRepo } from "./contract.mjs";

const spec = (paths: object, schemas: object, extra: object = {}) =>
  JSON.stringify({ openapi: "3.0.0", paths, components: { schemas }, ...extra }, null, 2) + "\n";

describe("diffContract", () => {
  const base = spec({ "/a": { get: {} }, "/b": { get: {} } }, { A: { type: "object" } });

  it("is in sync when the bytes match", () => {
    expect(diffContract(base, base)).toEqual({ inSync: true, changes: [] });
  });

  it("names added, removed and changed paths and schemas from the API's side", () => {
    const api = spec(
      { "/a": { get: { deprecated: true } }, "/c": { get: {} } },
      { A: { type: "object" }, B: { type: "string" } },
    );
    expect(diffContract(base, api)).toEqual({
      inSync: false,
      changes: [
        "path /a: changed in the API",
        "path /b: removed from the API",
        "path /c: added in the API",
        "schema B: added in the API",
      ],
    });
  });

  it("reports other top-level sections that differ", () => {
    const paths = { "/a": { get: {} } };
    const web = spec(paths, {}, { info: { version: "1" } });
    const api = spec(paths, {}, { info: { version: "2" }, tags: [] });
    expect(diffContract(web, api).changes).toEqual([
      "info: changed in the API",
      "tags: added in the API",
    ]);
  });

  it("is not in sync on a byte-only difference, because codegen:check compares bytes", () => {
    const api = base.replace(/\n$/, "");
    expect(diffContract(base, api)).toEqual({
      inSync: false,
      changes: ["formatting only (same JSON, different bytes)"],
    });
  });

  it("does not throw on a file that is not JSON", () => {
    expect(diffContract("{", base)).toEqual({
      inSync: false,
      changes: ["web copy is not valid JSON"],
    });
  });
});

describe("findApiRepo", () => {
  let root: string;
  let web: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "contract-"));
    web = path.join(root, "cografya_web");
    mkdirSync(web);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const pkg = (dir: string, name: string) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name }));
  };

  it("fails with a message that says where it looked and how to fix it", () => {
    expect(() => findApiRepo(web, {})).toThrow(/cografya_api not found at [\s\S]*git clone/);
  });

  it("rejects a sibling directory that is not the API repo", () => {
    pkg(path.join(root, "cografya_api"), "something-else");
    expect(() => findApiRepo(web, {})).toThrow(/is not the API repo/);
  });

  it("returns the sibling checkout, or COGRAFYA_API_DIR when set", () => {
    pkg(path.join(root, "cografya_api"), "cografya-api");
    expect(findApiRepo(web, {})).toBe(path.join(root, "cografya_api"));

    pkg(path.join(root, "elsewhere"), "cografya-api");
    expect(findApiRepo(web, { COGRAFYA_API_DIR: path.join(root, "elsewhere") })).toBe(
      path.join(root, "elsewhere"),
    );
  });
});
