"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LockIcon } from "@/components/lock-icon";
import { consumeResolved, requestAuth, useAuthModalState } from "@/lib/auth/auth-modal.client";
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
 * for one. Two DIFFERENT elements render depending on `authState` (→ PR #91 round-2 review
 * `A11Y91-I1`, fixed): `role="switch"` + `aria-checked` only in the `authenticated` branch,
 * where activation genuinely toggles the control's own state; a plain unrole'd `<button>` in
 * every other state, where activation instead OPENS THE AUTH MODAL (uyelik-auth-redesign
 * plan §5.6.1, superseding an earlier full-page `/kayit` redirect) — sharing one switch
 * element across both, as the code briefly did, violates WAI-ARIA's switch pattern contract
 * for the non-authenticated branch.
 *
 * NEVER READS IDENTITY SERVER-SIDE. This component's own favorited/not-favorited state is
 * discovered by a client-side fetch after mount — the SSR/SSG output for
 * `/turkiye/{slug}`/`/dunya/{slug}` stays byte-identical regardless of who requests it
 * (`SEO-POLICY.md` §B12.3.a/b), because neither page route reads `cookies()`/`headers()` and
 * this component never runs during that render. See §11's SEO-invariance checks.
 *
 * RESUME (plan §5.6.1) — the interrupted action is "perform the save the reader asked for":
 * `performToggle` is the code the authenticated click path and the post-auth resume effect
 * both call. `authRequestId` is a plain `useRef` (never triggers a render on its own), and
 * `consumeResolved` returning `true` exactly once is what makes a double-run impossible even
 * under React 19 Strict Mode's double-invoked effects (K3).
 */
export function FavoriteButton({ target }: { readonly target: FavoriteTargetParam }) {
  const t = useTranslations("Favorites");
  const [authState] = useAuthSession();
  const modal = useAuthModalState();
  const [favorited, setFavorited] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Announces the resumed save to assistive tech (plan §5.6.1) — the authenticated branch's
   *  own `aria-checked` swap is an uninitiated state change (WCAG 4.1.3), the same mechanism
   *  `game-round-save.tsx`'s own label-swap announcement already uses. */
  const [justResumed, setJustResumed] = useState(false);

  // `target` is fixed for this component's whole lifetime — a navigation to a different
  // province/country is a different page, forced to remount by the call site's own `key`
  // prop (plan §5.4/§5.5), never a same-instance prop change. That is a real difference from
  // `deneme-video.tsx`'s `watchedRef` (which DOES need to keep tracking a genuinely-changing
  // prop via its own `useEffect(() => { watchedRef.current = watched; }, [watched])`): here
  // only `useRef`'s INITIAL value is ever read, and nothing reassigns `.current` afterwards —
  // a plain one-shot capture, not a kept-fresh mirror. This still lets the fetch effect below
  // avoid depending on the (per-render, non-stable-identity) prop object directly.
  const targetRef = useRef(target);

  // CODE91-I1 fix (PR #91 round 2 review): once the reader has clicked, the one-shot
  // `fetchFavorites` effect below must never overwrite whatever `handleClick` has already
  // set — a `useRef`, not `useState`, because flipping it must never itself trigger a
  // render. Without this guard a `fetchFavorites` request started BEFORE the click could
  // still resolve AFTER it (slow network, cold serverless start) and stomp the just-saved
  // optimistic/confirmed value with its own stale pre-click snapshot.
  const hasClickedRef = useRef(false);

  /** The modal request currently being served by this control, or `null` (plan §5.6). */
  const authRequestId = useRef<string | null>(null);

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
        if (cancelled || favorites === null || hasClickedRef.current) return;
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

  /** The interrupted action itself — shared by the authenticated click path and the resume
   *  effect below (plan §5.6.1). */
  const performToggle = useCallback(async () => {
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
  }, [favorited, target]);

  async function handleClick() {
    if (pending) return;
    hasClickedRef.current = true;
    if (authState !== "authenticated") {
      authRequestId.current = requestAuth("favorite");
      return;
    }
    await performToggle();
  }

  // The resume: signed out → modal → login/register → the save the reader originally asked
  // for completes, with no page reload and no lost scroll position.
  useEffect(() => {
    const id = authRequestId.current;
    if (id === null || modal.resolvedRequestId !== id) return;
    if (!consumeResolved(id)) return;
    authRequestId.current = null;
    hasClickedRef.current = true;
    setJustResumed(true);
    void performToggle();
  }, [modal.resolvedRequestId, performToggle]);

  return (
    <div className={styles.wrapper}>
      {/* A11Y91-I1 fix (PR #91 round 2 review): `role="switch"`/`aria-checked` are now
          reserved for the ONE branch where activation genuinely does toggle only the
          control's own state (WAI-ARIA APG's switch pattern requirement) — the unauthenticated
          branch below is a plain button whose activation opens the auth modal, so it carries
          neither. The removed unconditional-switch shape (both branches sharing one
          `role="switch"` element) is the exact defect the finding named. */}
      {authState === "authenticated" ? (
        <button
          type="button"
          role="switch"
          aria-checked={favorited}
          aria-disabled={pending}
          aria-label={favorited ? t("removeAria") : t("addAria")}
          className={`btn btn-ghost ${styles.toggle}`}
          onClick={() => void handleClick()}
        >
          {t("label")}
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("signInRequiredAria")}
          className={`btn btn-ghost ${styles.toggle}`}
          onClick={() => void handleClick()}
        >
          {/* A2 fix (İRİS live-audit tour, PR #91 round 2 — Orta): a sighted visitor had no
              visual warning that this click opens the sign-up modal, only the aria-label
              reached a screen-reader user. A small lock glyph is the cheapest honest signal
              ("this needs sign-in") without inventing a new interaction pattern or a fourth
              visual variant beyond what İRİS's own B1 idea sketched. `aria-hidden` because the
              accessible name above already states the fact in full — announcing the icon too
              would be redundant, the same posture `CardArrow` already takes for its own
              decorative glyph. Inline SVG, not a Unicode character, for the same reason
              `CardArrow`'s own docblock gives (DEC 2026-08-05e): `lib/fonts.ts` only
              self-hosts the `latin`/`latin-ext` subsets, so a glyph from outside those blocks
              would silently fall back to whatever the OS substitutes. */}
          <LockIcon variant="compact" className={styles.lockIcon} />
          {t("label")}
        </button>
      )}
      {justResumed && (
        <p role="status" className={styles.srOnly}>
          {t("savedStatus")}
        </p>
      )}
      {saveFailed && (
        <p role="status" className={styles.error}>
          {t("saveError")}
        </p>
      )}
    </div>
  );
}
