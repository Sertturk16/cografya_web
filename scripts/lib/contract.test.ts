import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
  const root = mkdtempSync(path.join(tmpdir(), "contract-"));
  const web = path.join(root, "cografya_web");
  mkdirSync(web);

  it("fails with a message that says where it looked and how to fix it", () => {
    expect(() => findApiRepo(web, {})).toThrow(/cografya_api not found at [\s\S]*git clone/);
  });

  it("rejects a sibling directory that is not the API repo", () => {
    const api = path.join(root, "cografya_api");
    mkdirSync(api);
    writeFileSync(path.join(api, "package.json"), JSON.stringify({ name: "something-else" }));
    expect(() => findApiRepo(web, {})).toThrow(/is not the API repo/);
  });

  it("returns the sibling checkout, or COGRAFYA_API_DIR when set", () => {
    const api = path.join(root, "cografya_api");
    writeFileSync(path.join(api, "package.json"), JSON.stringify({ name: "cografya-api" }));
    expect(findApiRepo(web, {})).toBe(api);

    const other = path.join(root, "elsewhere");
    mkdirSync(other);
    writeFileSync(path.join(other, "package.json"), JSON.stringify({ name: "cografya-api" }));
    expect(findApiRepo(web, { COGRAFYA_API_DIR: other })).toBe(other);
  });
});
