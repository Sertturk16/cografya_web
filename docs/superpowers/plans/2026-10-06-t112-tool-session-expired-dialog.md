# T-112 Tool Session-Expired Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A measurement save or delete that the BFF answers with 401 opens the in-page auth dialog, moves the session store to `anonymous`, and repeats the action by itself once the reader signs in.

**Architecture:** A new `signInAgain(intent)` in `lib/auth/use-session.client.ts` is the 401 primitive: it sets the session store to `"anonymous"` FIRST (so the dialog's "already signed in" auto-resolve cannot fire) and then calls `requestAuth(intent)`, returning the request id. The workbench holds one pending action (`save`, or `delete` of an id) with its request id in a ref; the session gate's `onAuthRequested` (guest press) and the 401 path both fill it, and a resume effect (`consumeResolved`, the favourite/game/video pattern) runs it once. A resumed action that succeeds reloads the saved list, because the sign-in also starts a list fetch that can finish after the write.

**Tech Stack:** Next.js 16, React 19.2 (`useEffectEvent`), next-intl, vitest (node env, no jsdom).

**Spec:** `TASKS.md` T-112 (owner decision 2026-10-06).

## Global Constraints

- No `/giris` link for a measurement 401 any more; the `Measurements.sessionExpired` copy goes (Favorites keeps its own).
- `lib/auth/session-guest-branch.test.ts` must stay green: no new `"authenticated"` comparison that can fall into a guest branch.
- User-facing copy Turkish; no new copy is needed.

## Review Focus

- Order of store write vs dialog open: dialog must not auto-resolve because the store still says authenticated (unit test on `signInAgain` order).
- Dialog dismissed: nothing resumes; a later press opens a new request that supersedes the held one (resume keyed on request id).
- Same unchanged measurement retried keeps its `clientMeasurementId` (no duplicate row) — existing `pendingSaveRef` logic, untouched.
- Resumed save/delete vs the sign-in list fetch race: list reload after a resumed success (structure test).
- Guest press now resumes the save after sign-in too (same held action).

---

### Task 1: `signInAgain` primitive

**Files:** Modify `lib/auth/use-session.client.ts`; Test `lib/auth/use-session.test.ts` (or the existing session-gate test file).

- [ ] Failing test: with fake `store.set` and `requestAuth` recording calls, `signInAgain("measurement", deps)` calls `set("anonymous")` before `requestAuth("measurement")` and returns its id.
- [ ] Implement `export function signInAgain(intent, deps = { store, requestAuth }): string`.
- [ ] Tests green.

### Task 2: Workbench wiring

**Files:** Modify `components/v2/v2-tool-workbench.tsx`, `lib/measurements/save-error.ts` (+ test), `lib/http/mutation-error.ts` doc, `messages/{tr,en}.json` (drop `Measurements.sessionExpired`), `lib/measurements/messages.test.ts`, `components/v2/v2-tool-workbench.errors.test.tsx`, `components/v2/v2-tool-workbench.structure.test.ts`.

- [ ] Failing structure tests: 401 on save/delete calls `askToSignInAgain({ kind: ... })`, never sets a failure; the gate's `onAuthRequested` holds `{ kind: "save" }`; resume effect uses `consumeResolved(pending.requestId)` and reloads the list after a resumed success; no `/giris` link in the workbench.
- [ ] `SAVE_ERROR_MESSAGE_KEY` / `DELETE_ERROR_MESSAGE_KEY` cover only shown codes (`ShownSaveErrorCode`, `ShownDeleteErrorCode` excluding `session-expired`); `MeasurementErrorText` removed, render via `tMeasurements(key)`.
- [ ] Implement; typecheck + lint + test green.

### Task 3: Live verification

- [ ] In the dev app, sign in, make a distance measurement, clear the access/refresh cookies (or route `/api/measurements` POST to 401 once), press Kaydet: dialog opens, store is anonymous, sign in, save completes and appears in the list without a second press.
- [ ] Same for delete. `pnpm sweep:overflow -- --filter=araclar`, impeccable audit.
