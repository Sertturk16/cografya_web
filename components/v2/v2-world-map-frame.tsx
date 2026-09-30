/**
 * The earth.nullschool.net map, framed to fill its positioned parent (the `(embed)` layout's
 * `<main>`). Used by `/dunya-analizi`.
 *
 * `?kiosk` IS LOAD-BEARING. Inside an iframe the map's own script (`window.self !== window.top`)
 * turns the bottom-left "earth" button into `window.open(location.href, "_blank")`, so a click
 * sent the reader to a new tab instead of opening the control panel. Measured with the
 * `sandbox` and `referrerpolicy` attributes on and off: all four combinations opened a tab, so
 * it is the map's own embed behaviour, not something these attributes cause. With `kiosk` in the
 * query the script skips that branch, the button toggles the panel, and nothing else changes.
 * The parameter is undocumented and the map's author treats framing as his call (his code
 * special-cases one named partner), so it can stop working without notice; if the "earth"
 * button is opening a tab again, that is the first place to look.
 *
 * `sandbox` keeps the frame from navigating the top page; scripts and its own origin are what
 * the map needs to load its data. `no-referrer`: the map has no use for which page framed it.
 */
const FRAME_SRC = "https://earth.nullschool.net/?kiosk";

export function V2WorldMapFrame({ title }: { title: string }) {
  return (
    <iframe
      src={FRAME_SRC}
      title={`${title}: rüzgâr ve okyanus akıntıları haritası (earth.nullschool.net)`}
      className="absolute inset-0 size-full border-0 bg-muted"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
    />
  );
}
