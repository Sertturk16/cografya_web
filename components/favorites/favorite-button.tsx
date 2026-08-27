"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAuthSession } from "@/lib/auth/use-session.client";
import {
  FAVORITES_FETCH_TIMEOUT_MS,
  fetchFavorites,
  removeFavorite,
  saveFavorite,
  type FavoriteTargetParam,
} from "@/lib/favorites/client";
import styles from "./favorite-button.module.css";

/**
 * The save/unsave control on a province or country detail page (UYELIK-08 plan §5.4) — the
 * first client-interactive island on either page type (§2's sharpened finding), imported
 * DIRECTLY into the server page (no `dynamic(() => …, { ssr: false })`): a small hydrated
 * island with no heavy library, the same treatment `VideoBench`/`search-combobox.tsx`
 * already get, not the "heavy interactive" tier `ENGINEERING.md` §3 reserves for maps/
 * game/CBS tools.
 *
 * STAYS VISIBLE FOR ANONYMOUS READERS, unlike `VideoProgressControls`' own
 * `if (authState !== "authenticated") return null;` posture — required by this task's
 * Acceptance Criteria, and licensed by a fact worth restating: "not favorited" is the
 * literal, correct default for a genuinely anonymous visitor, not a placeholder standing in
 * for one. The same `role="switch"` element renders in every auth state; only the
 * `aria-label` and the click branch change.
 *
 * NEVER READS IDENTITY SERVER-SIDE. This component's own favorited/not-favorited state is
 * discovered by a client-side fetch after mount — the SSR/SSG output for
 * `/turkiye/{slug}`/`/dunya/{slug}` stays byte-identical regardless of who requests it
 * (`SEO-POLICY.md` §B12.3.a/b), because neither page route reads `cookies()`/`headers()` and
 * this component never runs during that render. See §11's SEO-invariance checks.
 */
export function FavoriteButton({
  target,
  locale,
}: {
  readonly target: FavoriteTargetParam;
  readonly locale: Locale;
}) {
  const t = useTranslations("Favorites");
  const router = useRouter();
  const [authState] = useAuthSession();
  const [favorited, setFavorited] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // `target` is fixed for this component's whole lifetime — a navigation to a different
  // province/country is a different page, forced to remount by the call site's own `key`
  // prop (plan §5.4/§5.5), never a same-instance prop change. That is a real difference from
  // `deneme-video.tsx`'s `watchedRef` (which DOES need to keep tracking a genuinely-changing
  // prop via its own `useEffect(() => { watchedRef.current = watched; }, [watched])`): here
  // only `useRef`'s INITIAL value is ever read, and nothing reassigns `.current` afterwards —
  // a plain one-shot capture, not a kept-fresh mirror. This still lets the fetch effect below
  // avoid depending on the (per-render, non-stable-identity) prop object directly.
  const targetRef = useRef(target);

  // INITIAL VALUE DETERMINATION (plan §5.4, the one design point the dispatch left open): the
  // whole current-user favorites list is fetched once per mount, only once `authState`
  // resolves to `"authenticated"` — `checking`/`anonymous` both stay at the `false` default,
  // the same "treats checking the same as anonymous" posture `video-bench.tsx`'s own login
  // gate takes. A plain one-shot effect suffices; no fetch-key-tracking machinery is needed
  // here the way `video-bench.tsx`'s persistent singleton store needs one.
  useEffect(() => {
    if (authState !== "authenticated") return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FAVORITES_FETCH_TIMEOUT_MS);
    let cancelled = false;
    fetchFavorites(controller.signal)
      .then((favorites) => {
        if (cancelled || favorites === null) return;
        const currentTarget = targetRef.current;
        const match = favorites.some((favorite) =>
          currentTarget.kind === "province"
            ? favorite.type === "province" && favorite.plateCode === currentTarget.plateCode
            : favorite.type === "country" && favorite.isoCode === currentTarget.isoCode,
        );
        setFavorited(match);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [authState]);

  async function handleClick() {
    if (pending) return;
    if (authState !== "authenticated") {
      const dest = getPathname({ locale, href: "/kayit" });
      router.push(`${dest}?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setSaveFailed(false);
    const next = !favorited;
    setFavorited(next); // optimistic
    setPending(true);
    const result = next ? await saveFavorite(target) : await removeFavorite(target);
    setPending(false);
    if (!result.ok) {
      setFavorited(!next); // rollback — the Acceptance Criteria's own requirement
      setSaveFailed(true);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        role="switch"
        aria-checked={favorited}
        aria-disabled={pending}
        aria-label={
          authState !== "authenticated"
            ? t("signInRequiredAria")
            : favorited
              ? t("removeAria")
              : t("addAria")
        }
        className={`btn btn-ghost ${styles.toggle}`}
        onClick={() => void handleClick()}
      >
        {t("label")}
      </button>
      {saveFailed && (
        <p role="status" className={styles.error}>
          {t("saveError")}
        </p>
      )}
    </div>
  );
}
