import { describe, expect, it } from "vitest";
import { buildHealthReport } from "./report";

describe("buildHealthReport", () => {
  it("reports the API as ok when its probe resolves", async () => {
    await expect(buildHealthReport(async () => undefined)).resolves.toEqual({
      status: "ok",
      api: "ok",
    });
  });

  it("still reports the web as ok when the API probe throws", async () => {
    // The web answering at all is what this endpoint proves; the API is reported beside it so
    // a web deploy is not failed for an API outage it did not cause.
    await expect(
      buildHealthReport(async () => {
        throw new Error("fetch failed");
      }),
    ).resolves.toEqual({ status: "ok", api: "down" });
  });
});
