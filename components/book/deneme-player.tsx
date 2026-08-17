"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { closeVideo, openVideo } from "./active-video";

/**
 * One deneme block: server-rendered children, and ONE delegated listener over all of them.
 *
 * ## Thirty listeners, not a hundred and eighty
 *
 * The page carries 30 blocks of 6 questions. Binding a handler per question would be 180
 * listeners for a page whose body is a static index; delegation at the block root is one per
 * block, and the block is also the natural scope — it already knows its own `denemeNo` and its
 * own video, so nothing has to be looked up or matched (`SPEC.md` §4.3).
 *
 * ## The links stay REAL links, and the interception is conditional
 *
 * Every question row is a server-rendered `<a href="#deneme-12-soru-3">` that resolves with no
 * JavaScript at all — `SEO-POLICY.md` §B8 8.2 rates JavaScript navigation a BLOCKER, and §B12
 * 12.2.b is what makes this index the page rather than an afterthought. This island does not
 * replace that behaviour; it adds to it, and only when all three of these hold:
 *
 * · the block is `playable` — a video the provider refuses to embed has no player to seek, so
 *   its rows keep their plain fragment behaviour;
 * · the press is an unmodified primary click — Ctrl/Cmd/Shift/Alt and middle-click go to the
 *   browser, so "open this question in a new tab" still works;
 * · the press landed on a control that carries `data-second` (a question row) or
 *   `data-player-open` (the facade's İzle button).
 *
 * Anything else falls through untouched.
 *
 * `preventDefault` on the rows is not cosmetic: the native jump scrolls to the question row,
 * which sits BELOW the player that just appeared — and the Required Minimum Functionality
 * rules ask that a player not begin playing off-screen. The address bar is updated by hand
 * instead, so the link stays copyable and shareable.
 *
 * `replaceState` rather than `pushState`: this island has no `popstate` handler, so pushed
 * entries would move the URL while the player stayed put, and 180 of them would bury whatever
 * the reader was on before. The cost — Back does not step through questions — is accepted
 * knowingly.
 *
 * ## Keyboard needs no separate path
 *
 * `<a>` and `<button>` both dispatch a click on Enter (and Space, on the button), so the one
 * delegated `onClick` covers "a click or a key press" — which is the only way the ledger
 * permits the player to load. There is deliberately no `mouseover`, `pointerover` or
 * `touchstart` handler anywhere in this component tree.
 *
 * ## The block also CLOSES its player on the way out, and that is what keeps the rule true
 *
 * The store is module state, and a client-side route change does not re-evaluate the module —
 * so without this the open player would survive leaving the page and reappear, autoplaying, on
 * the reader's next arrival, with no click and no key press anywhere in between (→ PR #63
 * review `CODE63-I1`). The cleanup lives here rather than in a page-level marker component for
 * two reasons: this island is already the only thing that opens a player, so open and close
 * sit in one file; and a route change unmounts all thirty blocks, so the one holding the
 * player clears it and the rest are no-ops. It does NOT fire when a block merely stops being
 * the active one — that block does not unmount, it just renders its facade again.
 *
 * ## One tick is not covered, and that is known rather than overlooked
 *
 * This cleanup is a passive effect, so on a SAME-ROUTE remount — where React deletes the old
 * subtree and inserts the new one in a single commit — the new block renders BEFORE the old
 * block's cleanup runs, and reads a store that is still stale. The section above therefore
 * states an invariant with one exception, not an absolute (→ PR #63 review `CODER2-M1`).
 *
 * The path that reaches it today is the header's language switcher: `/kitaplar/{slug}` and
 * `/en/books/{slug}` are different segments, so the subtree is re-created, and next-intl's
 * `Link` makes it a client transition rather than a document load. A reader who pressed İzle
 * seconds earlier gets one commit of that block's iframe back, then the cleanup fires and it
 * is gone — no playback, no focus move, no persistent frame; one embed request that repeats a
 * request the same reader authorised in this same document, for this same video. That is why
 * it is accepted rather than fixed here.
 *
 * WHAT WOULD MAKE IT A REAL DEFECT, so that whoever gets there does not have to rediscover it:
 * a direct book→book link. The store's `denemeNo` would then match a block of a DIFFERENT
 * book, and the tick would request an embed for a video the reader never asked for — the
 * gesture-free third-party request this whole architecture exists to prevent. No such link
 * exists on this page today. Whoever adds one closes the residue in the same change; full
 * closure scopes the store to the page instance, which is a plan-w2 architecture decision and
 * sits with Atlas as a tracked follow-up.
 */
export function DenemePlayer({
  className,
  denemeNo,
  playable,
  children,
}: {
  /** Optional exactly as React types it: a CSS-module lookup is `string | undefined` under
   *  `noUncheckedIndexedAccess`, and this element is the page's `<section>`, so its styling
   *  belongs to the page's own module rather than to this island. */
  className?: string;
  denemeNo: number;
  playable: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLElement>(null);
  /**
   * The second the İzle button should start from — 0 unless the reader arrived on a link to
   * one of THIS block's questions.
   *
   * Arriving with `#deneme-12-soru-3` does not load a player: the ledger permits the load on a
   * click or a key press, and a hash is neither — the reader would otherwise have a
   * third-party request made on their behalf by a link somebody else sent them. The fragment
   * still works exactly as it always did (the row is a real element with a real id, and W1's
   * `scroll-margin-top` clears the sticky header). What it adds is that pressing İzle then
   * starts at the question the link named, instead of at the top of the video.
   *
   * Read from the DOM rather than passed as a prop: the rows already carry both the id and the
   * second, so this costs nothing in the payload.
   */
  const hashStartSecond = useRef(0);

  useEffect(() => {
    if (!playable) return;
    const id = window.location.hash.slice(1);
    if (id === "") return;
    const target = document.getElementById(id);
    const root = rootRef.current;
    if (target === null || root === null || !root.contains(target)) return;
    const raw = target.dataset.second;
    if (raw === undefined) return;
    const second = Number.parseInt(raw, 10);
    if (Number.isFinite(second)) hashStartSecond.current = second;
  }, [playable]);

  // Scoped to THIS block: the no-op on the twenty-nine that were not playing is what keeps a
  // single block leaving the list from closing a player the reader is watching in another one.
  useEffect(() => {
    return () => {
      closeVideo(denemeNo);
    };
  }, [denemeNo]);

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!playable || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>("[data-second], [data-player-open]");
    if (trigger === null) return;

    const raw = trigger.dataset.second;
    let second = hashStartSecond.current;
    if (raw !== undefined) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      second = parsed;
    }

    event.preventDefault();
    // The button has no href of its own, so it addresses the block; a row addresses itself.
    const fragment = trigger.getAttribute("href") ?? `#deneme-${denemeNo}`;
    window.history.replaceState(null, "", fragment);
    openVideo(denemeNo, second);
  };

  return (
    <section ref={rootRef} className={className} onClick={onClick}>
      {children}
    </section>
  );
}
