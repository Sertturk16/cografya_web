import { describe, expect, it } from "vitest";
import { MAP_CAMERA_EVENT, dispatchMapCamera, isMapCameraEvent } from "./map-camera";

/**
 * THE CAMERA CONTRACT, on an `EventTarget` rather than on a map (→ PR #69 review TA69-I2).
 *
 * "Cevabı göster" pans the map to the answer (DEC 2026-08-17g md. 4), and the two islands
 * that make that happen never meet: `game-island.tsx` dispatches on the `<svg>`,
 * `map-zoom-pan.tsx` listens on the same `<svg>`. This file pins the half of that contract
 * that is pure — the event name, the payload, the non-bubbling target rule, and what the
 * predicate does and does not promise. The DOM half (which element each side resolves) is a
 * source scan in `components/map/map-zoom-pan.contract.test.ts`, because the repo runs a
 * single `node` vitest environment with no jsdom.
 *
 * Node 24 supplies `EventTarget` and `CustomEvent` as globals, which is why this needs no
 * harness change (checked on v24.19.0, the version `.nvmrc` pins and CI reads).
 */

/**
 * The module never touches a member of `shapes` — it carries them from one island to the
 * other, and only the listener (which runs in a browser) reads geometry off them. Plain
 * objects are therefore the honest test double, and the cast is what says so out loud.
 */
const SHAPES = [{ plate: "14" }, { plate: "34" }] as unknown as readonly SVGGraphicsElement[];

function collect(target: EventTarget): Event[] {
  const seen: Event[] = [];
  target.addEventListener(MAP_CAMERA_EVENT, (event) => seen.push(event));
  return seen;
}

describe("dispatchMapCamera", () => {
  it("delivers the shapes it was given, by reference", () => {
    const target = new EventTarget();
    const seen = collect(target);

    dispatchMapCamera(target, SHAPES);

    expect(seen).toHaveLength(1);
    const event = seen[0];
    if (!event || !isMapCameraEvent(event)) throw new Error("no camera event delivered");
    // The listener resolves `getBBox()` off these very elements; a copy would be a different
    // set of nodes and `svg.contains` would reject every one of them.
    expect(event.detail.shapes).toBe(SHAPES);
  });

  it("dispatches nothing at all for an empty list", () => {
    const target = new EventTarget();
    const seen = collect(target);

    dispatchMapCamera(target, []);

    expect(seen).toHaveLength(0);
  });

  it("does not bubble — dispatcher and listener are the same element", () => {
    const target = new EventTarget();
    const seen = collect(target);

    dispatchMapCamera(target, SHAPES);

    // This is the contract the two islands' element resolution has to satisfy: there is no
    // ancestor to catch this event, so both sides must land on the same `<svg>`.
    expect(seen[0]?.bubbles).toBe(false);
  });

  it("uses a namespaced event name that cannot collide with a UA or library event", () => {
    expect(MAP_CAMERA_EVENT).toBe("cografya:map-camera");
  });
});

describe("isMapCameraEvent", () => {
  it("accepts a well-formed camera event", () => {
    const event = new CustomEvent(MAP_CAMERA_EVENT, { detail: { shapes: SHAPES } });
    expect(isMapCameraEvent(event)).toBe(true);
  });

  it("rejects an event carrying no detail at all", () => {
    expect(isMapCameraEvent(new Event(MAP_CAMERA_EVENT))).toBe(false);
  });

  it("rejects a detail with no shapes array", () => {
    expect(isMapCameraEvent(new CustomEvent(MAP_CAMERA_EVENT, { detail: {} }))).toBe(false);
    expect(isMapCameraEvent(new CustomEvent(MAP_CAMERA_EVENT, { detail: { shapes: "14" } }))).toBe(
      false,
    );
    expect(isMapCameraEvent(new CustomEvent(MAP_CAMERA_EVENT, { detail: null }))).toBe(false);
  });

  it("promises the ARRAY only, never the type of its members", () => {
    // Deliberate: naming `SVGGraphicsElement` here would tie this module to a DOM global it
    // does not otherwise touch, and this is the half that runs under `node`. The member check
    // lives in the listener, which only ever runs in a browser (review CODE69-M4) — so a
    // dispatcher sending plate codes passes HERE and is filtered THERE.
    const event = new CustomEvent(MAP_CAMERA_EVENT, { detail: { shapes: ["14", "34"] } });
    expect(isMapCameraEvent(event)).toBe(true);
  });
});
