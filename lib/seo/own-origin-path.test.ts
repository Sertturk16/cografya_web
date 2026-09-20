import { describe, expect, it } from "vitest";
import { getSiteUrl, ownOriginPath } from "./site";

/**
 * {@link ownOriginPath}, the browser-request half of T-069.
 *
 * ## What went wrong, and why an env fix alone is not the whole answer
 *
 * `NEXT_PUBLIC_*` values are INLINED AT BUILD TIME. The production image built without
 * `NEXT_PUBLIC_SITE_URL` in its build args — `docker-compose.prod.yml` passed it as a runtime
 * environment variable, which a Next client bundle never reads — so `lib/env.ts`'s
 * `http://localhost:3000` default was baked into the shipped JavaScript. Every book cover on
 * `https://cografyagurmesi.com` was therefore an `<img src="http://localhost:3000/api/video-cover/…">`,
 * and Chromium met a public HTTPS page reaching into the visitor's own machine: Private Network
 * Access, and the "wants to access other apps and services on this device" prompt a reader
 * reported.
 *
 * The Dockerfile now takes the value as a build ARG and refuses to build without one, which
 * fixes the cause. This function is the second layer, and it holds EVEN WHEN THE FIRST ONE IS
 * MISCONFIGURED: the payload's address and this comparison are built from the SAME constant, so
 * a wrong constant still matches itself, the address still collapses to a path, and a path is
 * resolved by the browser against the origin it actually loaded the page from. There is no
 * value of `NEXT_PUBLIC_SITE_URL` that can make a cover request leave the site's own origin.
 *
 * The provider CDN case must pass through untouched for a different reason: YouTube's Developer
 * Policies require the thumbnail address to be used as the API returned it.
 */

describe("ownOriginPath — our own address becomes a path", () => {
  const site = getSiteUrl();

  it("strips the origin from a cover URL on our own origin", () => {
    expect(ownOriginPath(`${site}/api/video-cover/84fe2231-e005-4844-8237-56da1bd7a30a`)).toBe(
      "/api/video-cover/84fe2231-e005-4844-8237-56da1bd7a30a",
    );
  });

  it("keeps the query string, which is part of the request and not of the origin", () => {
    expect(ownOriginPath(`${site}/api/video-cover/abc?v=2`)).toBe("/api/video-cover/abc?v=2");
  });

  it("returns a path unchanged — it is already origin-relative", () => {
    expect(ownOriginPath("/api/video-cover/abc")).toBe("/api/video-cover/abc");
  });
});

describe("ownOriginPath — everything else is returned verbatim", () => {
  it("leaves a provider CDN address alone, which the YouTube policies require", () => {
    const provider = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
    expect(ownOriginPath(provider)).toBe(provider);
  });

  it("leaves any other absolute address alone rather than guessing at it", () => {
    expect(ownOriginPath("https://example.test/x.jpg")).toBe("https://example.test/x.jpg");
  });

  it("returns an unparseable string unchanged — it refuses nothing and invents nothing", () => {
    expect(ownOriginPath("not a url")).toBe("not a url");
    expect(ownOriginPath("")).toBe("");
  });

  it("is not fooled by a hostname that merely CONTAINS ours", () => {
    // `getSiteUrl()` is `http://localhost:3000` under test, so the lookalike is built from it
    // rather than written out — the case must hold whatever the configured origin is.
    const { protocol, host } = new URL(getSiteUrl());
    const lookalike = `${protocol}//${host}.attacker.test/api/video-cover/abc`;
    expect(ownOriginPath(lookalike)).toBe(lookalike);
  });
});
