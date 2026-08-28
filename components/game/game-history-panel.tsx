"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { fetchGameRounds, type GameRoundRecord } from "@/lib/game-rounds/client";
import { useAuthSession } from "@/lib/auth/use-session.client";
import { describeGameRoundModeTag } from "@/lib/game/round-mode-tag";
import type { RegionLabels } from "@/lib/game/target";
import styles from "./game-history-panel.module.css";

/**
 * The current-user's recent-rounds view (UYELIK-10 plan §5.7) — rendered on `/oyun`
 * (`app/[locale]/oyun/page.tsx`), the game surface's ONE indexable page. Imported directly
 * into the server page component (no `dynamic(() => …, { ssr: false })`) — a small
 * hydrated island with no heavy library, the same treatment `FavoriteButton` already gets.
 *
 * A CLIENT-SIDE-ONLY DATA FETCH, and that is a binding constraint, not a style choice:
 * `/oyun` must keep serving byte-identical SSR/SSG output regardless of who requests it
 * (`SEO-POLICY.md` §B12 12.3.a/b) — the same discipline `FavoriteButton` already
 * established for its own auth-gated surfaces. The page's own source carries no
 * `cookies()`/`headers()` call, and this component's fetch runs inside a `useEffect`, never
 * at module or render top level — both mechanically pinned by
 * `game-history-panel.structure.test.ts`.
 *
 * `5` is a deliberate CLIENT-SIDE product choice, not the transport default (the BFF/api
 * default page size is 20): this is a small, glanceable "recent rounds" list, not a full
 * paginated history — the non-goal boundary against a dashboard/history page (plan §3). No
 * pager, no filter, no `total`/`hasMore`-driven copy.
 */
const HISTORY_PAGE_SIZE = 5;

type FetchStatus = "pending" | "settled";

export function GameHistoryPanel({
  locale,
  regionLabels,
}: {
  readonly locale: Locale;
  readonly regionLabels: RegionLabels;
}) {
  const t = useTranslations("Game");
  const tr = useTranslations("GameRounds");
  const [authState] = useAuthSession();
  const [status, setStatus] = useState<FetchStatus>("pending");
  const [rounds, setRounds] = useState<readonly GameRoundRecord[] | null>(null);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchGameRounds(1, HISTORY_PAGE_SIZE, controller.signal).then((result) => {
      if (cancelled) return;
      setRounds(result);
      setStatus("settled");
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authState]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  // Mirrors `VideoProgressControls`'s posture, not `FavoriteButton`'s (plan §5.7/"Product
  // judgment calls" item 2): there is no generically-true default sentence for an anonymous
  // reader here — unlike "not favorited" — and this is a display-only panel with no action
  // of its own to invite them into.
  if (authState !== "authenticated") return null;

  // Still fetching: render nothing rather than a premature "no saved rounds yet" — that
  // sentence would be a false statement for the instant before the real answer arrives, not
  // merely an internal-state leak (CONTENT-STYLE §22).
  if (status === "pending") return null;

  /** Resolves a saved round's `mode` tag to a display label — a graceful literal fallback
   *  (the raw tag itself) for the `"unknown"` shape rather than a crash: `GET
   *  /api/game-rounds` can in principle return rows this web client did not itself write
   *  (plan §5.1). A closure over `t`/`regionLabels` rather than a module-level function, to
   *  avoid re-typing next-intl's own namespaced translator signature a second time. */
  function modeLabel(mode: string): string {
    const shape = describeGameRoundModeTag(mode);
    switch (shape.kind) {
      case "regions":
        return t("mode1Name");
      case "provinces":
        return t("mode2Name");
      case "provinces-region":
        return `${t("mode3Name")} · ${regionLabels[shape.region]}`;
      case "unknown":
        return shape.raw;
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="game-history-heading">
      <h2 id="game-history-heading" className={styles.heading}>
        {tr("historyHeading")}
      </h2>
      {rounds === null || rounds.length === 0 ? (
        <p className={styles.empty}>{tr("historyEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {rounds.map((round) => (
            <li key={round.clientRoundId} className={styles.row}>
              <span className={styles.mode}>{modeLabel(round.mode)}</span>
              <span className={styles.score}>{round.score}</span>
              <time className={styles.date} dateTime={round.createdAt}>
                {dateFormatter.format(new Date(round.createdAt))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
