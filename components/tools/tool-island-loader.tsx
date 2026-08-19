"use client";

import dynamic from "next/dynamic";
import type { ToolIslandProps } from "./tool-island";

/**
 * The `ssr: false` boundary for the measuring island (`ENGINEERING.md` §3 — heavy interactive
 * = a server-rendered static shell plus a dynamically loaded client widget).
 *
 * It is its own four-line file for the mechanical reason `game-island-loader.tsx` records:
 * `next/dynamic` with `ssr: false` is not allowed inside a Server Component, so the option
 * needs a client module to live in.
 *
 * No `loading` fallback, deliberately. Everything indexable — the heading, the explanatory
 * text, the 81-province map, the attribution — is server HTML that is already on screen, and
 * the control strip's box is already reserved by `.controlsSlot`. A spinner would flash over
 * content that is not missing.
 */
const ToolIsland = dynamic(() => import("./tool-island").then((mod) => mod.ToolIsland), {
  ssr: false,
});

export function ToolIslandLoader(props: ToolIslandProps) {
  return <ToolIsland {...props} />;
}
