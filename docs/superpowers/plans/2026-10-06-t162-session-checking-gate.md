# T-162 Session "checking" Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A press on a login-gated control while the session is still `"checking"` waits for the
session to settle instead of treating the reader as a guest: a signed-in reader gets the action, a
guest gets the auth dialog.

**Architecture:** The session store (`lib/auth/use-session.client.ts`) gains `whenSettled()`, a
promise that resolves with the first non-`"checking"` state. A pure `gateOnAuthSession()` runs the
action synchronously when the state is already known and otherwise waits on `whenSettled()`; a thin
`useSessionGate()` hook adds the `waiting` flag, unmount cancellation and latest-callback refs. The
game screen, the favourite button and the video bench use it. The auth dialog also resolves an open
request when the session becomes authenticated from elsewhere.

**Tech Stack:** React 19.2 (`useSyncExternalStore`), Next.js 16, vitest (node env, no DOM).

**Spec:** `/home/sertturk16/cografya_v4/TASKS.md` → T-162 (Olgu, Kriter, Grooming, Karar).

## Global Constraints

- `"checking"` is NOT `"anonymous"`; a signed-in reader never sees the auth dialog because of it.
- The 8 s `AUTH_FETCH_TIMEOUT_MS` abort ends as `"anonymous"`; nothing waits forever.
- vitest runs in `node`: hooks are not rendered; the store and the pure gate carry the tests.
- No API/contract change. No new user-facing copy.

## Review Focus

- Double tap while waiting: the action must run once (hook ignores `run()` while waiting).
- Reader leaves the page while waiting: no `startRound`/`requestAuth` after unmount (`isCancelled`).
- Store already settled: the action runs synchronously in the click (user activation kept).
- Session fetch times out: the gate falls back to the dialog, it does not hang.
- `invalidate()` while waiting: `whenSettled()` keeps waiting through `"checking"` and resolves on
  the next settled value.

---

### Task 1: `whenSettled()` and `gateOnAuthSession()` (store + pure gate)

**Files:**

- Modify: `lib/auth/use-session.client.ts`
- Test: `lib/auth/session-store.test.ts`

**Interfaces:**

- Produces:
  - `type SettledAuthSessionState = Exclude<AuthSessionState, "checking">`
  - `AuthSessionStore.whenSettled(): Promise<SettledAuthSessionState>` (calls `ensureFetched()`
    when still `"checking"`, so it cannot hang on a store nobody started)
  - `type SessionGateOutcome = "ran" | "auth-requested" | "cancelled"`
  - `gateOnAuthSession(options: SessionGateOptions, deps?: SessionGateDeps): Promise<SessionGateOutcome>`
    with `SessionGateOptions = { intent: AuthIntent; onAuthenticated(): void; onAuthRequested(requestId: string): void; onWaiting?(): void; isCancelled?(): boolean }`
    and `SessionGateDeps = { store: Pick<AuthSessionStore, "getSnapshot" | "whenSettled">; requestAuth(intent: AuthIntent): string }`
  - `useSessionGate(intent, onAuthenticated, onAuthRequested): { readonly waiting: boolean; run(): void }`

- [ ] **Step 1: failing tests** in `session-store.test.ts`:
  - `whenSettled` resolves immediately when already settled;
  - while `"checking"` it resolves on the next commit;
  - with `cg_has_session=1` and a fetch that never answers, fake timers past
    `AUTH_FETCH_TIMEOUT_MS` resolve it `"anonymous"`;
  - gate while `"checking"`: `requestAuth` not called, action not called, `onWaiting` called;
    after `set("authenticated")` the action ran exactly once, `requestAuth` never;
  - gate while `"checking"` then `set("anonymous")`: `requestAuth("favorite")` once, its id passed
    to `onAuthRequested`, action never;
  - gate when already authenticated: action runs synchronously (before any `await`);
  - gate with `isCancelled() === true` at settle: neither callback runs, outcome `"cancelled"`.
- [ ] **Step 2:** `pnpm vitest run lib/auth/session-store.test.ts` → FAIL (missing exports).
- [ ] **Step 3:** implement in the store (listener that resolves on the first non-checking commit
      and unsubscribes) and the gate (sync fast path, else `onWaiting`, `await whenSettled()`,
      `isCancelled`, then dispatch). Module-level `whenAuthSessionSettled()` wraps the singleton.
      `useSessionGate`: `useState(false)` waiting, callbacks in refs synced by `useEffect`, a mounted
      ref, `run()` returns early while waiting.
- [ ] **Step 4:** tests PASS.
- [ ] **Step 5:** commit `feat(auth): wait for the session check before gating a press (T-162)`.

### Task 2: call sites

**Files:**

- Modify: `components/v2/v2-game-screen.tsx` (`handleStartGameClick`, both buttons get
  `isLoading={sessionGate.waiting}`)
- Modify: `components/v2/v2-favorite-button.tsx` (`handleClick`; spinner + `disabled` while waiting)
- Modify: `components/book/video-bench.tsx` (both gates at :546 and :568; the external control
  shows its existing resolving spinner while waiting)
- Modify: `components/v2/v2-auth-dialog.tsx` (open + `"authenticated"` → `resolveAuth()`)
- Test: `lib/auth/session-store.test.ts` source assertion: none of the three gate files keeps an
  `authState !== "authenticated"` branch that calls `requestAuth` directly.

- [ ] **Step 1:** add the source-assertion test → FAIL.
- [ ] **Step 2:** rewrite each gate through `useSessionGate` (video bench uses
      `gateOnAuthSession` directly because the action depends on the clicked row).
- [ ] **Step 3:** targeted tests + `pnpm typecheck && pnpm lint`.
- [ ] **Step 4:** browser before/after with the repro recipe (390x844, `cg_has_session=1`,
      `/api/auth/session` held 5 s); `pnpm test` full lane; `verifying-visible-ui` + `sweep:overflow
-- --filter=/oyun/81-il`.
- [ ] **Step 5:** commit `fix(game): start the round once the session check settles (T-162)`, PR.
