"use client";

import { useSyncExternalStore } from "react";

/**
 * The OGM Materyal CBS platform, framed to fill its positioned parent. Used by
 * `/araclar/ogm-cbs`.
 *
 * Rendered only from the `md` breakpoint up. The platform is a full-screen map app with a 288px
 * side panel; under the site header on a phone it has no room to work, so the page shows the
 * "open in a new tab" link alone there. The frame is left out of the DOM rather than hidden with
 * `display: none`, because a hidden iframe still loads, and a phone would download the whole app
 * and connect to OGM for a frame nobody sees. The server snapshot is `false`, so the frame
 * mounts on the client after hydration on a wide screen.
 *
 * `sandbox` grants what the platform's own code uses: scripts and its own origin (its API and
 * `localStorage`), downloads (map and table export), `alert()` (its import errors), forms (the
 * MEBBİS/EBA sign-in), and popups that escape the sandbox (its story maps and tutorial videos
 * open in a new tab). No top navigation, so it cannot move the reader off the site. `allow`
 * passes on fullscreen (its map control) and geolocation (its "my location" button).
 * `FRAME_SANDBOX` is exported so a test pins it.
 *
 * No `referrerPolicy` override: the site default sends our origin only, and OGM asked for this
 * entry point, so it is useful to them to see which visits came from it.
 */
export const OGM_CBS_URL = "https://ogmmateryal.eba.gov.tr/cbs/";
export const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-downloads allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox";
const FRAME_ALLOW = "fullscreen; geolocation";

const WIDE_QUERY = "(min-width: 48rem)";

function subscribeWide(onChange: () => void): () => void {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
const readWide = () => window.matchMedia(WIDE_QUERY).matches;
const readWideOnServer = () => false;

export function V2OgmCbsFrame({ title }: { title: string }) {
  const wide = useSyncExternalStore(subscribeWide, readWide, readWideOnServer);
  if (!wide) return null;

  return (
    <iframe
      src={OGM_CBS_URL}
      title={`${title}: Millî Eğitim Bakanlığı coğrafi bilgi sistemi`}
      className="absolute inset-0 size-full border-0 bg-muted"
      sandbox={FRAME_SANDBOX}
      allow={FRAME_ALLOW}
    />
  );
}
