import { describe, expect, it } from "vitest";
import { retryRoute } from "./retry-route";

describe("retryRoute", () => {
  it("asks the server for fresh data, then clears the boundary", () => {
    const calls: string[] = [];
    retryRoute({ refresh: () => calls.push("refresh") }, () => calls.push("reset"));
    expect(calls).toEqual(["refresh", "reset"]);
  });
});
