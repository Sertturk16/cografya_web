# T-165 + T-167 Session "Checking" States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While the session check runs (`"checking"`), no `useAuthSession` consumer shows guest
content, and a press that waits for the check shows a waiting state that never claims a save.

**Architecture:** Every guest branch is gated on `=== "anonymous"`, never on
`!== "authenticated"` or the `else` of `=== "authenticated"`. A `typescript`-AST scan test over
`components/`, `lib/` and `app/` fails on any comparison with the `"authenticated"` literal that
can fall into a guest branch: `!==`/`!=` outside the member-only guard `if (x !== "authenticated")
return;` / `return null;`, and a `=== "authenticated" ? a : b` (or `if … else`) whose other side is
not empty (`null`, `undefined`, `""`, `[]`, `false`). Login-gated presses go through T-162's
`useSessionGate` / `gateOnAuthSession`; their `waiting` drives the control's busy state.

**Tech Stack:** Next.js 16 / React 19.2 client components, vitest node env (`renderToStaticMarkup`
renders a consumer in the server snapshot, which is always `"checking"`), `typescript` compiler API.

**Spec:** `/home/sertturk16/cografya_v4/TASKS.md` → T-165, T-167.

## Global Constraints

- `"checking"` is not `"anonymous"`; guest copy, lock icons and sign-in prompts render only on
  `"anonymous"`.
- Waiting copy: never "Kaydediliyor…" before a save request starts. Favourite and measurement save
  while waiting: spinner + "Oturumun kontrol ediliyor" (EN "Checking your session"). İzle while
  waiting: the existing "Yükleniyor…" loading state + `aria-busy`, same as "YouTube'da izle".
- No new layout shift for guests: neutral states are empty or `aria-hidden` placeholders.
- `v2-login-card` keeps its form while checking: it is the `/giris` page's own content, not a
  guest prompt inside a member surface (reviewed exception, not a guest branch of the rule).

## Review Focus

- Leaderboard opened while checking shows "Tablo yükleniyor…", not "Giriş Yapman Gerekiyor".
- Game history server render has no "Oynamak için giriş yap" banner.
- Measurement save pressed while checking waits instead of opening the auth dialog.
- İzle second press while waiting is ignored (no second gate, no double dialog).
- The "Giriş yaptın" live announcement fires only after a real anonymous → authenticated change.

---

### Task 1: guard test (T-165)

**Files:** Create `lib/auth/session-guest-branch.test.ts`.

- [ ] AST scan as described; it fails today on the leaderboard, game history, tool workbench,
      favourite button and deneme-video sites.

### Task 2: consumers (T-165)

**Files:** Modify `v2-game-history-stats.tsx`, `v2-leaderboard-modal.tsx`, `v2-tool-workbench.tsx`,
`v2-favorite-button.tsx`, `components/book/deneme-video.tsx`; render tests next to them.

- [ ] Failing render tests (server render = checking): no guest copy in game history, favourite
      (no lock, `addAria` name), deneme-video (no sign-in CTA, no signed-out name).
- [ ] Gate guest branches on `"anonymous"`; leaderboard checking = loading; workbench save through
      `useSessionGate("measurement", …)`; deneme-video announcement only after anonymous.
- [ ] Guard test from Task 1 green; commit.

### Task 3: waiting states (T-167)

**Files:** Modify `video-bench.tsx`, `bench-stage.tsx`, `deneme-video.tsx`,
`v2-favorite-button.tsx`, `v2-tool-workbench.tsx`, `messages/{tr,en}.json`.

- [ ] Failing tests: DenemeVideo with `pressPending` renders `aria-busy="true"` and "Yükleniyor…";
      bench sets the pending order on `onWaiting` for İzle; favourite source labels waiting with
      `checkingSessionLabel`, saving with `savingLabel` only when `pending`.
- [ ] Implement; full lane; browser check with the session request held; sweep; commit; PR.
