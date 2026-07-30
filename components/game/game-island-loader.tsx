"use client";

import dynamic from "next/dynamic";
import type { GameIslandProps } from "./game-island";

/**
 * The `ssr: false` boundary for the play island (ENGINEERING.md §3 — heavy interactive =
 * server-rendered static shell + a dynamically loaded client widget).
 *
 * It exists as its own file for a mechanical reason: `next/dynamic` with `ssr: false` is
 * not allowed inside a Server Component, so the option needs a client module to live in.
 * Keeping that module to four lines means the game's own code stays in one place.
 *
 * There is no `loading` fallback on purpose. Everything indexable — the heading, the mode
 * descriptions, the 81-province map, how-to-play, the FAQ — is server HTML that is already
 * on screen; a spinner here would only add a flash of placeholder over content that is not
 * missing. The play controls simply appear when the island lands, inside a container whose
 * height is already reserved, so nothing moves (CLS).
 */
const GameIsland = dynamic(() => import("./game-island").then((mod) => mod.GameIsland), {
  ssr: false,
});

export function GameIslandLoader(props: GameIslandProps) {
  return <GameIsland {...props} />;
}
