# T-062 — One unsaved-changes pattern for the whole site

**Status:** design in progress. Section 1 recorded; sections 2 (dialog behaviour and copy) and 3
(testing) follow. Nothing is implemented yet.

## The problem

`/hesabim/ayarlar` has four sections, three of them forms. A member who edits their phone number
and leaves via a header link — without pressing Kaydet — loses the edit with no warning. The same
holds for step 2 of the registration wizard and for the profile card.

This is the Web Interface Guidelines item _"Warn before navigation with unsaved changes"_. T-061
left it out of scope deliberately: the site has no such pattern anywhere, and a solution built for
one page would be built in the wrong place.

`beforeunload` catches only tab close. There is no App Router navigation event to hook, so
catching in-site navigation needs either click interception or a link wrapper. That makes this a
decision about a **site-wide dirty-form pattern**, with the settings page as its first consumer.

## Decisions taken

| Question                | Answer                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What happens on leave?  | A confirmation dialog: "unsaved changes — leave or stay". Navigation blocks until the member chooses.                                                                                                                   |
| Which exits are caught? | In-site links and programmatic `router.push`, plus tab close via `beforeunload`. Browser back/forward is **out of scope** — catching it needs a synthetic history entry, which is fragile and degrades the back button. |
| Approach                | Guarded navigation primitives (below), not a global click listener and not per-consumer wrappers.                                                                                                                       |

## Why guarded primitives

Two facts about this repo decide it:

- **`i18n/navigation.ts` is already the single choke point for links.** It re-exports `Link` and
  `useRouter` from `createNavigation`, 56 files import from it, and no file imports `next/link`
  directly. Wrapping `Link` there gives every existing link the guard with no call-site changes.
- **`useRouter` does not hold that line.** Six files import it from `next/navigation` directly —
  `v2-settings-personal-card`, `v2-settings-education-card`, `v2-login-card`, `v2-register-card`,
  `v2-hero`, `v2-verify-email-card` — against the hard rule in `CLAUDE.md`, and nothing guards the
  rule. Two of them are settings forms, so programmatic `push` currently escapes any guard placed
  in `i18n/navigation.ts`. Converting those six and adding a test for the rule is part of this
  work, not a side errand.

The two alternatives were rejected:

- **A global capture-phase `click` listener** catches plain `<a>` too, but never sees
  `router.push` — which is exactly what the settings cards call — and races React's own event
  system.
- **Per-consumer `<GuardedLink>`** cannot work: the navigation a member actually takes is a
  header link, and the header is rendered outside the form's tree.

## Section 1 — the dirty-state API

Three parts.

**`useUnsavedChanges(dirty: boolean, message?: string)`** is the only thing a form calls. While
`dirty` is true the component is registered as a dirty source in a module-level registry; it
deregisters when `dirty` goes false or the component unmounts. The `beforeunload` listener is
attached while the registry is non-empty and removed when it drains, so the tab-close warning and
the in-site dialog are driven by one truth rather than two.

**Computing "dirty" belongs to the caller.** The three settings cards already seed their state
from `profile`, so dirty is "current fields ≠ the initial snapshot". The hook is deliberately not
a form-state manager: the cards keep their `useState` exactly as they are and add one line. The
password card is the one different shape — its initial values are empty strings, so dirty there
means "anything has been typed".

**The registry is module-level, not context.** The wrapper that raises the warning lives in
`i18n/navigation.ts` and renders inside the header, the footer, everywhere — outside any provider
a form could mount. A context would have to be provided at the top of
`app/[locale]/(site)/layout.tsx`, and the `(play)` group would never see it. A module-level
registry read through `useSyncExternalStore` works identically under both layout groups.

**A successful save clears dirty.** The cards' `handleSubmit` already sets `saved`; re-seeding the
snapshot from the saved values at that point is one more line.

## Sections still to write

- **Section 2** — dialog behaviour (focus, escape, the pending href, what "stay" restores) and the
  Turkish and English copy.
- **Section 3** — testing: which of these rules are held by a test, and the new test that pins
  `useRouter` to `@/i18n/navigation`.
