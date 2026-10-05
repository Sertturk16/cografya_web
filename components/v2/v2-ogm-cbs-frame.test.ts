import { describe, expect, it } from "vitest";
import { FRAME_SANDBOX } from "./v2-ogm-cbs-frame";

describe("V2OgmCbsFrame sandbox", () => {
  it("grants what the platform uses and never top navigation", () => {
    // Downloads, alerts, the sign-in form and new-tab popups are the platform's own features;
    // top navigation would let it move the reader off the site.
    expect(FRAME_SANDBOX.split(/\s+/).sort()).toEqual([
      "allow-downloads",
      "allow-forms",
      "allow-modals",
      "allow-popups",
      "allow-popups-to-escape-sandbox",
      "allow-same-origin",
      "allow-scripts",
    ]);
  });
});
