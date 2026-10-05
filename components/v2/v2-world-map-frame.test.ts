import { describe, expect, it } from "vitest";
import { FRAME_SANDBOX } from "./v2-world-map-frame";

describe("V2WorldMapFrame sandbox", () => {
  it("grants the third-party map scripts and its own origin, nothing else", () => {
    // Popups (and popups escaping the sandbox) would let the framed page open an unrestricted
    // window; forms and top navigation are not needed for the map either.
    expect(FRAME_SANDBOX.split(/\s+/).sort()).toEqual(["allow-same-origin", "allow-scripts"]);
  });
});
